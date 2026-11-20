import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { cur } from '../lib/cursor'
import { motion } from '../lib/device'

// Custom cursor: dot + ring with four states.
//   default → small ring   hover → big filled ring   select (3D zone/light/rack) → diamond brackets
//   danger → red octagon (hovering something CRITICAL)   drag → filmstrip
const HOVER = 'button:not(:disabled), a, [role=tab], [role=checkbox]:not(:disabled), tr[tabindex], summary, .card, [data-cursor]'

export default function Cursor() {
  const root = useRef(), ring = useRef(), label = useRef()
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return
    const html = document.documentElement
    html.classList.add('has-cursor')
    const el = root.current
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.38, ease: 'power3' }), ry = gsap.quickTo(ring.current, 'y', { duration: 0.38, ease: 'power3' })
    let last = null, x = -100, y = -100
    const place = () => {
      el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px')
      if (motion.reduced) { gsap.set(ring.current, { x, y }) } else { rx(x); ry(y) }
    }
    const classify = t => {
      if (!t || !t.closest) return ['default', '']
      if (t.tagName === 'CANVAS') return [cur.scene || 'default', cur.label]
      const h = t.closest(HOVER)
      if (!h) return t.closest('.strip') ? ['drag', 'DRAG'] : ['default', '']
      if (h.dataset.cursor) return [h.dataset.cursor, h.dataset.cursorLabel || '']
      if (h.closest('[data-s=critical]')) return ['danger', '']
      return ['hover', '']
    }
    const apply = t => {
      const [s, l] = classify(t)
      if (s !== el.dataset.state) el.dataset.state = s
      if (label.current.textContent !== l) label.current.textContent = l
    }
    const move = e => { x = e.clientX; y = e.clientY; last = e.target; el.dataset.visible = 'true'; place(); apply(last) }
    const refresh = () => last && apply(last)
    const down = () => (el.dataset.down = 'true'), up = () => (el.dataset.down = 'false')
    const leave = () => (el.dataset.visible = 'false')
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerdown', down); addEventListener('pointerup', up)
    document.documentElement.addEventListener('pointerleave', leave)
    addEventListener('citadel-cursor', refresh)
    return () => {
      html.classList.remove('has-cursor')
      removeEventListener('pointermove', move); removeEventListener('pointerdown', down); removeEventListener('pointerup', up)
      document.documentElement.removeEventListener('pointerleave', leave); removeEventListener('citadel-cursor', refresh)
    }
  }, [])
  return (
    <div className="cursor" ref={root} data-state="default" data-visible="false" aria-hidden>
      <i className="c-dot" />
      <div className="c-ring" ref={ring}>
        <svg viewBox="-24 -24 48 48" width="48" height="48">
          <circle className="s-default" r="9" />
          <circle className="s-hover" r="16" />
          <path className="s-select" d="M-14-6v-8h8M6-14h8v8M14 6v8h-8M-6 14h-8v-8" />
          <polygon className="s-danger" points="-6.5,-15.5 6.5,-15.5 15.5,-6.5 15.5,6.5 6.5,15.5 -6.5,15.5 -15.5,6.5 -15.5,-6.5" />
          <path className="s-drag" d="M-17 0h9m-4-4l-5 4 5 4M17 0h-9m4-4l5 4-5 4" />
        </svg>
        <span ref={label} className="c-label" />
      </div>
    </div>
  )
}
