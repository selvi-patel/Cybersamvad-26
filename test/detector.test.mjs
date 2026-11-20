import test from 'node:test'
import assert from 'node:assert/strict'
import { Detector } from '../src/sim/detector.js'
import { AlertBook } from '../src/sim/alertBook.js'
import { mkEvent } from '../src/sim/events.js'
import { riskFrom } from '../src/sim/scoring.js'

const T0 = 1_700_000_000_000
const run = (evs) => { const d = new Detector(); const out = []; evs.forEach(e => out.push(...d.ingest(e).raised)); return out }
const login = (ts, ok, extra = {}) => mkEvent('server.login', 'SRV-WATER', { user: 'x', ok, location: 'City Hall NOC', device: 'NOC-WS-01', knownLocation: true, knownDevice: true, hour: 10, ...extra }, { ts })

test('R1 flicker fires at 5 changes in 60s, not at 4', () => {
  const evs = [0, 1, 2, 3, 4].map(i => mkEvent('light.state', 'SL-A-01', { lit: i % 2 === 0, source: 'x' }, { ts: T0 + i * 5000 }))
  assert.equal(run(evs.slice(0, 4)).length, 0)
  assert.equal(run(evs).filter(d => d.code === 'R1').length, 1)
})
test('R1 does not fire when changes are spread beyond the window', () => {
  const evs = [0, 1, 2, 3, 4, 5].map(i => mkEvent('light.state', 'SL-A-01', { lit: i % 2 === 0 }, { ts: T0 + i * 30000 }))
  assert.equal(run(evs).length, 0)
})
test('R2 flags unknown source / odd hour / bulk; ignores routine commands', () => {
  const ok = mkEvent('light.remote', 'SL-A-01', { source: 'ops-console-01', known: true, hour: 12, count: 2 }, { ts: T0, zone: 'A' })
  assert.equal(run([ok]).length, 0)
  const bad = mkEvent('light.remote', 'ZONE-B', { source: '198.51.100.23', known: false, hour: 2, count: 24 }, { ts: T0, zone: 'B' })
  const [d] = run([bad])
  assert.equal(d.code, 'R2'); assert.equal(d.evidence.length, 3); assert.equal(d.urgency, 5); assert.equal(d.impact, 3)
})
test('R3 needs 3 denied attempts; ok attempts ignored', () => {
  const mk = (i, r) => mkEvent('light.access', 'SL-C-02', { result: r, source: 'x' }, { ts: T0 + i * 1000 })
  assert.equal(run([mk(0, 'denied'), mk(1, 'ok'), mk(2, 'denied')]).length, 0)
  assert.equal(run([mk(0, 'denied'), mk(1, 'denied'), mk(2, 'denied')]).length, 1)
})
test('R4 brute force at 5 fails in 2 min', () => {
  const evs = [0, 1, 2, 3, 4].map(i => login(T0 + i * 20000, false))
  assert.equal(run(evs.slice(0, 4)).length, 0)
  assert.equal(run(evs).filter(d => d.code === 'R4').length, 1)
})
test('R5 unusual login: new location/device; routine login ignored', () => {
  assert.equal(run([login(T0, true)]).length, 0)
  const [d] = run([login(T0, true, { knownLocation: false, location: 'Offshore ISP', knownDevice: false, device: 'x' })])
  assert.equal(d.code, 'R5'); assert.equal(d.urgency, 4)
})
test('R6 spike >3x baseline and auto-clears', () => {
  const det = new Detector()
  assert.equal(det.ingest(mkEvent('server.metrics', 'SRV-TRAFFIC', { rps: 1000 }, { ts: T0 })).raised.length, 0)   // 2.9x
  assert.equal(det.ingest(mkEvent('server.metrics', 'SRV-TRAFFIC', { rps: 1100 }, { ts: T0 })).raised.length, 1)   // 3.2x
  assert.deepEqual(det.ingest(mkEvent('server.metrics', 'SRV-TRAFFIC', { rps: 340 }, { ts: T0 })).cleared, ['R6:SRV-TRAFFIC'])
})
test('R7 service down is urgency 5, sticky, and clears on recovery', () => {
  const det = new Detector()
  const r = det.ingest(mkEvent('server.status', 'SRV-DISPATCH', { up: false }, { ts: T0 })).raised[0]
  assert.equal(r.urgency, 5); assert.equal(r.impact * r.urgency, 25); assert.ok(r.sticky)
  assert.deepEqual(det.ingest(mkEvent('server.status', 'SRV-DISPATCH', { up: true }, { ts: T0 })).cleared, ['R7:SRV-DISPATCH'])
})
test('AlertBook merges repeats, scores, expires non-sticky', () => {
  const b = new AlertBook(); const d = new Detector()
  const evs = [0, 1, 2, 3, 4, 5].map(i => mkEvent('light.state', 'SL-A-01', { lit: i % 2 }, { ts: T0 + i * 1000 }))
  evs.forEach(e => d.ingest(e).raised.forEach(x => b.upsert(x, e.ts)))
  const [a] = b.list(); assert.equal(b.list().length, 1); assert.equal(a.count, 2); assert.equal(a.score, a.impact * a.urgency)
  assert.equal(b.sweep(T0 + 200_000).length, 1); assert.equal(b.list().length, 0)
})
test('risk gauge escalates with the worst alert', () => {
  assert.equal(riskFrom([]).level.key, 'low')
  assert.equal(riskFrom([{ score: 25 }]).level.key, 'critical')
})

import { AuditChain, toCSV, GENESIS } from '../src/sim/audit.js'
import { sha256Hex, sha256Fallback } from '../src/sim/sha256.js'
import { buildIncident, statusFrom, isolatedFrom } from '../src/sim/incidents.js'

test('sha256: fallback matches Web Crypto and the known vector', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  for (const s of ['', 'citadel', 'x'.repeat(200), 'ünïcode ✓']) assert.equal(sha256Fallback(s), await sha256Hex(s))
})
test('audit chain links entries, verifies, and detects tampering', async () => {
  const c = new AuditChain()
  await Promise.all([1, 2, 3, 4].map(i => c.append({ ts: T0 + i, assetId: 'SL-A-01', event: 'e' + i, action: 'a' })))
  assert.equal(c.entries[0].prevHash, GENESIS)
  c.entries.slice(1).forEach((e, i) => assert.equal(e.prevHash, c.entries[i].hash))
  assert.deepEqual(await AuditChain.verify(c.entries), { ok: true, count: 4, brokenAt: null })
  const bad = [...c.entries]; bad[1] = { ...bad[1], action: 'edited' }
  assert.deepEqual(await AuditChain.verify(bad), { ok: false, count: 4, brokenAt: 2 })
  assert.deepEqual((await AuditChain.verify([c.entries[0], c.entries[2], c.entries[3]])).ok, false)   // deletion
  assert.throws(() => { 'use strict'; c.entries[0].action = 'x' })                                    // frozen
  assert.match(toCSV(c.entries), /^"seq","timestamp"/)
})
test('incident lifecycle: New → Investigating → Contained → Resolved; isolation tracked', () => {
  const alert = { key: 'R4:SRV-WATER', code: 'R4', title: 'Repeated failed logins', assetId: 'SRV-WATER', zone: null, service: { id: 'water', label: 'Water supply' }, severity: 'critical', score: 20 }
  const inc = buildIncident(alert, 1)
  assert.equal(inc.status, 'New'); assert.equal(inc.target.type, 'server')
  const tick = (steps, id) => steps.map(s => (s.id === id ? { ...s, done: true } : s))
  let s = tick(inc.steps, 'notify'); assert.equal(statusFrom(s), 'Investigating')
  s = tick(s, 'isolate'); assert.equal(statusFrom(s), 'Contained')
  assert.deepEqual(isolatedFrom([{ ...inc, steps: s, status: 'Contained' }]).servers, ['SRV-WATER'])
  s = tick(tick(s, 'continuity'), 'record'); assert.equal(statusFrom(s), 'Resolved')
  assert.deepEqual(isolatedFrom([{ ...inc, steps: s, status: 'Resolved' }]).servers, [])
})

import { health, availability, loginLevel } from '../src/sim/monitor.js'
import { evaluate as ztEval } from '../src/sim/zeroTrust.js'
import { serviceStates, operationalCount } from '../src/sim/resilience.js'
import { SERVERS } from '../src/sim/model.js'

const calm = { zones: { A: 'normal', B: 'normal', C: 'normal' } }
const srvState = (over = {}) => Object.fromEntries(SERVERS.map(s => [s.id, { id: s.id, up: true, rps: s.baseline, failedLogins: 0, samples: { up: 9, total: 10 }, ...(over[s.id] || {}) }]))

test('monitor: health penalises load, failed logins and criticals; down is 0', () => {
  const s = SERVERS[0]
  assert.equal(health({ up: true, rps: s.baseline, failedLogins: 0 }, s), 100)
  assert.ok(health({ up: true, rps: s.baseline * 6, failedLogins: 0 }, s) < 70)
  assert.equal(health({ up: true, rps: s.baseline, failedLogins: 4 }, s), 80)
  assert.equal(health({ up: false, rps: 0, failedLogins: 0 }, s), 0)
  assert.equal(availability({ samples: { up: 9, total: 10 } }), 90)
  assert.deepEqual([2, 3, 5].map(loginLevel), ['normal', 'warning', 'critical'])
})
test('zero trust: rules map to pillars; isolation shows under Networks; broken chain hits Data', () => {
  const alerts = [{ code: 'R4', severity: 'critical', assetId: 'SRV-WATER', evidence: [] }, { code: 'R1', severity: 'warning', assetId: 'SL-A-01', evidence: [] }]
  const p = Object.fromEntries(ztEval({ alerts, isolated: { zones: ['C'], servers: [] }, auditVerify: { ok: true }, blocked: 3 }).map(x => [x.id, x]))
  assert.equal(p.identity.status, 'critical'); assert.equal(p.devices.status, 'warning'); assert.equal(p.workloads.status, 'normal')
  assert.deepEqual(p.networks.enforcing, ['Micro-perimeter active: Zone C', '3 hostile events blocked']); assert.equal(p.networks.status, 'normal')
  assert.equal(ztEval({ alerts: [], isolated: { zones: [], servers: [] }, auditVerify: { ok: false, brokenAt: 4 } }).find(x => x.id === 'data').status, 'critical')
})
test('resilience: down → failover keeps service on standby; lighting fail-safe when zone isolated', () => {
  const base = { alerts: [], status: calm, isolated: { zones: [], servers: [] }, continuity: { zones: [], servers: [] } }
  const by = l => Object.fromEntries(l.map(s => [s.id, s]))
  assert.equal(operationalCount(serviceStates({ ...base, servers: srvState() })), 5)
  let r = by(serviceStates({ ...base, servers: srvState({ 'SRV-DISPATCH': { up: false } }) }))
  assert.equal(r.dispatch.state, 'down')
  r = by(serviceStates({ ...base, servers: srvState({ 'SRV-DISPATCH': { up: false } }), continuity: { zones: [], servers: ['SRV-DISPATCH'] } }))
  assert.equal(r.dispatch.state, 'standby')
  r = by(serviceStates({ ...base, servers: srvState(), isolated: { zones: ['B'], servers: [] } }))
  assert.equal(r.lighting.state, 'standby')
  r = by(serviceStates({ ...base, servers: srvState(), status: { zones: { A: 'critical', B: 'normal', C: 'normal' } } }))
  assert.equal(r.lighting.state, 'degraded')
})
