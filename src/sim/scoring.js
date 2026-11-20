import { THRESHOLDS, RISK_LEVELS } from '../config.js'

// PRIORITY = IMPACT × URGENCY   (both 1–5 → 1–25)
export const priority = (impact, urgency) => impact * urgency
export const severityOf = score => (score >= THRESHOLDS.critScore ? 'critical' : 'warning')

// City risk 0–100: dominated by the worst alert, plus a smaller contribution from the rest.
// Tweak the 80 / 10 weights to make the gauge more or less jumpy.
export function riskFrom(alerts) {
  if (!alerts.length) return { score: 0, level: RISK_LEVELS[0] }
  const scores = alerts.map(a => a.score).sort((a, b) => b - a)
  const rest = scores.slice(1).reduce((s, v) => s + v, 0)
  const score = Math.min(100, Math.round((scores[0] / 25) * 80 + Math.min(20, (rest / 25) * 10)))
  const level = [...RISK_LEVELS].reverse().find(l => score >= l.from)
  return { score, level }
}
