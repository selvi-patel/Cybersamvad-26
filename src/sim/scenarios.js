// Attack scenarios (simulated). Step 3 turns these into the filmstrip cards;
// for now the dev bar calls runScenario(id). Each run() returns the target so
// the camera can fly to it. Timings are in ms — tweak to pace the demo.
import { mkEvent } from './events.js'
import { LIGHTS, SERVERS, ZONES, ROGUE_SOURCES, ROGUE_LOCATIONS, lightsInZone, zoneAssetId } from './model.js'

const pick = a => a[Math.floor(Math.random() * a.length)]

export const SCENARIOS = {
  flicker: {
    id: 'flicker', rules: ['R1'], pillars: 'Devices', name: 'Streetlight flicker attack',
    blurb: 'One light is switched on/off in rapid bursts from an unknown controller.',
    run(gen) {
      const l = pick(lightsInZone(pick(ZONES).id).filter(l => gen.online[l.id]))
      for (let i = 0; i < 9; i++) gen.at(i * 550, () => gen.toggle(l.id, 'unregistered-device', true))
      return { type: 'zone', id: l.zone, asset: l.id }
    },
  },
  bruteforce: {
    id: 'bruteforce', rules: ['R4', 'R5'], pillars: 'Identity', name: 'Brute-force login on a server',
    blurb: 'Rapid failed logins from an unrecognised location, then a login from a new device.',
    run(gen) {
      const s = pick(SERVERS.filter(s => s.service === 'water' || s.service === 'dispatch'))   // high-impact targets read best on stage
      const loc = pick(ROGUE_LOCATIONS)
      for (let i = 0; i < 8; i++) gen.at(i * 650, () => gen.emit(mkEvent('server.login', s.id, {
        user: pick(['admin', 'root', 'svc-ops', 'operator']), ok: false, location: loc, device: 'unknown-linux-x64',
        knownLocation: false, knownDevice: false, hour: 3 }, { hostile: true })))
      gen.at(8 * 650, () => gen.emit(mkEvent('server.login', s.id, {
        user: 'svc-ops', ok: true, location: loc, device: 'unknown-linux-x64', knownLocation: false, knownDevice: false, hour: 3 }, { hostile: true })))
      return { type: 'server', id: s.id, asset: s.id }
    },
  },
  spike: {
    id: 'spike', rules: ['R6'], pillars: 'Networks', name: 'Traffic spike / DDoS-style surge',
    blurb: 'Request volume on the traffic-signal server climbs past 7× baseline.',
    run(gen) {
      const s = SERVERS.find(s => s.id === 'SRV-TRAFFIC')
      ;[1.8, 3.4, 5.2, 6.8, 7.4, 7.4].forEach((m, i) => gen.at(i * 1100, () => gen.setLoad(s.id, m)))
      return { type: 'server', id: s.id, asset: s.id }
    },
  },
  rogue: {
    id: 'rogue', rules: ['R2', 'R3'], pillars: 'Devices · Identity', name: 'Rogue remote-control commands',
    blurb: 'An unknown source sends a bulk night-time command, then probes light controllers.',
    run(gen) {
      const z = pick(ZONES)
      const ls = lightsInZone(z.id)
      const src = pick(ROGUE_SOURCES)
      gen.at(0, () => gen.emit(mkEvent('light.remote', zoneAssetId(z.id), { source: src, known: false, hour: 2, count: 24 }, { zone: z.id, hostile: true })))
      const t = pick(ls).id
      for (let i = 0; i < 4; i++) gen.at(1200 + i * 700, () => gen.emit(mkEvent('light.access', t, { result: 'denied', source: src }, { zone: z.id, hostile: true })))
      return { type: 'zone', id: z.id, asset: zoneAssetId(z.id) }
    },
  },
  outage: {
    id: 'outage', rules: ['R7'], pillars: 'Workloads', name: 'Critical service outage',
    blurb: 'Emergency dispatch stops answering health probes.',
    run(gen) {
      const s = SERVERS.find(s => s.id === 'SRV-DISPATCH')
      gen.at(0, () => gen.setDown(s.id, true, 'Connection refused on :443 (3 consecutive probes)'))
      return { type: 'server', id: s.id, asset: s.id }
    },
  },
}
