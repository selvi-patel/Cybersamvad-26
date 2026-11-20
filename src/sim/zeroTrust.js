// Zero Trust view (CISA Zero Trust Maturity Model pillars; NIST SP 800-207 tenets).
// Maps each detection rule to a pillar and derives a live status. This is a prototype mapping, not a compliance assessment.
import { RULES } from './rules.js'

const RANK = { normal: 0, warning: 1, critical: 2 }
const worst = (a, b) => (RANK[b] > RANK[a] ? b : a)

export const PILLARS = [
  { id: 'identity',  name: 'Identity',                 tenets: '3 · 6', blurb: 'Every login and access request is authenticated and evaluated; no implicit trust.',
    controls: ['Failed-login tracking (5 in 2 min)', 'New location / device / hour checks', 'Denied-access tracking on light controllers'] },
  { id: 'devices',   name: 'Devices',                  tenets: '5',     blurb: 'Posture of every light and controller is monitored; unknown devices are not trusted.',
    controls: ['Remote-command allow-list', 'Bulk-command and odd-hour checks', 'On/off flicker detection'] },
  { id: 'networks',  name: 'Networks',                 tenets: '2',     blurb: 'Network location grants no trust. Affected zones are segmented into micro-perimeters.',
    controls: ['Per-zone micro-segmentation on isolate', 'Hostile traffic blocked at the perimeter', 'Request-volume baselines (3× rule)'] },
  { id: 'workloads', name: 'Applications & Workloads', tenets: '1 · 4', blurb: 'Public-service servers are health-probed; failover keeps the service available.',
    controls: ['Health probes on 4 critical services', 'Failover to standby on outage', 'Per-service impact weighting'] },
  { id: 'data',      name: 'Data',                     tenets: '1 · 7', blurb: 'Records of what happened are tamper-evident and exportable.',
    controls: ['SHA-256 hash-chained audit log', 'Chain re-verification on demand', 'CSV / JSON export for reporting'] },
]

export function evaluate({ alerts, isolated, auditVerify, blocked = 0 }) {
  return PILLARS.map(p => {
    const rules = Object.values(RULES).filter(r => r.pillar === p.id)
    const mine = alerts.filter(a => RULES[a.code]?.pillar === p.id)
    const signals = []                                                   // derived signals that are not rules of their own
    if (p.id === 'data') {
      if (!auditVerify.ok) signals.push({ severity: 'critical', text: `Audit chain broken at entry #${auditVerify.brokenAt}` })
      alerts.filter(a => a.code === 'R5' && a.evidence[0]?.startsWith('SUCCESSFUL'))
        .forEach(a => signals.push({ severity: 'warning', text: `Successful unusual login on ${a.assetId}: service data may be exposed` }))
    }
    const enforcing = []
    if (p.id === 'networks') {
      isolated.zones.forEach(z => enforcing.push(`Micro-perimeter active: Zone ${z}`))
      isolated.servers.forEach(s => enforcing.push(`Micro-perimeter active: ${s}`))
      if (blocked) enforcing.push(`${blocked} hostile event${blocked > 1 ? 's' : ''} blocked`)
    }
    const status = [...mine.map(a => a.severity), ...signals.map(s => s.severity)].reduce(worst, 'normal')
    return { ...p, rules, alerts: mine, signals, enforcing, status }
  })
}
