import { useCitadel } from '../store'
import { serviceStates, operationalCount } from '../sim/resilience'
import StatusGlyph from './StatusGlyph'

const STATE = {
  operational: { glyph: 'normal', label: 'OPERATIONAL' }, standby: { glyph: 'normal', label: 'OPERATIONAL · ON BACKUP' },
  degraded: { glyph: 'warning', label: 'DEGRADED' }, down: { glyph: 'critical', label: 'DOWN' },
}

export default function Resilience() {
  const st = useCitadel()
  const list = serviceStates({ alerts: st.alerts, servers: st.servers, status: st.status, isolated: st.isolated, continuity: st.continuity })
  const n = operationalCount(list)
  const incident = st.incidents.some(i => i.status !== 'Resolved') || st.alerts.length > 0
  return (
    <>
      <div className="res-head">
        <b className="display big">{n}<small>/{list.length}</small></b>
        <p>{n === list.length
          ? (incident ? 'public services still serving residents while the incident is worked. Failover and fail-safe paths are doing their job.' : 'public services operational. No incident in progress.')
          : `public services operational. ${list.length - n} need attention: ${list.filter(s => s.state === 'down' || s.state === 'degraded').map(s => s.label).join(', ')}.`}</p>
      </div>
      <div className="vgrid cols5">
        {list.map((s, i) => {
          const m = STATE[s.state]
          return (
            <article key={s.id} className="hcard res" style={{ '--i': i }} data-s={m.glyph} data-state={s.state}>
              <header><StatusGlyph status={m.glyph} size={15} /><div><b>{s.label}</b><span>{s.depends} · impact {s.impact}/5</span></div></header>
              <div className="res-state" data-s={m.glyph}>{m.label}</div>
              <p className="res-why">{s.reason}</p>
              <div className="path" aria-label={`Active path: ${s.onBackup ? 'backup' : 'primary'}`}>
                <div data-on={!s.onBackup && s.state !== 'down'}><span>PRIMARY</span><i>{s.depends.startsWith('SRV') ? s.depends : 'Central controller'}</i></div>
                <svg viewBox="0 0 24 10" width="24" height="10" aria-hidden><path d="M0 5h20M16 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
                <div data-on={s.onBackup}><span>BACKUP</span><i>{s.mode}</i></div>
              </div>
              <dl className="res-facts">
                <div><dt>Backup</dt><dd>{s.backup}</dd></div>
                <div><dt>Switch-over</dt><dd>{s.rto}</dd></div>
                <div><dt>Manual fallback</dt><dd>{s.manual}</dd></div>
              </dl>
            </article>
          )
        })}
      </div>
    </>
  )
}
