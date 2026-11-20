// Which public services stay up during an incident, and on which path. Pure.
import { SERVICES, SERVERS, ZONES, BACKUPS, SERVICE_ORDER } from './model.js'

// state: 'operational' | 'standby' (running on its backup path, still serving the public) | 'degraded' | 'down'
export function serviceStates({ alerts, servers, status, isolated, continuity }) {
  return SERVICE_ORDER.map(id => {
    const svc = SERVICES[id], b = BACKUPS[id]
    const srv = SERVERS.find(s => s.service === id)
    let state = 'operational', reason = 'Primary path healthy', depends = srv ? srv.id : 'Zones A · B · C'
    if (srv) {
      const down = !servers[srv.id].up
      const onBackup = continuity.servers.includes(srv.id) || isolated.servers.includes(srv.id)
      const mine = alerts.filter(a => a.assetId === srv.id)
      if (down && !onBackup) { state = 'down'; reason = `${srv.id} not responding. Failover needed` }
      else if (onBackup) { state = 'standby'; reason = `Isolated or failed over: ${b.backup} is serving` }
      else if (mine.some(a => a.severity === 'critical' || a.code === 'R6')) { state = 'degraded'; reason = `Under attack: ${mine[0].title}` }
      else if (mine.length) reason = `Watching: ${mine[0].title} (service unaffected)`
    } else {
      const zs = ZONES.map(z => z.id)
      const iso = zs.filter(z => isolated.zones.includes(z) || continuity.zones.includes(z))
      const bad = zs.filter(z => status.zones[z] === 'critical' && !iso.includes(z))
      if (bad.length) { state = 'degraded'; reason = `Zone ${bad.join(', ')} under attack` }
      else if (iso.length) { state = 'standby'; reason = `Zone ${iso.join(', ')} isolated; lights run on their local schedule` }
    }
    const onBackup = state === 'standby'
    return { id, label: svc.label, impact: svc.impact, state, reason, depends, onBackup, ...b }
  })
}

export const operationalCount = list => list.filter(s => s.state === 'operational' || s.state === 'standby').length
