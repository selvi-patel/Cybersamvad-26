// Simulated event source. Emits one "primary" event every 1–3 s (plus quiet telemetry),
// and exposes a small control API that scenarios use to inject attacks.
// Everything here is local & synthetic — no network, no scanning.
import { TICK } from '../config.js'
import { mkEvent } from './events.js'
import { LIGHTS, SERVERS, ZONES, KNOWN_SOURCES, KNOWN_LOCATIONS, INITIAL_OFFLINE, SERVER_BY_ID } from './model.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

export class EventGenerator {
  constructor(emit) {
    this.emit = emit
    this.timers = new Set()
    this.running = false
    this.reset()
  }

  reset() {
    this.stop()
    this.lit = Object.fromEntries(LIGHTS.map(l => [l.id, true]))
    this.online = Object.fromEntries(LIGHTS.map(l => [l.id, !INITIAL_OFFLINE.includes(l.id)]))
    this.lastToggle = {}
    this.load = Object.fromEntries(SERVERS.map(s => [s.id, 1]))   // multiplier on baseline
    this.down = Object.fromEntries(SERVERS.map(s => [s.id, false]))
    this.t0 = Date.now()
  }

  start() {
    if (this.running) return
    this.running = true
    this._tick()
  }

  stop() {
    this.running = false
    this.timers.forEach(clearTimeout)
    this.timers.clear()
  }

  /** schedule fn after ms; tracked so reset() cancels running scenarios */
  at(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); fn() }, ms)
    this.timers.add(t)
  }

  // ── control API used by scenarios ──────────────────────────────────────────
  // `hostile` marks scenario traffic: a micro-perimeter (isolation) blocks hostile events before detection.
  toggle(lightId, source = 'scheduler', hostile = false) {
    this.lit[lightId] = !this.lit[lightId]
    this.lastToggle[lightId] = Date.now()
    this.emit(mkEvent('light.state', lightId, { lit: this.lit[lightId], source }, { hostile }))
  }
  setLoad(serverId, mult) { this.load[serverId] = mult; this._metrics(serverId) }
  setDown(serverId, isDown, reason) {
    this.down[serverId] = isDown
    this.emit(mkEvent('server.status', serverId, { up: !isDown, reason }, { hostile: isDown }))
    this._metrics(serverId)
  }

  // ── background "city is fine" traffic ──────────────────────────────────────
  _tick() {
    if (!this.running) return
    this._primary()
    SERVERS.forEach(s => this._metrics(s.id))
    const t = setTimeout(() => { this.timers.delete(t); this._tick() }, rnd(TICK.minMs, TICK.maxMs))
    this.timers.add(t)
  }

  _metrics(id) {
    const s = SERVER_BY_ID[id]
    const drift = 1 + 0.12 * Math.sin((Date.now() - this.t0) / 9000 + s.baseline) + rnd(-0.06, 0.06)
    const rps = this.down[id] ? 0 : Math.max(1, s.baseline * drift * this.load[id])
    this.emit(mkEvent('server.metrics', id, { rps }, { quiet: true, hostile: this.load[id] > 1.5 }))
  }

  _primary() {
    const r = Math.random()
    const now = Date.now()
    if (r < 0.26) {                                   // routine dimming/switching, never fast enough to look like flicker
      const l = pick(LIGHTS.filter(l => this.online[l.id] && now - (this.lastToggle[l.id] || 0) > 45_000))
      if (l) this.toggle(l.id, 'scheduler')
    } else if (r < 0.40) {                            // routine remote command from a known console
      const l = pick(LIGHTS)
      this.emit(mkEvent('light.remote', l.id, { source: pick(KNOWN_SOURCES), known: true, hour: Math.floor(rnd(7, 21)), count: 1 + Math.floor(rnd(0, 3)) }, { zone: l.zone }))
    } else if (r < 0.50) {                            // routine authenticated access
      const l = pick(LIGHTS)
      this.emit(mkEvent('light.access', l.id, { result: 'ok', source: pick(KNOWN_SOURCES) }, { zone: l.zone }))
    } else if (r < 0.54) {                            // maintenance: light drops off / returns to the network
      const l = pick(LIGHTS)
      const offlineNow = LIGHTS.filter(x => !this.online[x.id]).length
      if (this.online[l.id] ? offlineNow < 3 : true) {
        this.online[l.id] = !this.online[l.id]
        this.emit(mkEvent('light.fault', l.id, { online: this.online[l.id] }, { zone: l.zone }))
      }
    } else {                                          // routine server login; ~1 in 9 is a harmless typo
      const s = pick(SERVERS)
      this.emit(mkEvent('server.login', s.id, {
        user: pick(['ops.martin', 'ops.ito', 'svc-backup', 'eng.rao']), ok: Math.random() > 0.11,
        location: pick(KNOWN_LOCATIONS), device: pick(['NOC-WS-01', 'NOC-WS-02', 'DEPOT-LT-04']),
        knownLocation: true, knownDevice: true, hour: Math.floor(rnd(7, 21)),
      }))
    }
  }
}
