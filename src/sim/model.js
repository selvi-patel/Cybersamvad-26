// Static city model: zones, streetlights, public-service servers.
// 3D positions live here too so the scene and the simulator agree on IDs.

export const SERVICES = {
  lighting: { id: 'lighting', label: 'Street lighting',    impact: 2 },
  water:    { id: 'water',    label: 'Water supply',       impact: 5 },
  traffic:  { id: 'traffic',  label: 'Traffic signals',    impact: 4 },
  dispatch: { id: 'dispatch', label: 'Emergency dispatch', impact: 5 },
  transit:  { id: 'transit',  label: 'Public transit',     impact: 3 },
}

// Zone footprints on the tabletop (x, z). Plate size is ZONE_SIZE.
export const ZONE_SIZE = 8.4
export const ZONES = [
  { id: 'A', name: 'Harbour Row',    center: [-7.7, 0, -3.4] },
  { id: 'B', name: 'Market Quarter', center: [7.7, 0, -3.4] },
  { id: 'C', name: 'Northgate Park', center: [0, 0, 7.5] },
]

// Light slots in zone-local coordinates, along the cross-roads.
const SLOTS = [[-3, .9], [-1, .9], [1, .9], [3, .9], [-.9, -3], [-.9, -1.8], [-.9, 1.8], [-.9, 3]]

export const LIGHTS = ZONES.flatMap(z => SLOTS.map((s, i) => ({
  id: `SL-${z.id}-${String(i + 1).padStart(2, '0')}`,
  zone: z.id,
  service: 'lighting',
  pos: [z.center[0] + s[0], 0, z.center[2] + s[1]],
})))

// Servers sit on the central "civic core" plinth. baseline = normal requests/sec.
export const SERVERS = [
  { id: 'SRV-WATER',    name: 'Water Control', short: 'WATER', code: 'WTR', service: 'water',    baseline: 120, pos: [-1.05, 0, -1.05] },
  { id: 'SRV-TRAFFIC',  name: 'Traffic Management', short: 'TRAFFIC', code: 'TRF', service: 'traffic',  baseline: 340, pos: [1.05, 0, -1.05] },
  { id: 'SRV-DISPATCH', name: 'Emergency Dispatch', short: 'DISPATCH', code: 'DSP', service: 'dispatch', baseline: 85,  pos: [-1.05, 0, 1.05] },
  { id: 'SRV-TRANSIT',  name: 'Transit Portal', short: 'TRANSIT', code: 'TRN', service: 'transit',  baseline: 520, pos: [1.05, 0, 1.05] },
]

export const KNOWN_SOURCES = ['ops-console-01', 'scada-gw-02', 'maint-tablet-07']
export const KNOWN_LOCATIONS = ['City Hall NOC', 'Depot East']
export const ROGUE_SOURCES = ['198.51.100.23', 'unregistered-device', '203.0.113.77']
export const ROGUE_LOCATIONS = ['Unrecognised VPN exit', 'Offshore ISP']

export const LIGHT_BY_ID = Object.fromEntries(LIGHTS.map(l => [l.id, l]))
export const SERVER_BY_ID = Object.fromEntries(SERVERS.map(s => [s.id, s]))
export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]))
export const zoneAssetId = zid => `ZONE-${zid}`
export const lightsInZone = zid => LIGHTS.filter(l => l.zone === zid)

// Lights that start offline (comms fault / maintenance). Not a detection.
export const INITIAL_OFFLINE = ['SL-A-06', 'SL-C-03']

// ── continuity (step 4): what keeps each public service running when its primary path is hit ──
// Illustrative, fictional fallbacks for the prototype. Edit freely.
export const BACKUPS = {
  lighting: { backup: 'Local controller schedule on every light', mode: 'Autonomous fail-safe', rto: '0 s', manual: 'Lights keep their last schedule if the network is cut' },
  water:    { backup: 'Standby control node',                     mode: 'Hot standby',          rto: '< 30 s', manual: 'Manual pump and valve override at the plant' },
  traffic:  { backup: 'Fixed-time signal plans on each controller', mode: 'Local fallback',     rto: '< 10 s', manual: 'Police point duty at key junctions' },
  dispatch: { backup: 'Secondary dispatch cluster',               mode: 'Warm standby',         rto: '< 60 s', manual: 'Radio dispatch with paper CAD cards' },
  transit:  { backup: 'Cached static timetable site',             mode: 'Degraded read-only',   rto: '< 5 s',  manual: 'Timetables posted at stops' },
}
export const SERVICE_ORDER = ['dispatch', 'water', 'traffic', 'transit', 'lighting']
