// Holds active alerts: merges repeated detections, scores them, expires stale ones.
import { THRESHOLDS } from '../config.js'
import { SERVICES } from './model.js'
import { priority, severityOf } from './scoring.js'

export class AlertBook {
  constructor() { this.reset() }
  reset() { this.active = new Map(); this.history = []; this.seq = 0 }

  _score(a) { a.score = priority(a.impact, a.urgency); a.severity = severityOf(a.score) }

  /** @returns {{alert, isNew}} */
  upsert(d, now = Date.now()) {
    const ex = this.active.get(d.key)
    if (ex) {
      const before = ex.severity
      ex.count++; ex.lastTs = now; ex.evidence = d.evidence
      ex.urgency = Math.max(ex.urgency, d.urgency); ex.impact = Math.max(ex.impact, d.impact)
      this._score(ex)
      return { alert: { ...ex }, isNew: false, escalated: before === 'warning' && ex.severity === 'critical' }
    }
    const a = {
      id: `AL-${String(++this.seq).padStart(4, '0')}`, key: d.key, code: d.code, title: d.title, why: d.why,
      pillar: d.pillar, sticky: d.sticky, assetId: d.assetId, zone: d.zone,
      service: SERVICES[d.serviceId], impact: d.impact, urgency: d.urgency, evidence: d.evidence,
      count: 1, firstTs: now, lastTs: now, status: 'New',   // status = incident lifecycle (step 3)
    }
    this._score(a)
    this.active.set(a.key, a)
    return { alert: { ...a }, isNew: true }
  }

  clear(key, now = Date.now()) {
    const a = this.active.get(key)
    if (!a) return null
    this.active.delete(key)
    this.history.push({ ...a, clearedTs: now })
    return a
  }

  /** Containment: the alert cools down shortly after the asset is isolated (graceMs). */
  contain(key, now = Date.now(), graceMs = 8000) {
    const a = this.active.get(key)
    if (a) a.expireAt = now + graceMs
  }

  /** drop alerts with no fresh evidence for alertTtlMs (sticky ones stay unless contained). Returns the alerts removed. */
  sweep(now = Date.now()) {
    const gone = []
    for (const [k, a] of this.active) {
      const exp = a.expireAt ?? (a.sticky ? Infinity : a.lastTs + THRESHOLDS.alertTtlMs)
      if (now > exp) gone.push(this.clear(k, now))
    }
    return gone
  }

  list() {
    return [...this.active.values()].map(a => ({ ...a })).sort((x, y) => y.score - x.score || y.lastTs - x.lastTs)
  }
}
