import { useEffect, useRef } from 'react'
import { useCitadel } from '../store'
import { toCSV, toJSON, download } from '../sim/audit'
import StatusGlyph from './StatusGlyph'

const SEV = { normal: ['normal', 'INFO'], warning: ['warning', 'WARN'], critical: ['critical', 'CRIT'] }
const stamp = ts => { const d = new Date(ts); return `${d.toLocaleDateString('en-CA')} ${d.toTimeString().slice(0, 8)}` }

function Chain({ v }) {
  if (v.checking) return <span className="chain" data-s="normal">VERIFYING…</span>
  return v.ok
    ? <span className="chain" data-s="normal"><StatusGlyph status="normal" size={12} /> CHAIN VERIFIED · {v.count} entries · SHA-256</span>
    : <span className="chain" data-s="critical"><StatusGlyph status="critical" size={12} /> CHAIN BROKEN at entry #{v.brokenAt}</span>
}

/** compact card in the right rail: opens the drawer */
export function AuditChip() {
  const n = useCitadel(s => s.audit.length)
  const v = useCitadel(s => s.auditVerify)
  const head = useCitadel(s => s.audit.at(-1)?.hash)
  const open = useCitadel(s => s.auditOpen)
  return (
    <button className="audit-chip" data-s={v.ok ? 'normal' : 'critical'} aria-expanded={open} onClick={() => useCitadel.getState().toggleAudit()}>
      <span className="eyebrow">AUDIT LOG · IMMUTABLE</span>
      <span className="ac-row"><b className="display">{String(n).padStart(2, '0')}</b>
        <span className="ac-s"><StatusGlyph status={v.ok ? 'normal' : 'critical'} size={11} />{v.ok ? 'chain verified' : 'chain broken'}<i>{head ? `head ${head.slice(0, 10)}…` : 'no entries yet'}</i></span>
        <span className="ac-go">{open ? 'CLOSE' : 'OPEN'}</span></span>
    </button>
  )
}

export default function AuditLog({ inline = false }) {
  const entries = useCitadel(s => s.audit)
  const v = useCitadel(s => s.auditVerify)
  const open = useCitadel(s => s.auditOpen)
  const body = useRef(null)
  const shown = inline || open

  useEffect(() => { if (shown && body.current) body.current.scrollTop = body.current.scrollHeight }, [entries.length, shown])
  useEffect(() => {
    if (inline) return
    const k = e => e.key === 'Escape' && useCitadel.getState().toggleAudit(false)
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [inline])

  const file = ext => `citadel-audit-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`
  return (
    <section className={`audit panel ${inline ? 'inline' : 'drawer'}`} data-open={shown} aria-hidden={!shown} aria-label="Immutable incident audit log">
      <header className="audit-h">
        <div>
          <div className="eyebrow">IMMUTABLE INCIDENT AUDIT LOG</div>
          <div className="audit-sub">Append-only · each row stores the previous row's SHA-256 · no edit, no delete</div>
        </div>
        <Chain v={v} />
        <div className="audit-btns">
          <button className="btn" onClick={() => download(file('csv'), 'text/csv', toCSV(entries))} disabled={!entries.length}>EXPORT CSV</button>
          <button className="btn" onClick={() => download(file('json'), 'application/json', toJSON(entries, v))} disabled={!entries.length}>EXPORT JSON</button>
          <button className="btn ghost" onClick={() => useCitadel.getState().verifyAudit()}>RE-VERIFY</button>
          {!inline && <button className="x-btn" onClick={() => useCitadel.getState().toggleAudit(false)}>ESC ✕</button>}
        </div>
      </header>
      <div className="audit-body" ref={body} tabIndex={0}>
        <table className="audit-t">
          <thead><tr><th>#</th><th>Timestamp</th><th>Asset</th><th>Severity</th><th>Event / alert</th><th>Operator action</th><th>Status</th><th>Hash ← prev</th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan="8" className="none">No entries yet. Run a scenario: detections, checklist steps and resets are all recorded here.</td></tr>}
            {entries.map(e => {
              const [s, label] = SEV[e.severity] || SEV.normal
              return (
                <tr key={e.seq} data-s={s} data-broken={!v.ok && v.brokenAt === e.seq}>
                  <td>{e.seq}</td><td>{stamp(e.ts)}</td><td>{e.assetId}</td>
                  <td><StatusGlyph status={s} size={11} /> {label}</td>
                  <td>{e.event}</td><td>{e.action}<em>{e.operator}</em></td><td>{e.status}</td>
                  <td className="hash" title={`hash ${e.hash}\nprev ${e.prevHash}`}>{e.hash.slice(0, 10)}<i> ← {e.prevHash.slice(0, 6)}</i></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
