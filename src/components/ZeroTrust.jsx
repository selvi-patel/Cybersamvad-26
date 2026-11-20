import { useCitadel } from '../store'
import { evaluate } from '../sim/zeroTrust'
import { STATUS } from '../config'
import StatusGlyph from './StatusGlyph'

export default function ZeroTrust() {
  const alerts = useCitadel(s => s.alerts)
  const isolated = useCitadel(s => s.isolated)
  const auditVerify = useCitadel(s => s.auditVerify)
  const blocked = useCitadel(s => s.totals.blocked)
  const pillars = evaluate({ alerts, isolated, auditVerify, blocked })
  const active = pillars.filter(p => p.status !== 'normal').length
  const enforcing = pillars.some(p => p.enforcing.length)
  return (
    <>
      <p className="vnote"><b>{active}/5</b> pillars show detections{enforcing ? ' · micro-perimeters enforcing' : ''}. Mapped to the CISA Zero Trust Maturity Model pillars and NIST SP 800-207 tenets. A prototype mapping, not a compliance assessment.</p>
      <div className="vgrid cols5">
        {pillars.map((p, i) => (
          <article key={p.id} className="hcard zt" style={{ '--i': i }} data-s={p.status}>
            <span className="card-n display" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <header><h3 className="display">{p.name}</h3>
              <div className="zt-st" data-s={p.status}><StatusGlyph status={p.status} size={14} /> {STATUS[p.status].label}</div></header>
            <p className="zt-blurb">{p.blurb}</p>
            <div className="lab">DETECTIONS MAPPED HERE</div>
            <ul className="zt-rules">
              {p.rules.length === 0 && <li className="dimmer">Signals only (see below)</li>}
              {p.rules.map(r => {
                const hit = p.alerts.filter(a => a.code === r.code)
                return <li key={r.code} data-hit={hit.length > 0} data-s={hit[0]?.severity}><b>{r.code}</b> {r.title}{hit.length > 0 && <em>{hit.length} live</em>}</li>
              })}
            </ul>
            {(p.signals.length > 0 || p.enforcing.length > 0) && (
              <ul className="zt-sig">
                {p.signals.map((s, k) => <li key={k} data-s={s.severity}><StatusGlyph status={s.severity} size={11} /> {s.text}</li>)}
                {p.enforcing.map((e, k) => <li key={'e' + k} className="enf"><span className="enf-d" /> {e}</li>)}
              </ul>
            )}
            <div className="lab">CONTROLS IN PLACE</div>
            <ul className="zt-ctl">{p.controls.map(c => <li key={c}>{c}</li>)}</ul>
            <footer className="lab">NIST 800-207 · tenets {p.tenets}</footer>
          </article>
        ))}
      </div>
    </>
  )
}
