// Decide 3D vs simplified 2D. Force with ?mode=2d or ?mode=3d.
// Live reduced-motion flag: read `motion.reduced` at use time (it updates if the OS setting changes mid-session).
const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null
export const motion = { reduced: !!mq?.matches }
mq?.addEventListener?.('change', e => { motion.reduced = e.matches })
export const prefersReducedMotion = () => motion.reduced

export function detectMode() {
  const q = new URLSearchParams(location.search).get('mode')
  if (q === '2d' || q === '3d') return q
  const narrow = innerWidth < 1100            // below this the 3D + side panels get cramped → simplified 2D layout
  const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory && navigator.deviceMemory <= 2)
  const saveData = navigator.connection?.saveData
  let gl = false
  try { gl = !!document.createElement('canvas').getContext('webgl2') } catch { /* no webgl */ }
  return narrow || weak || saveData || !gl ? '2d' : '3d'
}
