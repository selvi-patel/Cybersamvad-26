import { useEffect, useRef } from 'react'
import { useCitadel } from '../store'
import { ZONE_BY_ID, lightsInZone } from '../sim/model'
import { STATUS, UI } from '../config'
import StatusGlyph from './StatusGlyph'
import { ago, useNow } from '../lib/format'

// Hinged side panel: two leaves that unfold like a foldable phone (CSS 3D, see .fold in index.css).
// mode="sheet" renders the same content flat (used below the 2D map on small screens).
export default function ZonePanel({ mode = 'fold' }) {
  const zid = useCitadel(s => s.panelZone)
  const status = useCitadel(s => (zid ? s.status.zones[zid] : 'normal'))
  const lights = useCitadel(s => s.lights)
  const lstat = useCitadel(s => s.status.lights)
  const alerts = useCitadel(s => s.alerts)
  const selLight = useCitadel(s => s.selLight)
  const leafW = useCitadel(s => s.leafW)
  const sheetH = useCitadel(s => s.sheetH)
  const drag = useRef(false)
  const now = useNow(1000)
  // panel size → CSS vars (side hinge uses --leaf-w, the bottom sheet uses --sheet-h)
  useEffect(() => {
    document.documentElement.style.setProperty('--leaf-w', leafW + 'px')
    document.documentElement.style.setProperty('--sheet-h', sheetH + 'vh')
  }, [leafW, sheetH])
  const side = () => innerWidth >= UI.foldMinWidth
  const resize = e => {
    if (!drag.current) return
    const s = useCitadel.getState()
    if (side()) s.setLeafW((innerWidth - e.clientX) / 2)          // both leaves share the width
    else s.setSheetH(((innerHeight - e.clientY) / innerHeight) * 100)
  }
  const handle = {
    onPointerDown: e => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault() },
    onPointerMove: resize,
    onPointerUp: e => { drag.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId) },
    onDoubleClick: () => { const s = useCitadel.getState(); s.setLeafW(UI.leafW); s.setSheetH(56) },
    onKeyDown: e => {
      const s = useCitadel.getState(), d = { ArrowLeft: 24, ArrowRight: -24, ArrowUp: 4, ArrowDown: -4 }[e.key]
      if (d === undefined) return
      e.preventDefault(); side() ? s.setLeafW(s.leafW + (e.key.startsWith('ArrowL') || e.key.startsWith('ArrowR') ? d : 0)) : s.setSheetH(s.sheetH + (e.key.startsWith('ArrowU') || e.key.startsWith('ArrowD') ? d : 0))
    },
  }
  const open = !!zid

  useEffect(() => {
    const k = e => e.key === 'Escape' && useCitadel.getState().goHome()
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])

  // keep content mounted during the fold-out so it can animate closed
  const z = ZONE_BY_ID[zid || 'A']
  const ls = lightsInZone(z.id)
  const za = alerts.filter(a => a.zone === z.id)
  const isolated = useCitadel(s => s.isolated.zones.includes(z.id))
  const online = ls.filter(l => lights[l.id].online).length
  const flagged = ls.filter(l => lstat[l.id] !== 'normal').length

  const summary = (
    <div className="leaf-in">
      <div className="leaf-top">
        <div className="eyebrow">ZONE DETAIL</div>
        <button className="x-btn" onClick={() => useCitadel.getState().goHome()} aria-label="Close zone panel (Esc)">ESC ✕</button>
      </div>
      <h2 className="display zone-big">ZONE<br /><span>{z.id}</span></h2>
      <div className="zone-name">{z.name}</div>
      <div className="zone-status" data-s={status}>
        <StatusGlyph status={status} size={20} /> <b>{STATUS[status].label}</b>
      </div>
      {isolated && <div className="perimeter">MICRO-PERIMETER ACTIVE · zone segmented from the rest of the network</div>}
      <dl className="stats">
        <div><dt>Lights online</dt><dd className="display">{online}<small>/{ls.length}</small></dd></div>
        <div><dt>Offline</dt><dd className="display">{ls.length - online}</dd></div>
        <div><dt>Flagged</dt><dd className="display">{flagged}</dd></div>
        <div><dt>Open alerts</dt><dd className="display">{za.length}</dd></div>
      </dl>
      <div className="eyebrow sp">RELATED ALERTS</div>
      <ul className="mini-alerts">
        {za.length === 0 && <li className="none">None. Zone nominal.</li>}
        {za.map(a => (
          <li key={a.id} data-s={a.severity}>
            <StatusGlyph status={a.severity} size={12} />
            <span><b>{a.title}</b><i>{a.assetId} · {a.code} · {ago(now - a.lastTs)}</i></span>
            <em className="display">{a.score}</em>
          </li>
        ))}
      </ul>
    </div>
  )

  const table = (
    <div className="leaf-in">
      <div className="eyebrow">STREETLIGHTS · {z.id}</div>
      <table className="lights">
        <thead><tr><th>ID</th><th>Lamp</th><th>Link</th><th>Status</th></tr></thead>
        <tbody>
          {ls.map(l => {
            const st = lights[l.id], s = lstat[l.id]
            return (
              <tr key={l.id} data-s={s} data-sel={selLight === l.id} onClick={() => useCitadel.getState().selectLight(l.id)}
                  tabIndex={0} onKeyDown={e => e.key === 'Enter' && useCitadel.getState().selectLight(l.id)}>
                <td>{l.id}</td>
                <td>{st.lit ? 'ON' : 'OFF'}</td>
                <td className={st.online ? '' : 'off'}>{st.online ? 'ONLINE' : 'OFFLINE'}</td>
                <td><StatusGlyph status={s} size={12} /> {STATUS[s].label}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint">Select a row to highlight the light in the model. Shapes repeat the colour: ● normal ▲ warning ⯃ critical.</p>
    </div>
  )

  if (mode === 'sheet') return open ? <section className="panel sheet">{summary}{table}</section> : null

  return (
    <aside className={`fold ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Zone detail">
      <div className="resizer" role="separator" tabIndex={open ? 0 : -1} aria-label="Resize zone panel: drag, or use arrow keys. Double-click to reset"
             aria-orientation={side() ? 'vertical' : 'horizontal'} data-cursor="drag" data-cursor-label="RESIZE" {...handle}><i /></div>
      <div className="leaf leaf-a panel">
        <div className="leaf-scroll">{summary}</div>
        <div className="leaf leaf-b panel"><div className="leaf-scroll">{table}</div></div>
      </div>
    </aside>
  )
}
