import { useEffect } from 'react'
import { useCitadel } from '../store'
import { autoDemo } from '../lib/autodemo'

// Narration for the one-click demo: scene progress, a caption of what is happening, and a STOP control.
export default function AutoCaption() {
  const a = useCitadel(s => s.auto)
  useEffect(() => {
    if (!a.running) return
    const k = e => {
      if (e.key === 'Escape') autoDemo.stop()
      // Space = pause/resume, wherever focus is (even on the AUTO DEMO button), except on the caption's own buttons
      else if (e.key === ' ' && !e.target.closest?.('.ac-in')) { e.preventDefault(); autoDemo.togglePause() }
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [a.running])
  if (!a.caption) return null
  return (
    <div className="autocap" role="status" aria-live="polite">
      <div className="ac-in">
        <div className="ac-top">
          <b>AUTO DEMO</b>
          {a.running && <span>{a.n}/{a.total} · {a.scene.toUpperCase()}</span>}
          {a.running && <i className="ac-prog" aria-hidden>{[...Array(a.total)].map((_, k) => <u key={k} data-on={k < a.n} />)}</i>}
          {a.running && (
            <span className="ac-ctl">
              <button className="btn" onClick={() => autoDemo.togglePause()} aria-pressed={a.paused}>{a.paused ? 'RESUME' : 'PAUSE'} · SPACE</button>
              <button className="btn" onClick={() => autoDemo.cycleSpeed()} title="Change pace">{({ 1: 'PACE 1×', 0.7: 'SLOWER', 0.5: 'SLOWEST', 1.5: 'FASTER' })[a.rate]}</button>
              <button className="btn" onClick={() => autoDemo.stop()}>STOP · ESC</button>
            </span>
          )}
        </div>
        <p className="ac-text">{a.caption}</p>
        {a.paused && <div className="ac-paused">PAUSED. Press Space or RESUME to continue.</div>}
      </div>
    </div>
  )
}
