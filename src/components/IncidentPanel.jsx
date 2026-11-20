import { useCitadel } from '../store'
import { STATUSES } from '../sim/incidents'
import { fmtTime } from '../lib/format'
import StatusGlyph from './StatusGlyph'

// Per-incident response checklist. Ticking is one-way (it is written to the append-only audit log).
export default function IncidentPanel() {
  const incidents = useCitadel(s => s.incidents)
  const alerts = useCitadel(s => s.alerts)
  const selId = useCitadel(s => s.selIncident)
  const auditCount = useCitadel(s => s.audit.length)
  const inc = incidents.find(i => i.id === selId) || incidents[0]
  const open = incidents.filter(i => i.status !== 'Resolved')
  const { tickStep, selectIncident } = useCitadel.getState()

  if (!inc) return <div className="inc-empty">No incident yet. Run a scenario, or wait for a detection. Each alert opens an incident with a response checklist.</div>
  const stIdx = STATUSES.indexOf(inc.status)
  const score = alerts.find(a => a.key === inc.key)?.score ?? inc.score          // live: urgency can rise after the incident opens
  const nextId = inc.steps.find(x => !x.done && (!x.requires || x.requires.every(r => inc.steps.find(y => y.id === r).done)))?.id
  const doneN = inc.steps.filter(s => s.done).length

  return (
    <div className="inc">
      {incidents.length > 1 && (
        <div className="inc-chips" role="tablist" aria-label="Incidents">
          {incidents.slice(0, 8).map(i => (
            <button key={i.id} role="tab" aria-selected={i.id === inc.id} data-on={i.id === inc.id} data-done={i.status === 'Resolved'} onClick={() => selectIncident(i.id)}>
              {i.id.slice(4)}<StatusGlyph status={i.status === 'Resolved' ? 'normal' : i.severity} size={9} />
            </button>
          ))}
          <span className="eyebrow">{open.length} open</span>
        </div>
      )}
      <div className="inc-head" data-s={inc.severity}>
        <div>
          <div className="eyebrow">{inc.id} · RULE {inc.code}</div>
          <div className="inc-title"><StatusGlyph status={inc.severity} size={13} /> {inc.title}</div>
          <div className="inc-sub">{inc.assetId} · {inc.service.label} · priority {score}</div>
        </div>
      </div>
      <ol className="lifecycle" aria-label={`Status: ${inc.status}`}>
        {STATUSES.map((s, i) => <li key={s} data-done={i < stIdx} data-cur={i === stIdx}>{s}</li>)}
      </ol>
      <ul className="steps">
        {inc.steps.map((st, i) => {
          const locked = !!st.requires && !st.requires.every(r => inc.steps.find(x => x.id === r).done) && !st.done
          return (
            <li key={st.id} data-done={st.done} data-locked={locked}>
              <button role="checkbox" aria-checked={st.done} disabled={st.done || locked} onClick={() => tickStep(inc.id, st.id)}>
                <span className="box" aria-hidden>{st.done && <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 6.5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}</span>
                <span className="st-main">
                  <b><i>{i + 1}</i> {st.label}</b>
                  {(st.done || st.id === nextId || locked) && <em>{st.done ? `Done ${fmtTime(st.ts)} · logged` : locked ? 'Complete the steps above first' : st.hint}</em>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="inc-foot">
        {inc.status === 'Resolved'
          ? <span className="resolved"><StatusGlyph status="normal" size={12} /> Resolved {fmtTime(inc.resolvedTs)} · sealed in audit log ({auditCount} entries)</span>
          : <span>{doneN}/4 steps · every action is hashed into the audit chain</span>}
      </div>
    </div>
  )
}
