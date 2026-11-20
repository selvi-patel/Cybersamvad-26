// Boot-intro controller shared by <Boot/> (GSAP timeline) and the 3D scene.
// `power` is the animated "grid power" per zone (0 → 1): the scene scales buildings/lights/racks by it.
// Disable with ?intro=0. Skipped automatically for reduced motion and the 2D fallback.
import { detectMode, motion } from './device'

export const HOME = { pos: [0, 18, 30.5], target: [0, 0, 3.6] }
// narrower windows pull the camera back so the city isn't hidden behind the side panels
export const homePose = () => {
  const k = Math.min(1.3, Math.max(1, 1500 / innerWidth))
  return { pos: HOME.pos.map((v, i) => HOME.target[i] + (v - HOME.target[i]) * k), target: HOME.target }
}
export const FAR = { pos: [-34, 36, 54], target: HOME.target }          // where the intro fly-in starts

const q = new URLSearchParams(location.search)
const enabled = detectMode() === '3d' && !motion.reduced && q.get('intro') !== '0'

export const intro = {
  enabled,
  power: { A: enabled ? 0 : 1, B: enabled ? 0 : 1, C: enabled ? 0 : 1, core: enabled ? 0 : 1 },
  cam: null, ready: false, cbs: [], tl: null,
  whenReady(fn) { this.ready ? fn() : this.cbs.push(fn) },
  markReady(camera, controls) { this.cam = { camera, controls }; if (!this.ready) { this.ready = true; this.cbs.splice(0).forEach(f => f()) } },
  complete() { Object.keys(this.power).forEach(k => (this.power[k] = 1)) },
}
