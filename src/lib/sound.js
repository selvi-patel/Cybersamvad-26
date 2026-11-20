// Alert audio. A new WARNING gets two soft beeps; a new CRITICAL gets three urgent rising/falling pulses.
// ON by default; the header toggle turns it off (remembered). Browsers only allow audio after a user gesture,
// so the AudioContext is created on the first click or key press anywhere on the page.
export const sound = { on: true }
let ctx = null, lastAt = 0

const ensure = () => {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC() }
  if (ctx?.state === 'suspended') ctx.resume()
}
export function initSound() {
  try { const v = localStorage.getItem('citadel.sound'); if (v !== null) sound.on = v === '1' } catch { /* storage blocked */ }
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, ensure, { once: true })
}
export function setSound(on) {
  sound.on = on
  try { localStorage.setItem('citadel.sound', on ? '1' : '0') } catch { /* storage blocked */ }
  if (on) { ensure(); playAlert('warning', true) }              // confirmation beep
}

const beep = (freq, at, dur, vol, type) => {
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02)
}
/** tweak volume (0–1 gain) and pitches here */
export function playAlert(severity, force = false) {
  if (!sound.on || !ctx) return
  const now = performance.now()
  if (!force && now - lastAt < 700) return                      // never machine-gun when several alerts land together
  lastAt = now
  if (severity === 'critical') [[880, 0], [660, 0.2], [880, 0.4]].forEach(([f, at]) => beep(f, at, 0.17, 0.25, 'triangle'))
  else [[520, 0], [520, 0.2]].forEach(([f, at]) => beep(f, at, 0.13, 0.16, 'sine'))
}
