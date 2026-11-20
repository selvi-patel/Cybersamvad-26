// One-click guided demo. Drives the REAL app: launches the real scenarios, waits for the real detections,
// ticks the real checklist steps, opens the real drawers. Nothing is faked, so what judges see is what the app does.
// Pacing: edit the sleep() values (ms). ?demospeed=2 plays it at double speed (handy while developing).
import { useCitadel } from '../store'

// PACE slows every pause for reading/explaining (2 = twice as long as the original script). The on-screen speed button
// multiplies it: 0.7× slower … 1.5× faster. ?demospeed=2 still works as an extra multiplier for rehearsals.
const PACE = 2.2
const urlSpeed = Number(new URLSearchParams(location.search).get('demospeed')) || 1
const RATES = [1, 0.7, 0.5, 1.5]            // normal → slower → slowest → faster
const rate = () => (useCitadel.getState().auto.rate || 1) * urlSpeed / PACE
class Abort extends Error {}
let current = null

const S = () => useCitadel.getState()
const say = text => S().setAuto({ caption: text })
const tick = ms => new Promise(r => setTimeout(r, ms))
// sleep() burns "demo time": it stops while paused and follows the speed button live
async function sleep(t, ms) {
  let left = ms
  while (left > 0) {
    if (t.cancelled) throw new Abort()
    if (S().auto.paused) { await tick(100); continue }
    left -= 50 * rate(); await tick(50)
  }
  if (t.cancelled) throw new Abort()
}
async function until(t, cond, timeout = 20000) {
  const end = performance.now() + timeout
  while (!cond() && performance.now() < end) {
    if (t.cancelled) throw new Abort()
    await tick(120)
  }
  if (t.cancelled) throw new Abort()
  while (S().auto.paused) { if (t.cancelled) throw new Abort(); await tick(100) }
}

// ── the operator's checklist, ticked on screen with a caption per step ────────
const CAP = {
  isolate: d => (d.target.type === 'zone'
    ? `Step 1 · Isolate Zone ${d.target.id}. A Zero Trust micro-perimeter rises and hostile traffic is blocked at its boundary.`
    : `Step 1 · Isolate ${d.target.id}. Segmenting it stops the attack reaching the public service.`),
  notify: () => 'Step 2 · Notify the responsible team with the evidence attached.',
  continuity: d => (d.scenarioId === 'outage' ? 'Step 3 · Fail over to the standby node. The service is restored.' : 'Step 3 · Verify the public service keeps running on its backup path.'),
  record: () => 'Step 4 · Record the incident. Every action is hashed into the audit chain.',
}
async function work(t, hooks = {}) {
  const id = S().demo?.incidentId
  if (!id) return
  for (const step of ['isolate', 'notify', 'continuity', 'record']) {
    say(CAP[step](S().demo)); await sleep(t, 1800)
    S().tickStep(id, step)
    await hooks[step]?.()
    await sleep(t, 1900)
  }
}
const detected = t => until(t, () => (S().demo?.stage ?? 0) >= 4)

const SCENES = [
  { name: 'Streetlight flicker', async run(t) {
    S().reset(); await sleep(t, 1500)
    say('A normal day: routine events stream in and nothing is flagged. Everything here is simulated.'); await sleep(t, 3200)
    say('Attack 1 · One streetlight is switched on and off rapidly by an unknown controller.')
    S().runScenario('flicker'); await detected(t)
    say('Rule R1 fired. The zone reacts in the 3D model and the alert joins the priority queue with its evidence.'); await sleep(t, 4200)
    await work(t, { isolate: async () => { await sleep(t, 1500); const b = S().totals.blocked; if (b) say(`${b} hostile event${b > 1 ? 's' : ''} blocked at the micro-perimeter.`) } })
    say('Incident resolved. The perimeter lifts and the whole case is in the audit log.'); await sleep(t, 2800)
  } },
  { name: 'Brute-force login', async run(t) {
    S().reset(); await sleep(t, 1500)
    say('Attack 2 · Rapid failed logins hit a critical server from an unrecognised location.')
    S().runScenario('bruteforce'); await detected(t)
    S().openView('servers')
    say('Rules R4 and R5 fired. The server monitor shows the failed-login counter and health dropping.'); await sleep(t, 4800)
    await work(t, {
      isolate: async () => { S().openView('zerotrust'); say('Zero Trust view: failed logins map to Identity, and the isolation shows under Networks.'); await sleep(t, 4800) },
    })
    S().openView(null); await sleep(t, 1200)
  } },
  { name: 'Service outage', async run(t) {
    S().reset(); await sleep(t, 1500)
    say('Attack 3 · The emergency dispatch server stops answering.')
    S().runScenario('outage'); await detected(t)
    S().openView('resilience')
    say('Critical service down. Resilience view: 4 of 5 public services are still operational.'); await sleep(t, 5000)
    await work(t, { continuity: async () => { say('Failover complete: all 5 public services are operational again, dispatch on its backup path.'); await sleep(t, 3000) } })
    S().openView(null); await sleep(t, 1000)
  } },
  { name: 'Audit trail', async run(t) {
    S().toggleAudit(true); await sleep(t, 800)
    await S().verifyAudit()
    const { audit, auditVerify: v } = S()
    say(`The audit log: ${audit.length} entries, each stored with the previous entry's SHA-256. Chain ${v.ok ? 'VERIFIED' : 'BROKEN'}. Export CSV or JSON for post-incident reports.`)
    await sleep(t, 8000)
  } },
]
export const AUTO_SCENES = SCENES.map(s => s.name)

export const autoDemo = {
  get running() { return !!current },
  start() {
    if (current) return
    const t = { cancelled: false }; current = t
    S().setRailOpen(true)                                 // the narrated checklist lives in the left column
    S().setAuto({ running: true, paused: false, caption: '', scene: SCENES[0].name, n: 1, total: SCENES.length })
    ;(async () => {
      try {
        for (let i = 0; i < SCENES.length; i++) { S().setAuto({ n: i + 1, scene: SCENES[i].name }); await SCENES[i].run(t) }
        S().toggleAudit(false); say('Demo complete. Run any scenario yourself, or press Reset.'); await sleep(t, 4500)
        S().setAuto({ running: false, caption: '' })
      } catch (e) { if (!(e instanceof Abort)) console.error(e) }
      finally { if (current === t) current = null }
    })()
  },
  togglePause() { if (current) S().setAuto({ paused: !S().auto.paused }) },
  cycleSpeed() { const r = S().auto.rate || 1; S().setAuto({ rate: RATES[(RATES.indexOf(r) + 1) % RATES.length] }) },
  stop() {
    if (!current) return
    current.cancelled = true; current = null
    S().setAuto({ running: false, paused: false, caption: 'Auto demo stopped. The city is left as it is.' })
    setTimeout(() => { if (!S().auto.running) S().setAuto({ caption: '' }) }, 2600)
  },
}
