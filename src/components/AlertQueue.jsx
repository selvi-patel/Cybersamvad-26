import { useState } from 'react'
import { useCitadel } from '../store'
import { SERVER_BY_ID, LIGHT_BY_ID } from '../sim/model'
import { fmtTime, ago, useNow } from '../lib/format'
import StatusGlyph from './StatusGlyph'

// Sorted by PRIORITY = IMPACT × URGENCY. Click a row to see WHY it was flagged.
export default function AlertQueue() {
  const alerts = useCitadel(s => s.alerts)
  const incidents = useCitadel(s => s.incidents)
  const selInc = useCitadel(s => s.selIncident)
  const [open, setOpen] = useState(null)
  const now = useNow(1000)
  const shown = alerts

  const jump = a => {
    const st = useCitadel.getState()
    if (SERVER_BY_ID[a.assetId]) st.selectServer(a.assetId)                              // flies to the racks + opens the server monitor
    else if (a.zone) { st.selectZone(a.zone); if (LIGHT_BY_ID[a.assetId]) st.selectLight(a.assetId) }   // flies to the zone, ringing the exact light
  }

  return (
    <section className="panel queue" aria-label="Alert priority queue">
      <header className="panel-h">
        <div>
          <div className="eyebrow">PRIORITY QUEUE</div>
          <div className="formula" title="Impact on public services (1–5) × urgency of the evidence (1–5)">
            PRIORITY = <b>IMPACT</b> × <b>URGENCY</b> <span>(1–25)</span>
          </div>
        </div>
        <div className="display count">{String(shown.length).padStart(2, '0')}</div>
      </header>
      <ol className="alerts" aria-live="polite">
        {shown.length === 0 && (
          <li className="empty"><StatusGlyph status="normal" size={16} /> No active alerts. All monitored assets nominal.</li>
        )}
        {shown.map(a => (
          <li key={`${a.id}:${a.firstTs}`} className="alert" data-s={a.severity} data-open={open === `${a.id}:${a.firstTs}`}>
            <button className="alert-row" aria-expanded={open === `${a.id}:${a.firstTs}`} onClick={() => {
              const k = `${a.id}:${a.firstTs}`
              setOpen(open === k ? null : k)
              const inc = incidents.find(i => i.key === a.key && i.status !== 'Resolved')
              if (inc) useCitadel.getState().selectIncident(inc.id)
            }}>
              <span className="score display">{a.score}</span>
              <span className="alert-main">
                <span className="alert-title">
                  <StatusGlyph status={a.severity} size={13} /> {a.title}
                  {a.count > 1 && <em className="x">×{a.count}</em>}
                </span>
                <span className="alert-meta">
                  <i className="svc">{a.service.label}</i> {a.assetId} · {a.code} · {ago(now - a.lastTs)}
                </span>
              </span>
              <span className="sev-col">
                <span className="sev">{a.severity === 'critical' ? 'CRIT' : 'WARN'}</span>
                {(() => { const inc = incidents.find(i => i.key === a.key && i.status !== 'Resolved'); return inc && <span className="inc-badge" data-sel={inc.id === selInc}>{inc.status.toUpperCase()}</span> })()}
              </span>
            </button>
            <button className="loc" onClick={() => jump(a)} aria-label={`Locate ${a.assetId} in the model`} title="Fly the camera to this asset">
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M6 0v3M6 9v3M0 6h3M9 6h3" stroke="currentColor" strokeWidth="1.3" /></svg> LOCATE
            </button>
            {open === `${a.id}:${a.firstTs}` && (
              <div className="why">
                <div className="eyebrow">WHY FLAGGED · RULE {a.code}</div>
                <p className="rule">{a.why}</p>
                <ul>{a.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                <div className="calc">{a.impact} impact × {a.urgency} urgency = <b>{a.score}</b></div>
                <div className="why-foot">
                  <span>First seen {fmtTime(a.firstTs)}</span>
                  <button className="link" onClick={() => jump(a)}>Locate in model →</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
