// Rule-based detector. Pure logic: feed it events, get detections back.
// No timers, no store, no DOM — so it can be unit-tested in plain Node (see test/).
import { THRESHOLDS } from '../config.js'
import { SERVER_BY_ID, LIGHT_BY_ID, SERVICES, KNOWN_SOURCES } from './model.js'
import { RULES } from './rules.js'

const hh = h => `${String(h).padStart(2, '0')}:00`
const t8 = ts => new Date(ts).toTimeString().slice(0, 8)

export class Detector {
  constructor(cfg = THRESHOLDS) { this.cfg = cfg; this.win = new Map() }

  reset() { this.win.clear() }

  // sliding window of {ts, v}; returns the live window array
  _push(key, ts, v, keepMs) {
    let a = this.win.get(key)
    if (!a) this.win.set(key, (a = []))
    a.push({ ts, v })
    const cut = ts - keepMs
    while (a.length && a[0].ts < cut) a.shift()
    return a
  }

  _det(code, assetId, zone, serviceId, impact, urgency, evidence, ev) {
    const r = RULES[code]
    return {
      key: `${code}:${assetId}`, code, title: r.title, why: r.statement, pillar: r.pillar, sticky: !!r.sticky,
      assetId, zone, serviceId, impact, urgency: Math.max(1, Math.min(5, urgency)), evidence, ts: ev.ts,
    }
  }

  /** @returns {{raised: object[], cleared: string[]}} */
  ingest(ev) {
    const out = { raised: [], cleared: [] }
    const c = this.cfg
    const d = ev.data
    switch (ev.kind) {
      // R1 ── streetlight toggling on/off repeatedly
      case 'light.state': {
        const a = this._push(`flick:${ev.assetId}`, ev.ts, d.lit, c.flicker.windowMs)
        if (a.length >= c.flicker.changes) {
          const light = LIGHT_BY_ID[ev.assetId]
          const pattern = a.slice(-6).map(x => (x.v ? 'ON' : 'OFF')).join(' → ')
          out.raised.push(this._det('R1', ev.assetId, light.zone, 'lighting', SERVICES.lighting.impact,
            3 + (a.length >= c.flicker.changes * 2 ? 1 : 0),
            [`${a.length} state changes in ${c.flicker.windowMs / 1000} s on ${ev.assetId} (threshold ≥${c.flicker.changes})`,
             `Recent pattern: ${pattern}`, `Last change ${t8(ev.ts)} via ${d.source || 'unknown'}`], ev))
        }
        break
      }
      // R2 ── unusual remote-control request (unknown source / odd hour / bulk)
      case 'light.remote': {
        const flags = []
        const known = d.known ?? KNOWN_SOURCES.includes(d.source)
        if (!known) flags.push(`Source ${d.source} is not on the allow-list`)
        const odd = d.hour >= c.remote.oddFrom || d.hour < c.remote.oddTo
        if (odd) flags.push(`Issued at ${hh(d.hour)}, outside the ${hh(c.remote.oddTo)}–${hh(c.remote.oddFrom)} operating window`)
        const bulk = d.count >= c.remote.bulkCount
        if (bulk) flags.push(`Bulk request: ${d.count} lights in one command (limit ${c.remote.bulkCount - 1})`)
        if (flags.length) {
          const zone = ev.zone || LIGHT_BY_ID[ev.assetId]?.zone
          out.raised.push(this._det('R2', ev.assetId, zone, 'lighting', bulk ? 3 : SERVICES.lighting.impact,
            2 + flags.length, flags, ev))
        }
        break
      }
      // R3 ── possible unauthorized access attempts on light controllers
      case 'light.access': {
        if (d.result !== 'denied') break
        const a = this._push(`unauth:${ev.assetId}`, ev.ts, d.source, c.unauthorized.windowMs)
        if (a.length >= c.unauthorized.attempts) {
          const light = LIGHT_BY_ID[ev.assetId]
          const srcs = [...new Set(a.map(x => x.v))]
          out.raised.push(this._det('R3', ev.assetId, light.zone, 'lighting', SERVICES.lighting.impact,
            3 + (a.length >= c.unauthorized.attempts * 2 ? 1 : 0),
            [`${a.length} denied access attempts in ${c.unauthorized.windowMs / 1000} s on ${ev.assetId} (threshold ≥${c.unauthorized.attempts})`,
             `Source${srcs.length > 1 ? 's' : ''}: ${srcs.join(', ')}`], ev))
        }
        break
      }
      // R4 + R5 ── server logins
      case 'server.login': {
        const srv = SERVER_BY_ID[ev.assetId]
        const svc = SERVICES[srv.service]
        if (!d.ok) {
          const a = this._push(`fail:${ev.assetId}`, ev.ts, d, c.bruteForce.windowMs)
          if (a.length >= c.bruteForce.fails) {
            const users = [...new Set(a.map(x => x.v.user))]
            const locs = [...new Set(a.map(x => x.v.location))]
            out.raised.push(this._det('R4', ev.assetId, null, srv.service, svc.impact,
              3 + (a.length >= c.bruteForce.fails * 2 ? 1 : 0),
              [`${a.length} failed logins in ${c.bruteForce.windowMs / 60000} min on ${ev.assetId} (threshold ≥${c.bruteForce.fails})`,
               `Accounts tried: ${users.join(', ')}`, `Origin: ${locs.join(', ')}`], ev))
          }
        }
        const flags = []
        if (!d.knownLocation) flags.push(`New location: ${d.location}`)
        if (!d.knownDevice) flags.push(`New device: ${d.device}`)
        if (d.hour >= c.remote.oddFrom || d.hour < c.remote.oddTo) flags.push(`Odd hour: ${hh(d.hour)}`)
        if (flags.length) {
          out.raised.push(this._det('R5', ev.assetId, null, srv.service, svc.impact,
            2 + (flags.length >= 2 ? 1 : 0) + (d.ok ? 1 : 0),
            [`${d.ok ? 'SUCCESSFUL' : 'Failed'} login as "${d.user}" at ${t8(ev.ts)}`, ...flags], ev))
        }
        break
      }
      // R6 ── sudden request-volume spike (>3× baseline)
      case 'server.metrics': {
        const srv = SERVER_BY_ID[ev.assetId]
        const ratio = d.rps / srv.baseline
        const key = `R6:${ev.assetId}`
        if (d.rps > 0 && ratio > c.spike.multiplier) {
          out.raised.push(this._det('R6', ev.assetId, null, srv.service, SERVICES[srv.service].impact,
            3 + (ratio >= 5 ? 1 : 0) + (ratio >= 8 ? 1 : 0),
            [`${Math.round(d.rps)} req/s vs baseline ${srv.baseline} req/s = ${ratio.toFixed(1)}× (threshold >${c.spike.multiplier}×)`], ev))
        } else if (ratio < c.spike.clearBelow) out.cleared.push(key)
        break
      }
      // R7 ── critical city service becoming unavailable
      case 'server.status': {
        const srv = SERVER_BY_ID[ev.assetId]
        if (!d.up) {
          out.raised.push(this._det('R7', ev.assetId, null, srv.service, SERVICES[srv.service].impact, 5,
            [`Health probe failed on ${ev.assetId} (${srv.name})`, d.reason || 'No response from service endpoint',
             `Service affected: ${SERVICES[srv.service].label}`], ev))
        } else out.cleared.push(`R7:${ev.assetId}`)
        break
      }
    }
    return out
  }
}
