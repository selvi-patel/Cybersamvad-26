// Lenis smooth scrolling driven by GSAP's ticker, plus ScrollTrigger. All no-ops under reduced motion.
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motion } from './device'

gsap.registerPlugin(ScrollTrigger)
const noop = { lenis: null, destroy() {} }

/** horizontal filmstrip: vertical wheel + trackpad → smooth horizontal travel */
export function smoothStrip(wrapper, content) {
  if (motion.reduced) return noop
  const lenis = new Lenis({ wrapper, content, orientation: 'horizontal', gestureOrientation: 'both', smoothWheel: true, lerp: 0.1 })
  const tick = t => lenis.raf(t * 1000)
  gsap.ticker.add(tick)
  return { lenis, destroy() { gsap.ticker.remove(tick); lenis.destroy() } }
}

/** whole-page smooth scroll for the 2D layout, with ScrollTrigger section reveals */
export function smoothPage(root) {
  const triggers = []
  let lenis = null, tick = null
  if (!motion.reduced) {
    lenis = new Lenis({ lerp: 0.09 })
    lenis.on('scroll', ScrollTrigger.update)
    tick = t => lenis.raf(t * 1000)
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0)
    gsap.utils.toArray(root.children).forEach(el => {
      const tw = gsap.from(el, { y: 44, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } })
      triggers.push(tw)
    })
  }
  return { lenis, destroy() { triggers.forEach(t => { t.scrollTrigger?.kill(); t.kill() }); if (tick) gsap.ticker.remove(tick); lenis?.destroy() } }
}
