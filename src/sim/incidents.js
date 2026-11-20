// Incident = the human response to an alert. Pure logic (no store, no DOM).
import { SERVER_BY_ID, LIGHT_BY_ID } from './model.js'

export const STATUSES = ['New', 'Investigating', 'Contained', 'Resolved']
export const TEAMS = {
  lighting: 'Street Lighting Ops', water: 'Water Utility NOC', traffic: 'Traffic Control Centre',
  dispatch: 'Emergency Dispatch Supervisors', transit: 'Transit Operations',
}

export const targetOf = a =>
  SERVER_BY_ID[a.assetId] ? { type: 'server', id: a.assetId } : { type: 'zone', id: a.zone || LIGHT_BY_ID[a.assetId]?.zone }

// Ticking steps drives the lifecycle:  any step → Investigating · isolate → Contained · all four → Resolved.
export function statusFrom(steps) {
  const done = id => steps.find(s => s.id === id).done
  if (steps.every(s => s.done)) return 'Resolved'
  if (done('isolate')) return 'Contained'
  if (steps.some(s => s.done)) return 'Investigating'
  return 'New'
}

export function buildIncident(alert, seq, now = Date.now()) {
  const target = targetOf(alert), svc = alert.service, team = TEAMS[svc.id] || 'On-call team'
  const outage = alert.code === 'R7'
  const where = target.type === 'zone' ? `Zone ${target.id}` : target.id
  const step = (id, label, hint, logText, extra = {}) => ({ id, label, hint, logText, done: false, ts: null, ...extra })
  return {
    id: `INC-${String(seq).padStart(4, '0')}`, key: alert.key, code: alert.code, title: alert.title,
    assetId: alert.assetId, zone: alert.zone, service: svc, severity: alert.severity, score: alert.score,
    target, openedTs: now, resolvedTs: null, status: 'New',
    steps: [
      step('isolate', target.type === 'zone' ? `Isolate Zone ${target.id} behind a micro-perimeter` : `Isolate ${target.id} from the network`,
        'Zero Trust: segment the affected test asset so the activity cannot spread.', `Isolated ${where} (micro-perimeter active)`),
      step('notify', `Notify ${team}`, 'Page the responsible team with the evidence.', `Notified ${team}`),
      step('continuity', outage ? `Fail over ${svc.label} to the standby node` : `Verify ${svc.label} continuity`,
        outage ? 'Standby takes over and the service is restored.' : 'Confirm the public service keeps running on its backup path.',
        outage ? `Failover complete: ${svc.label} restored on standby` : `Verified ${svc.label} continuity on backup path`),
      step('record', 'Record the incident', 'Write the closing note to the audit log.', 'Incident recorded and closed', { requires: ['isolate', 'notify', 'continuity'] }),
    ],
  }
}

/** zones/servers currently behind a micro-perimeter: isolate step done and incident not yet resolved */
export function isolatedFrom(incidents) {
  const zones = new Set(), servers = new Set()
  for (const i of incidents) {
    if (i.status === 'Resolved' || !i.steps.find(s => s.id === 'isolate').done) continue
    ;(i.target.type === 'zone' ? zones : servers).add(i.target.id)
  }
  return { zones: [...zones], servers: [...servers] }
}

/** assets running on a backup path: "continuity" step done and incident not yet resolved (failback happens on resolve) */
export function continuityFrom(incidents) {
  const zones = new Set(), servers = new Set()
  for (const i of incidents) {
    if (i.status === 'Resolved' || !i.steps.find(s => s.id === 'continuity').done) continue
    ;(i.target.type === 'zone' ? zones : servers).add(i.target.id)
  }
  return { zones: [...zones], servers: [...servers] }
}
