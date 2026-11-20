import { useEffect } from 'react'
import { useCitadel } from '../store'
import ServerMonitor from './ServerMonitor'
import ZeroTrust from './ZeroTrust'
import Resilience from './Resilience'

const VIEWS = [['servers', 'SERVERS'], ['zerotrust', 'ZERO TRUST'], ['resilience', 'RESILIENCE']]
const TITLE = { servers: 'PUBLIC-SERVICE SERVER MONITOR', zerotrust: 'ZERO TRUST · FIVE PILLARS', resilience: 'RESILIENCE AND CONTINUITY' }

export function ViewBar() {
  const view = useCitadel(s => s.view)
  const setView = useCitadel.getState().setView
  return (
    <div className="zonebar views" role="group" aria-label="Views">
      {VIEWS.map(([id, label]) => <button key={id} className="zb" data-on={view === id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
    </div>
  )
}

export default function ViewDrawer({ inline = false }) {
  const view = useCitadel(s => s.view)
  useEffect(() => {
    if (inline) return
    const k = e => e.key === 'Escape' && useCitadel.getState().view && useCitadel.getState().setView(useCitadel.getState().view)
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [inline])
  const open = inline ? !!view : !!view
  return (
    <section className={`vdrawer panel ${inline ? 'inline' : ''}`} data-open={open} aria-hidden={!open} aria-label={view ? TITLE[view] : 'Views'}>
      {view && (
        <>
          <header className="vd-h">
            <div className="eyebrow brandy">{TITLE[view]}</div>
            <div className="vd-tabs" role="tablist">
              {VIEWS.map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} onClick={() => useCitadel.getState().openView(id)}>{label}</button>)}
            </div>
            {!inline && <button className="x-btn" onClick={() => useCitadel.getState().setView(view)}>ESC ✕</button>}
          </header>
          <div className="vd-body" key={view}>
            {view === 'servers' && <ServerMonitor />}
            {view === 'zerotrust' && <ZeroTrust />}
            {view === 'resilience' && <Resilience />}
          </div>
        </>
      )}
    </section>
  )
}
