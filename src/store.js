// Zustand store + the simulation engine wiring
//   generator → (micro-perimeter filter) → detector → alert book → incidents → audit chain → UI state.
// The 3D scene reads this with useCitadel.getState() inside useFrame, so alert changes
// never force React re-renders of the canvas.
import { create } from 'zustand'
import { THRESHOLDS, UI } from './config'
import { LIGHTS, SERVERS, ZONES, INITIAL_OFFLINE, SERVER_BY_ID, LIGHT_BY_ID } from './sim/model'
import { EventGenerator } from './sim/generator'
import { Detector } from './sim/detector'
import { AlertBook } from './sim/alertBook'
import { SCENARIOS } from './sim/scenarios'
import { riskFrom } from './sim/scoring'
import { AuditChain } from './sim/audit'
import { buildIncident, statusFrom, isolatedFrom, continuityFrom } from './sim/incidents'
import { intro } from './lib/intro'

const RANK = { normal: 0, warning: 1, critical: 2 }
const worst = (a, b) => (RANK[b] > RANK[a] ? b : a)

const freshAssets = () => ({
  lights: Object.fromEntries(LIGHTS.map(l => [l.id, { id: l.id, zone: l.zone, lit: true, online: !INITIAL_OFFLINE.includes(l.id), lastToggle: 0 }])),
  servers: Object.fromEntries(SERVERS.map(s => [s.id, { id: s.id, up: true, rps: s.baseline, history: Array(30).fill(s.baseline), failTs: [], failedLogins: 0, samples: { up: 0, total: 0 } }])),
})
const calmStatus = () => ({
  lights: Object.fromEntries(LIGHTS.map(l => [l.id, 'normal'])),
  servers: Object.fromEntries(SERVERS.map(s => [s.id, 'normal'])),
  zones: Object.fromEntries(ZONES.map(z => [z.id, 'normal'])),
})
const NO_ISO = { zones: [], servers: [] }

// Derive per-asset status from the active alerts (colour + shape in the UI/3D follow this).
function deriveStatus(alerts, servers) {
  const st = calmStatus()
  for (const a of alerts) {
    if (LIGHT_BY_ID[a.assetId]) st.lights[a.assetId] = worst(st.lights[a.assetId], a.severity)
    else if (a.assetId.startsWith('ZONE-')) {                 // zone-wide alert → every light in the zone reacts
      const z = a.assetId.slice(5)
      LIGHTS.filter(l => l.zone === z).forEach(l => (st.lights[l.id] = worst(st.lights[l.id], a.severity)))
      st.zones[z] = worst(st.zones[z], a.severity)
    } else if (SERVER_BY_ID[a.assetId]) st.servers[a.assetId] = worst(st.servers[a.assetId], a.severity)
  }
  for (const l of LIGHTS) st.zones[l.zone] = worst(st.zones[l.zone], st.lights[l.id])
  for (const s of SERVERS) if (!servers[s.id].up) st.servers[s.id] = 'critical'
  return st
}

// Single engine instance per page load. The audit chain deliberately survives Reset.
const engine = { gen: null, det: new Detector(), book: new AlertBook(), audit: new AuditChain(), sweep: null, verifyT: null, incSeq: 0, openByKey: new Map() }

const sevOf = a => a?.severity ?? 'normal'
const log = f => {
  engine.audit.append({ ts: Date.now(), ...f }).then(() => {
    useCitadel.setState({ audit: engine.audit.entries })
    clearTimeout(engine.verifyT)                               // verify shortly after the last append
    engine.verifyT = setTimeout(() => useCitadel.getState().verifyAudit(), 350)
  })
}

export const useCitadel = create((set, get) => ({
  ...freshAssets(),
  status: calmStatus(),
  alerts: [],
  risk: riskFrom([]),
  feed: [],                          // newest first: {id, ts, type:'event'|'detection'|'blocked', ...}
  totals: { events: 0, detections: 0, blocked: 0 },
  newest: null,                      // last freshly raised alert (aria-live)
  focus: { type: 'home', id: null }, // camera target
  panelZone: null,                   // zone whose hinged panel is open
  railOpen: false,                   // left column (priority queue + response/events): retracted by default
  leafW: UI.leafW, sheetH: 56,       // user-resizable zone panel: leaf width (px, side hinge) · sheet height (vh, bottom sheet)
  selLight: null, selServer: null,
  running: false,
  bootStage: intro.enabled ? 0 : 99,  // intro progress: 1–4 = zone A, B, C, core powered · 5 = UI revealed · 99 = done

  incidents: [],                     // newest first
  selIncident: null,
  isolated: NO_ISO,                  // zones/servers behind a micro-perimeter (derived from incidents)
  continuity: NO_ISO,                // zones/servers running on their backup path (derived from incidents)
  view: null,                        // bottom drawer: 'servers' | 'zerotrust' | 'resilience'
  railTab: 'events',                 // lower-left panel: 'incident' | 'events'
  auto: { running: false, paused: false, rate: 1, caption: '', scene: '', n: 0, total: 0 },   // one-click auto demo (see lib/autodemo.js)
  demo: null,                        // {scenarioId, startedAt, stage 0–6, incidentId, incidentScore, target}
  audit: [], auditVerify: { ok: true, count: 0, brokenAt: null, checking: false }, auditOpen: false,

  // ── ingest one simulated event ─────────────────────────────────────────────
  ingest(ev) {
    const s = get()
    let { lights, servers } = s

    // Zero Trust micro-perimeter: hostile traffic aimed at an isolated zone/server never reaches the detector.
    if (ev.hostile) {
      const z = ev.assetId.startsWith('ZONE-') ? ev.assetId.slice(5) : LIGHT_BY_ID[ev.assetId]?.zone
      const blocked = z ? s.isolated.zones.includes(z) : s.isolated.servers.includes(ev.assetId)
      if (blocked) {
        const patch = { totals: { ...s.totals, blocked: s.totals.blocked + 1 } }
        if (!ev.quiet) patch.feed = [{ id: `b${ev.id}`, ts: ev.ts, type: 'blocked', ev }, ...s.feed].slice(0, 60)
        set(patch)
        return
      }
    }

    const d = ev.data
    switch (ev.kind) {
      case 'light.state': lights = { ...lights, [ev.assetId]: { ...lights[ev.assetId], lit: d.lit, lastToggle: ev.ts } }; break
      case 'light.fault': lights = { ...lights, [ev.assetId]: { ...lights[ev.assetId], online: d.online } }; break
      case 'server.metrics': {
        const sv = servers[ev.assetId]
        const samples = { up: sv.samples.up + (sv.up ? 1 : 0), total: sv.samples.total + 1 }          // availability = up samples / all samples
        servers = { ...servers, [ev.assetId]: { ...sv, rps: d.rps, history: [...sv.history.slice(-39), d.rps], samples } }; break
      }
      case 'server.status': servers = { ...servers, [ev.assetId]: { ...servers[ev.assetId], up: d.up } }; break
      case 'server.login': if (!d.ok) {
        const sv = servers[ev.assetId]
        const failTs = [...sv.failTs.filter(t => t > ev.ts - THRESHOLDS.bruteForce.windowMs), ev.ts]
        servers = { ...servers, [ev.assetId]: { ...sv, failTs, failedLogins: failTs.length } }
      } break
    }

    let demo = s.demo
    if (demo && demo.stage < 1 && ev.hostile && ev.ts >= demo.startedAt) demo = { ...demo, stage: 1 }          // 1 · event

    const { raised, cleared } = engine.det.ingest(ev)
    let newest = s.newest, feed = s.feed, detections = s.totals.detections
    let incidents = s.incidents, selIncident = s.selIncident, railTab = s.railTab
    let alertsChanged = false, becameRun = false
    for (const det of raised) {
      const { alert, isNew, escalated } = engine.book.upsert(det, ev.ts)
      alertsChanged = true
      if (escalated) log({ ts: ev.ts, assetId: alert.assetId, severity: alert.severity, event: `${alert.code} ${alert.title}`, action: `Escalated to CRITICAL · priority ${alert.score}`, operator: 'DETECTOR', status: 'Open' })
      if (!isNew) continue
      newest = alert; detections++
      feed = [{ id: `d${alert.id}`, ts: ev.ts, type: 'detection', alert }, ...feed]

      // every new alert opens an incident (or joins the one already open for the same rule+asset)
      let inc = incidents.find(i => i.id === engine.openByKey.get(alert.key))
      const reused = !!inc
      if (!inc) {
        inc = buildIncident(alert, ++engine.incSeq, ev.ts)
        engine.openByKey.set(alert.key, inc.id)
        incidents = [inc, ...incidents]
      }
      log({ ts: ev.ts, assetId: alert.assetId, severity: alert.severity, event: `${alert.code} ${alert.title}`,
            action: `Auto-detected · priority ${alert.score} (${alert.impact}×${alert.urgency}) · ${reused ? 'joined' : 'opened'} ${inc.id}`, operator: 'DETECTOR', status: inc.status })

      if (demo && demo.startedAt <= ev.ts && alert.score >= demo.incidentScore) {                          // track the run's headline incident
        const first = demo.stage < 2
        demo = { ...demo, stage: Math.max(demo.stage, 2), incidentId: inc.id, incidentScore: alert.score }   // 2 · rule fired
        selIncident = inc.id
        if (first) becameRun = true
      } else if (!selIncident) { selIncident = inc.id }
    }
    for (const key of cleared) {
      const a = engine.book.clear(key, ev.ts)
      if (a) {
        alertsChanged = true
        const inc = incidents.find(i => i.id === engine.openByKey.get(key))
        log({ ts: ev.ts, assetId: a.assetId, severity: 'normal', event: `${a.code} ${a.title}`, action: 'Condition ended · alert cleared', operator: 'DETECTOR', status: inc?.status ?? '—' })
      }
    }

    if (!ev.quiet) feed = [{ id: `e${ev.id}`, ts: ev.ts, type: 'event', ev }, ...feed]
    const patch = { lights, servers, feed: feed.slice(0, 60), newest, demo, incidents, selIncident, railTab, totals: { ...s.totals, events: s.totals.events + 1, detections } }
    if (alertsChanged || ev.kind === 'server.status') Object.assign(patch, derive(servers))
    set(patch)

    if (becameRun) {                 // staged so the audience can follow: rule → 3D model → queue → checklist
      setTimeout(() => get().advance(3), 500)
      setTimeout(() => get().advance(4), 1000)
      setTimeout(() => get().setRailTab('incident'), 1300)
    }
  },

  advance(stage) { const d = get().demo; if (d && stage > d.stage) set({ demo: { ...d, stage } }) },

  // ── response checklist ─────────────────────────────────────────────────────
  tickStep(incId, stepId) {
    const s = get()
    const inc = s.incidents.find(i => i.id === incId)
    const step = inc?.steps.find(x => x.id === stepId)
    if (!step || step.done) return                                      // one-way: steps can't be un-ticked (audit trail)
    if (step.requires && !step.requires.every(r => inc.steps.find(x => x.id === r).done)) return
    const now = Date.now()
    const steps = inc.steps.map(x => (x.id === stepId ? { ...x, done: true, ts: now } : x))
    const status = statusFrom(steps)
    const next = { ...inc, steps, status, resolvedTs: status === 'Resolved' ? now : null }
    const incidents = s.incidents.map(i => (i.id === incId ? next : i))
    if (status === 'Resolved') engine.openByKey.delete(inc.key)

    let demo = s.demo
    if (demo?.incidentId === incId) demo = { ...demo, stage: Math.max(demo.stage, status === 'Resolved' ? 6 : 5) }   // 5 · checklist · 6 · logged
    set({ incidents, isolated: isolatedFrom(incidents), continuity: continuityFrom(incidents), demo })

    // side-effects (after set, because they may emit events re-entrantly)
    if (stepId === 'isolate') {
      if (inc.target.type === 'server') engine.gen?.setLoad(inc.target.id, 1)    // the surge no longer reaches the server
      engine.book.contain(inc.key, now)
    }
    if (stepId === 'continuity' && inc.code === 'R7') engine.gen?.setDown(inc.target.id, false)   // failover restores the service
    log({ ts: now, assetId: inc.assetId, severity: inc.severity, event: `${inc.id} ${inc.title}`,
          action: step.logText + (status === 'Resolved' ? ' · micro-perimeter lifted' : ''), operator: 'OPERATOR', status })
    if (status !== s.incidents.find(i => i.id === incId).status && status !== 'Resolved')
      log({ ts: now, assetId: inc.assetId, severity: inc.severity, event: `${inc.id} status change`, action: `${inc.status} → ${status}`, operator: 'SYSTEM', status })
    if (status === 'Resolved') log({ ts: now, assetId: inc.assetId, severity: 'normal', event: `${inc.id} status change`, action: `${inc.status} → Resolved`, operator: 'SYSTEM', status })
  },

  // ── audit log ──────────────────────────────────────────────────────────────
  async verifyAudit() {
    set({ auditVerify: { ...get().auditVerify, checking: true } })
    const v = await AuditChain.verify(engine.audit.entries)
    set({ auditVerify: { ...v, checking: false } })
  },
  toggleAudit: open => set(st => { const o = open ?? !st.auditOpen; return o ? { auditOpen: true, view: null } : { auditOpen: false } }),

  // ── lifecycle ──────────────────────────────────────────────────────────────
  start() {
    if (get().running) return
    engine.gen = engine.gen || new EventGenerator(ev => get().ingest(ev))
    engine.gen.start()
    engine.sweep = setInterval(() => {
      const s = get(), now = Date.now()
      const gone = engine.book.sweep(now)
      for (const a of gone) {
        const inc = s.incidents.find(i => i.id === engine.openByKey.get(a.key))
        log({ ts: now, assetId: a.assetId, severity: 'normal', event: `${a.code} ${a.title}`, action: inc?.steps.find(x => x.id === 'isolate').done ? 'Alert cooled after containment' : 'Alert cooled · no new evidence', operator: 'DETECTOR', status: inc?.status ?? '—' })
      }
      // keep the failed-login counters honest as the window slides
      let servers = s.servers, drift = false
      for (const sv of Object.values(s.servers)) {
        const failTs = sv.failTs.filter(t => t > now - THRESHOLDS.bruteForce.windowMs)
        if (failTs.length !== sv.failTs.length) { drift = true; servers = { ...servers, [sv.id]: { ...sv, failTs, failedLogins: failTs.length } } }
      }
      if (gone.length || drift) set({ ...(drift ? { servers } : {}), ...derive(servers) })
    }, 1000)
    set({ running: true })
  },
  stop() { engine.gen?.stop(); clearInterval(engine.sweep); set({ running: false }) },

  /** back to the calm state (the "Reset" button). The audit log is NOT cleared: it is append-only. */
  reset() {
    engine.gen?.reset(); engine.det.reset(); engine.book.reset(); engine.openByKey.clear()
    log({ assetId: '—', event: 'Simulation reset', action: 'Operator restored normal city state (open incidents abandoned)', operator: 'OPERATOR' })
    set({ ...freshAssets(), status: calmStatus(), alerts: [], risk: riskFrom([]), feed: [], newest: null,
          totals: { events: 0, detections: 0, blocked: 0 }, focus: { type: 'home', id: null }, panelZone: null, selLight: null, selServer: null,
          incidents: [], selIncident: null, isolated: NO_ISO, continuity: NO_ISO, demo: null, railTab: 'events', view: null })
    if (get().running) engine.gen.start()
  },

  runScenario(id) {
    if (!get().running) get().start()
    const sc = SCENARIOS[id]
    const target = sc.run(engine.gen)
    set({ focus: { type: target.type, id: target.id }, panelZone: null, railTab: 'events',
          demo: { scenarioId: id, startedAt: Date.now(), stage: 0, incidentId: null, incidentScore: 0, target } })
    log({ assetId: target.asset, event: `Simulation launched: ${sc.name}`, action: 'Operator triggered demo scenario', operator: 'OPERATOR' })
    return target
  },

  // ── selection / camera ─────────────────────────────────────────────────────
  selectZone: id => set({ focus: { type: 'zone', id }, panelZone: id, selLight: null, selServer: null, view: null }),
  selectServer: id => set({ focus: { type: 'server', id }, panelZone: null, selLight: null, selServer: id, view: 'servers', auditOpen: false }),
  /** open/close a bottom drawer view. Only one drawer (view or audit) and no zone panel at a time. */
  setView: v => get().openView(get().view === v ? null : v),
  openView: view => set(s => {
    return { view, panelZone: null, auditOpen: false, selLight: null,
             focus: view === 'servers' ? { type: 'server', id: s.selServer || SERVERS[0].id } : view ? { type: 'home', id: null } : s.focus }
  }),
  selectLight: id => set({ selLight: id }),
  selectIncident: id => set({ selIncident: id, railTab: 'incident' }),
  setRailTab: railTab => set({ railTab }),
  setRailOpen: railOpen => set({ railOpen }),
  setLeafW: w => set({ leafW: Math.round(Math.max(260, Math.min(w, 560, (innerWidth - 460) / 2))) }),
  setSheetH: h => set({ sheetH: Math.round(Math.max(28, Math.min(h, 88))) }),
  setAuto: patch => set(s => ({ auto: { ...s.auto, ...patch } })),
  goHome: () => set({ focus: { type: 'home', id: null }, panelZone: null, selLight: null, selServer: null, view: null }),
}))

function derive(servers) {
  const alerts = engine.book.list()
  return { alerts, status: deriveStatus(alerts, servers), risk: riskFrom(alerts) }
}

if (typeof window !== 'undefined') window.__citadel = { store: useCitadel, engine, SCENARIOS, AuditChain }
