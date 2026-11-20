import { BRAND, STATUS, SURFACE, FONTS, UI } from '../config'

// Push config values into CSS custom properties (Tailwind + index.css read these).
export function applyTheme() {
  const s = document.documentElement.style
  s.setProperty('--brand', BRAND)
  s.setProperty('--ok', STATUS.normal.color)
  s.setProperty('--warn', STATUS.warning.color)
  s.setProperty('--crit', STATUS.critical.color)
  Object.entries(SURFACE).forEach(([k, v]) => s.setProperty(`--${k}`, v))
  s.setProperty('--font-display', FONTS.display)
  s.setProperty('--font-mono', FONTS.mono)
  s.setProperty('--queue-w', UI.queueW + 'px')
  s.setProperty('--leaf-w', UI.leafW + 'px')
}
