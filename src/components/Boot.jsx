import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useCitadel } from '../store'
import { intro, homePose } from '../lib/intro'

// Load intro: the city grid boots zone by zone. ~4.8 s. Click, any key or SKIP jumps to the end.
// Timeline tweaks: change the numbers (seconds) in `run()`; stage numbers drive the 3D tags + UI reveal (see store.bootStage).
const LOG = [
  [0.35, 'INIT CITY GRID'], [0.8, 'DETECTION ENGINE · 7 RULES ARMED'], [1.3, 'ZONE A · HARBOUR ROW ........ ONLINE'],
  [2.0, 'ZONE B · MARKET QUARTER ... ONLINE'], [2.7, 'ZONE C · NORTHGATE PARK .... ONLINE'], [3.4, 'CIVIC CORE · 4 PUBLIC SERVICES ... LINKED'],
  [4.0, 'AUDIT CHAIN · GENESIS SEALED'],
]

export default function Boot() {
  const root = useRef()
  const [gone, setGone] = useState(!intro.enabled)

  useEffect(() => {
    if (!intro.enabled) return
    const set = n => useCitadel.setState({ bootStage: n })
    let tl = null, finished = false, fallback

    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(fallback); tl?.kill()
      intro.complete()
      const { camera, controls } = intro.cam || {}
      const HOME = homePose()
      if (camera) { camera.position.set(...HOME.pos); controls.target.set(...HOME.target); controls.enabled = true; controls.autoRotate = true; controls.update() }
      set(99)
      gsap.to(root.current, { opacity: 0, duration: 0.5, onComplete: () => setGone(true) })
    }

    const run = () => {
      clearTimeout(fallback)
      const { camera, controls } = intro.cam || {}
      const P = intro.power, HOME = homePose()
      tl = gsap.timeline({ onComplete: finish })
      intro.tl = tl
      tl.from('.bo-w i', { yPercent: 115, stagger: 0.05, duration: 0.75, ease: 'power4.out' }, 0.1)
        .to('.bo-bar b', { scaleX: 1, duration: 4.7, ease: 'none' }, 0)
      LOG.forEach(([t, text], i) => tl.call(() => {
        const li = root.current?.querySelectorAll('.bo-log li')[i]
        if (li) { li.textContent = text; li.classList.add('on') }
      }, null, t))
      tl.to('.bo-bg', { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 1.0)
        .to('.bo-w', { opacity: 0, y: -26, duration: 0.6, ease: 'power2.in' }, 1.0)
      if (camera) tl.to(camera.position, { x: HOME.pos[0], y: HOME.pos[1], z: HOME.pos[2], duration: 3.9, ease: 'power2.inOut', onUpdate: () => controls.update() }, 0.5)
      ;[['A', 1.2, 1], ['B', 1.9, 2], ['C', 2.6, 3], ['core', 3.3, 4]].forEach(([k, t, st]) =>
        tl.call(() => set(st), null, t).to(P, { [k]: 1, duration: 1.05, ease: 'power3.out' }, t))
      tl.call(() => set(5), null, 4.0)
    }

    intro.whenReady(run)
    fallback = setTimeout(() => !tl && run(), 8000)            // never block on a slow 3D chunk
    const skip = e => { if (e.type === 'keydown' && e.key === 'Tab') return; finish() }
    addEventListener('keydown', skip); root.current?.addEventListener('pointerdown', skip)
    return () => { removeEventListener('keydown', skip); clearTimeout(fallback); tl?.kill() }
  }, [])

  if (gone) return null
  return (
    <div className="boot-ov" ref={root} role="status" aria-label="Booting city grid. Press any key to skip.">
      <div className="bo-bg" />
      <h2 className="bo-w display" aria-hidden>{[...'CITADEL'].map((c, i) => <span key={i}><i>{c}</i></span>)}</h2>
      <ul className="bo-log">{LOG.map((_, i) => <li key={i} />)}</ul>
      <div className="bo-bar"><b /></div>
      <button className="bo-skip" tabIndex={-1}>SKIP · ANY KEY</button>
    </div>
  )
}
