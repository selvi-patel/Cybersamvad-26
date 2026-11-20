// Human-readable rule catalogue. The UI shows `statement` as WHY an alert fired.
// `pillar` maps each detection to a Zero Trust pillar (used by the step-4 panel).
import { THRESHOLDS as T } from '../config.js'

export const RULES = {
  R1: { code: 'R1', title: 'Streetlight flicker', pillar: 'devices',
        statement: `≥${T.flicker.changes} on/off state changes on one light within ${T.flicker.windowMs / 1000} s` },
  R2: { code: 'R2', title: 'Unusual remote-control request', pillar: 'devices',
        statement: `Remote command from an unknown source, outside ${String(T.remote.oddTo).padStart(2, '0')}:00–${T.remote.oddFrom}:00, or bulk (>${T.remote.bulkCount - 1} lights)` },
  R3: { code: 'R3', title: 'Possible unauthorized access', pillar: 'identity',
        statement: `≥${T.unauthorized.attempts} denied access attempts on one light controller within ${T.unauthorized.windowMs / 1000} s` },
  R4: { code: 'R4', title: 'Repeated failed logins', pillar: 'identity',
        statement: `≥${T.bruteForce.fails} failed logins on one server within ${T.bruteForce.windowMs / 60000} min` },
  R5: { code: 'R5', title: 'Unusual login attempt', pillar: 'identity',
        statement: 'Login from a new location, a new device, or at an odd hour' },
  R6: { code: 'R6', title: 'Request-volume spike', pillar: 'networks',
        statement: `Request rate above ${T.spike.multiplier}× the server's baseline` },
  R7: { code: 'R7', title: 'Critical service unavailable', pillar: 'workloads',
        statement: 'Health probe failed on a critical public-service server', sticky: true },
}
