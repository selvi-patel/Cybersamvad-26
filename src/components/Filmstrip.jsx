import { useEffect, useRef } from 'react'
import { useCitadel } from '../store'
import { SCENARIOS } from '../sim/scenarios'
import { useTilt, useMagnet } from '../lib/fx'
import { smoothStrip } from '../lib/smooth'
import { autoDemo } from '../lib/autodemo'


function hint(demo, inc) {
  if (!demo) return 'Pick a scenario. One click plays the whole flow.'
  if (demo.stage < 1) return 'Injecting simulated events…'
  if (demo.stage < 2) return 'Events arriving. Detector is evaluating rules…'
  if (demo.stage < 5) return 'Rule fired. Watch the model and the priority queue.'
  if (demo.stage < 6) {
    const next = inc?.steps.find(s => !s.done && (!s.requires || s.requires.every(r => inc.steps.find(x => x.id === r).done)))
    return next ? `Work the checklist: ${next.label}` : 'Finish the checklist to close the incident.'
  }
  return 'Incident resolved and sealed in the audit log. Run another or reset.'
}

function Card({ sc, idx, active, onRun }) {
  const tilt = useTilt(9), mag = useMagnet(0.4)
  return (
    <article className="card" data-active={active} ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      <span className="card-n display" aria-hidden>{String(idx + 1).padStart(2, '0')}</span>
      <h3 className="card-t">{sc.name}</h3>
      <p className="card-b">{sc.blurb}</p>
      <div className="card-f">
        <span className="card-tags">{sc.rules.join(' · ')} <i>{sc.pillars}</i></span>
        <button className="run" ref={mag.ref} onPointerMove={mag.onPointerMove} onPointerLeave={mag.onPointerLeave}
                onClick={onRun} aria-label={`Run scenario: ${sc.name}`}>{active ? 'RUNNING' : 'RUN'}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><polygon points="1,1 9,5 1,9" fill="currentColor" /></svg></button>
      </div>
    </article>
  )
}

export default function Filmstrip() {
  const demo = useCitadel(s => s.demo)
  const inc = useCitadel(s => s.incidents.find(i => i.id === s.demo?.incidentId))
  const auto = useCitadel(s => s.auto.running)
  const booting = useCitadel(s => s.bootStage < 5)
  // manual actions take over from the auto demo
  const runScenario = id => { autoDemo.stop(); useCitadel.getState().runScenario(id) }
  const reset = () => { autoDemo.stop(); useCitadel.getState().reset() }
  const strip = useRef(null), inner = useRef(null), sm = useRef(null)
  const drag = useRef({ down: false, x: 0, sl: 0, moved: false })

  // Lenis: vertical wheel / trackpad glide the strip sideways. Each card's big numeral drifts against the scroll (parallax).
  useEffect(() => {
    const el = strip.current
    sm.current = smoothStrip(el, inner.current)
    const para = () => {
      const sr = el.getBoundingClientRect()
      el.querySelectorAll('.card').forEach(c => { const r = c.getBoundingClientRect(); c.style.setProperty('--sx', (((r.left + r.width / 2) - (sr.left + sr.width / 2)) / sr.width).toFixed(3)) })
    }
    para(); el.addEventListener('scroll', para, { passive: true }); addEventListener('resize', para)
    return () => { el.removeEventListener('scroll', para); removeEventListener('resize', para); sm.current?.destroy() }
  }, [])
  const setX = x => (sm.current?.lenis ? sm.current.lenis.scrollTo(x, { immediate: true }) : (strip.current.scrollLeft = x))
  const d = drag.current
  const down = e => { if (e.pointerType === 'mouse' && e.button === 0) { d.down = true; d.x = e.clientX; d.sl = strip.current.scrollLeft; d.moved = false } }
  const move = e => { if (d.down) { const dx = e.clientX - d.x; if (Math.abs(dx) > 5) d.moved = true; setX(d.sl - dx) } }
  const up = () => { d.down = false }

  return (
    <section className="film" aria-label="Simulate attack">
      <header className="film-h">
        <div className="eyebrow brandy">SIMULATE ATTACK <span>· scenarios are synthetic</span></div>
        <button className="auto-btn" data-running={auto} disabled={booting} onClick={e => { if (auto) autoDemo.stop(); else { autoDemo.start(); e.currentTarget.blur() } }}
                aria-pressed={auto} title="Plays the whole story: 3 attacks, the response checklist, and the audit trail">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>{auto ? <rect x="1" y="1" width="8" height="8" fill="currentColor" /> : <polygon points="1,1 9,5 1,9" fill="currentColor" />}</svg>
          {auto ? 'STOP DEMO' : 'AUTO DEMO'}
        </button>
        <button className="btn reset" onClick={reset}>RESET</button>
      </header>
      <p className="film-hint" aria-live="polite">{hint(demo, inc)}</p>
      <div className="strip" ref={strip} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
           onClickCapture={e => { if (d.moved) { e.stopPropagation(); e.preventDefault(); d.moved = false } }}>
        <div className="strip-in" ref={inner}>
          {Object.values(SCENARIOS).map((sc, i) => (
            <Card key={sc.id} sc={sc} idx={i} active={demo?.scenarioId === sc.id && demo.stage < 6} onRun={() => runScenario(sc.id)} />
          ))}
        </div>
      </div>
    </section>
  )
}
