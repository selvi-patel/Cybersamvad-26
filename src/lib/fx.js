// Small pointer effects: card tilt + magnetic buttons. Both no-op under prefers-reduced-motion.
import { useRef } from 'react'
import { prefersReducedMotion } from './device'

export function useTilt(max = 8) {
  const ref = useRef(null)
  return {
    ref,
    onPointerMove(e) {
      if (prefersReducedMotion() || e.pointerType === 'touch') return
      const el = ref.current, r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--ry', `${x * max}deg`); el.style.setProperty('--rx', `${-y * max}deg`)
      el.style.setProperty('--gx', `${(x + 0.5) * 100}%`); el.style.setProperty('--gy', `${(y + 0.5) * 100}%`)
    },
    onPointerLeave() { const el = ref.current; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') },
  }
}

export function useMagnet(strength = 0.35) {
  const ref = useRef(null)
  return {
    ref,
    onPointerMove(e) {
      if (prefersReducedMotion() || e.pointerType === 'touch') return
      const el = ref.current, r = el.getBoundingClientRect()
      el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * strength}px, ${(e.clientY - (r.top + r.height / 2)) * strength}px)`
    },
    onPointerLeave() { ref.current.style.transform = '' },
  }
}
