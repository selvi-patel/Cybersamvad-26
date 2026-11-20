// Server-monitor maths: health score, availability, failed-login level. Pure.
import { THRESHOLDS } from '../config.js'

export const availability = sv => (sv.samples.total ? (sv.samples.up / sv.samples.total) * 100 : 100)

// 0–100. Down = 0. Penalties: load above 1.5× baseline, failed logins, critical alerts. Tweak the weights here.
export function health(sv, srv, alerts = []) {
  if (!sv.up) return 0
  const ratio = sv.rps / srv.baseline
  let h = 100
  if (ratio > 1.5) h -= Math.min(45, (ratio - 1.5) * 12)
  h -= Math.min(30, sv.failedLogins * 5)
  h -= alerts.filter(a => a.severity === 'critical').length * 10
  return Math.max(5, Math.round(h))
}

export const loginLevel = n => (n >= THRESHOLDS.bruteForce.fails ? 'critical' : n >= 3 ? 'warning' : 'normal')
