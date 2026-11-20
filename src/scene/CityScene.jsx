// The tabletop city. Everything status-driven reads the store inside useFrame
// (no React re-render per event). 3D ASSET TWEAKS: geometry is all procedural
// low-poly boxes/cylinders — swap Buildings/ServerCore for GLTFs via drei's useGLTF if desired.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Edges, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { STATUS, SURFACE, BRAND, UI } from '../config'
import { ZONES, ZONE_SIZE, LIGHTS, SERVERS, ZONE_BY_ID, SERVER_BY_ID } from '../sim/model'
import { useCitadel } from '../store'
import { motion } from '../lib/device'
import { sceneCursor } from '../lib/cursor'
import { intro, homePose, FAR } from '../lib/intro'
import StatusGlyph from '../components/StatusGlyph'

const col = {
  normal: new THREE.Color(STATUS.normal.color), warning: new THREE.Color(STATUS.warning.color),
  critical: new THREE.Color(STATUS.critical.color), offline: new THREE.Color(SURFACE.offline), brand: new THREE.Color(BRAND),
}
const tmp = new THREE.Object3D()
const tmpC = new THREE.Color()

// ── camera poses ─────────────────────────────────────────────────────────────
function poseFor(focus) {
  if (focus.type === 'zone') { const c = ZONE_BY_ID[focus.id].center; return { pos: [c[0], 10.5, c[2] + 14.5], target: [c[0], 0.2, c[2] + 2.4] } }
  if (focus.type === 'server') return { pos: [0, 8.2, 13.5], target: [0, 1.0, 0] }
  return homePose()
}

function CameraRig({ controlsRef }) {
  const { camera } = useThree()
  const focus = useCitadel(s => s.focus)
  const first = useRef(true)
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const p = poseFor(focus)
    if (focus.type !== 'home') c.autoRotate = false
    if (first.current && intro.enabled) {                       // intro: start far away; <Boot/> flies the camera in
      first.current = false
      camera.position.set(...FAR.pos); c.target.set(...FAR.target); c.autoRotate = false; c.enabled = false; c.update()
      intro.markReady(camera, c)
      return
    }
    const dur = first.current || motion.reduced ? 0 : 1.5
    first.current = false
    const tl = gsap.timeline({ defaults: { duration: dur, ease: 'power3.inOut' } })
    tl.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2] }, 0)
     .to(c.target, { x: p.target[0], y: p.target[1], z: p.target[2], onUpdate: () => c.update() }, 0)
    return () => tl.kill()
  }, [focus, camera, controlsRef])
  return null
}

// Slides the rendered scene sideways so the city stays centred in the free space
// between the alert queue (left) and the hinged zone panel (right).
function ViewShift() {
  const { camera, size } = useThree()
  const panelZone = useCitadel(s => s.panelZone)
  const railOpen = useCitadel(s => s.railOpen)
  const leafW = useCitadel(s => s.leafW)
  const sheetH = useCitadel(s => s.sheetH)
  const prevPanel = useRef(null)
  const sheet = size.width < UI.foldMinWidth                              // zone panel becomes a bottom sheet below this width
  const drawer = useCitadel(s => (s.auditOpen ? 0.56 : s.view ? 0.46 : sheet && s.panelZone ? s.sheetH / 100 : 0))   // fraction of the screen a bottom panel covers
  const v = useRef({ x: 0 })
  const film = typeof document !== 'undefined' ? (document.querySelector('.botctl')?.offsetHeight || UI.filmH) : UI.filmH
  const lift = size.width >= 900 ? (drawer ? size.height * drawer : film) / 2 : 0   // keep the city clear of the bottom panels
  const apply = () => {
    if (Math.abs(v.current.x) < 0.5 && !lift) camera.clearViewOffset()
    else camera.setViewOffset(size.width, size.height, -v.current.x, lift, size.width, size.height)
  }
  useLayoutEffect(() => {
    const wide = size.width >= UI.foldMinWidth
    const left = size.width >= 900 ? (railOpen ? UI.queueW + 16 : 48) : 0
    const right = wide && panelZone ? leafW * 2 + 16 : 0
    const slow = prevPanel.current !== panelZone; prevPanel.current = panelZone     // panel opening = slow glide, live resizing = quick follow
    gsap.to(v.current, { x: (left - right) / 2, duration: motion.reduced ? 0 : slow ? 1 : 0.2, ease: 'power3.inOut', onUpdate: apply })
    apply()
  }, [panelZone, drawer, railOpen, leafW, sheetH, size.width, size.height]) // eslint-disable-line
  return null
}

// ── static geometry ──────────────────────────────────────────────────────────
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

function Buildings() {
  const ref = useRef()
  const items = useMemo(() => {
    const r = mulberry(7), out = []
    ZONES.forEach(z => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => [[-.65, -.65], [.65, -.65], [-.65, .65], [.65, .65]].forEach(([ox, oz]) => {
      const h = 0.35 + r() * r() * 2.4
      out.push({ zone: z.id, x: z.center[0] + sx * 2.4 + ox, z: z.center[2] + sz * 2.4 + oz, h, w: 0.8 + r() * 0.25, d: 0.8 + r() * 0.25 })
    })))
    return out
  }, [])
  // buildings rise with their zone's boot power (intro); after the intro the matrices never change again
  const lastKey = useRef('')
  useFrame(() => {
    const P = intro.power, key = `${P.A}|${P.B}|${P.C}`
    if (key === lastKey.current) return
    lastKey.current = key
    items.forEach((b, i) => {
      const pw = Math.max(P[b.zone], 0.0001), h = b.h * pw
      tmp.position.set(b.x, 0.2 + h / 2, b.z); tmp.scale.set(b.w, h, b.d); tmp.updateMatrix(); ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[null, null, items.length]}>
      <boxGeometry /><meshStandardMaterial color="#262d3d" roughness={0.9} flatShading />
    </instancedMesh>
  )
}

function Roads() {
  const roads = useMemo(() => ZONES.map(z => {
    const dx = z.center[0], dz = z.center[2], len = Math.hypot(dx, dz)
    return { pos: [dx / 2, 0.025, dz / 2], rot: Math.atan2(dx, dz), len }
  }), [])
  return (
    <group>
      {roads.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[0, r.rot, 0]}>
          <boxGeometry args={[1.0, 0.04, r.len]} /><meshStandardMaterial color="#10131a" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function Table() {
  return (
    <group>
      <mesh position={[0, -0.35, 1]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[17, 17.6, 0.5, 8]} /><meshStandardMaterial color="#0c0e13" roughness={0.8} />
        <Edges color={BRAND} threshold={15} />
      </mesh>
      <gridHelper args={[34, 34, '#1a1f2b', '#12151d']} position={[0, -0.095, 1]} />
    </group>
  )
}

// ── zones ────────────────────────────────────────────────────────────────────
function Zone({ z }) {
  const root = useRef(), plate = useRef(), glow = useRef(), ripple = useRef(), beam = useRef(), edge = useRef()
  const hover = useRef(false)
  const plateEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(ZONE_SIZE, 0.2, ZONE_SIZE)), [])
  const t0 = useMemo(() => Math.random() * 6, [])
  useFrame(({ clock }, dt) => {
    const st = useCitadel.getState()
    const pw = intro.power[z.id]                                            // intro: zone rises out of the table
    root.current.scale.y = Math.max(pw, 0.001); root.current.visible = pw > 0.002
    const s = st.status.zones[z.id], c = col[s], t = clock.elapsedTime + t0
    const calm = motion.reduced                                              // reduced motion: static glow, no ripple
    const sel = st.panelZone === z.id || st.focus.id === z.id
    const lift = (hover.current ? 0.18 : 0) + (sel ? 0.06 : 0)
    plate.current.position.y = THREE.MathUtils.damp(plate.current.position.y, lift, 6, dt)
    // restrained signal: slow breathing glow for warning, slower + stronger for critical
    const pulse = calm ? (s === 'normal' ? 0 : 0.5) : s === 'critical' ? 0.5 + 0.5 * Math.sin(t * 2.4) : s === 'warning' ? 0.5 + 0.5 * Math.sin(t * 1.6) : 0
    glow.current.material.color.copy(c)
    glow.current.material.opacity = s === 'normal' ? 0.05 : 0.12 + pulse * 0.16
    edge.current.color.copy(s === 'normal' ? col.brand : c)
    const rp = (t * (s === 'critical' ? 0.55 : 0.4)) % 1                 // expanding ring
    ripple.current.visible = s !== 'normal' && !calm
    ripple.current.scale.setScalar(0.1 + rp * 0.9)
    ripple.current.material.color.copy(c)
    ripple.current.material.opacity = (1 - rp) * 0.55
    beam.current.visible = s === 'critical'
    beam.current.material.opacity = 0.035 + pulse * 0.05
  })
  const set = useCitadel.getState
  return (
    <group position={z.center} ref={root}>
      <group ref={plate}>
        <mesh
          position={[0, 0.1, 0]}
          onPointerOver={e => { e.stopPropagation(); hover.current = true; sceneCursor(set().status.zones[z.id] === 'critical' ? 'danger' : 'select', `ZONE ${z.id}`) }}
          onPointerOut={() => { hover.current = false; sceneCursor(null) }}
          onClick={e => { e.stopPropagation(); set().selectZone(z.id) }}>
          <boxGeometry args={[ZONE_SIZE, 0.2, ZONE_SIZE]} />
          <meshStandardMaterial color="#12161e" roughness={0.9} />
        </mesh>
        <lineSegments position={[0, 0.1, 0]} geometry={plateEdges}>
          <lineBasicMaterial ref={edge} color={BRAND} />
        </lineSegments>
        {/* cross roads */}
        <mesh position={[0, 0.205, 0]}><boxGeometry args={[ZONE_SIZE - 0.4, 0.01, 1.2]} /><meshStandardMaterial color="#0b0d12" /></mesh>
        <mesh position={[0, 0.206, 0]}><boxGeometry args={[1.2, 0.01, ZONE_SIZE - 0.4]} /><meshStandardMaterial color="#0b0d12" /></mesh>
        {/* status wash over the plate */}
        <mesh ref={glow} position={[0, 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[ZONE_SIZE - 0.2, ZONE_SIZE - 0.2]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={ripple} position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ZONE_SIZE * 0.66, ZONE_SIZE * 0.7, 4, 1, Math.PI / 4]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={beam} position={[0, 2.7, 0]}>
          <cylinderGeometry args={[0.03, 0.9, 5, 8, 1, true]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} color={STATUS.critical.color} />
        </mesh>
      </group>
      <ZoneTag z={z} />
    </group>
  )
}

function ZoneTag({ z }) {
  const s = useCitadel(st => st.status.zones[z.id])
  const alerts = useCitadel(st => st.alerts.filter(a => a.zone === z.id).length)
  const iso = useCitadel(st => st.isolated.zones.includes(z.id))
  const failsafe = useCitadel(st => st.continuity.zones.includes(z.id))
  const booted = useCitadel(st => st.bootStage >= 'ABC'.indexOf(z.id) + 1)
  return (
    <Html position={[0, 0.5, ZONE_SIZE / 2 + 0.2]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag3d" data-s={s} data-hidden={!booted}>
        <StatusGlyph status={s} size={14} />
        <b>ZONE {z.id}</b><span>{z.name}</span>
        {alerts > 0 && <em>{alerts}</em>}
        {iso && <span className="iso">ISOLATED</span>}
        {failsafe && <span className="iso alt">FAIL-SAFE</span>}
      </div>
    </Html>
  )
}

// ── streetlights: everything instanced ───────────────────────────────────────
const SHAPES = { circle: 24, triangle: 3, octagon: 8 }
function Streetlights() {
  const poles = useRef(), heads = useRef(), cones = useRef(), crosses = useRef()
  const pads = { circle: useRef(), triangle: useRef(), octagon: useRef() }
  const ring = useRef()
  const N = LIGHTS.length

  useFrame(({ clock }) => {
    const st = useCitadel.getState(), t = clock.elapsedTime
    LIGHTS.forEach((l, i) => {
      const ls = st.lights[l.id], s = st.status.lights[l.id], on = ls.online
      const pw = Math.max(intro.power[l.zone], 0.0001)                         // intro: poles grow, lamps pop on
      tmp.position.set(l.pos[0], 0.2 + 0.55 * pw, l.pos[2]); tmp.scale.set(1, pw, 1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); poles.current.setMatrixAt(i, tmp.matrix)
      const k = (motion.reduced ? 1 : s === 'critical' ? 0.7 + 0.3 * Math.sin(t * 6 + i) : s === 'warning' ? 0.8 + 0.2 * Math.sin(t * 3.5 + i) : 1) * (ls.lit ? 1 : 0.22)
      tmpC.copy(on ? col[s] : col.offline).multiplyScalar(on ? k : 1)
      heads.current.setColorAt(i, tmpC)
      tmp.position.set(l.pos[0], 0.2 + 0.8 * pw, l.pos[2]); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar((on ? 1 : 0.8) * pw); tmp.updateMatrix(); heads.current.setMatrixAt(i, tmp.matrix)

      // light cone only when lit & online
      tmp.position.set(l.pos[0], 0.62, l.pos[2]); tmp.scale.setScalar(on && ls.lit ? pw : 0); tmp.updateMatrix(); cones.current.setMatrixAt(i, tmp.matrix)
      tmpC.copy(col[s]); cones.current.setColorAt(i, tmpC)

      // offline cross (2 bars per light)
      for (let b = 0; b < 2; b++) {
        tmp.position.set(l.pos[0], 1.0, l.pos[2]); tmp.rotation.set(0, 0, (b ? 1 : -1) * Math.PI / 4)
        tmp.scale.setScalar(on ? 0 : 1); tmp.updateMatrix(); crosses.current.setMatrixAt(i * 2 + b, tmp.matrix)
      }
    })
    // ground pads: shape encodes status (circle / triangle / octagon) — never colour alone.
    // Instances are grouped per shape; unused slots are scaled to 0.
    const slot = { circle: 0, triangle: 0, octagon: 0 }
    LIGHTS.forEach((l, i) => {
      const ls = st.lights[l.id], s = st.status.lights[l.id], on = ls.online
      const shape = !on ? 'circle' : STATUS[s].shape
      const m = pads[shape].current, j = slot[shape]++
      tmp.position.set(l.pos[0], 0.215, l.pos[2]); tmp.rotation.set(-Math.PI / 2, 0, shape === 'triangle' ? Math.PI / 2 : 0)
      tmp.scale.setScalar((s === 'normal' ? 0.5 : 0.8) * intro.power[l.zone]); tmp.updateMatrix(); m.setMatrixAt(j, tmp.matrix)
      m.setColorAt(j, on ? col[s] : col.offline)
    })
    for (const key of Object.keys(pads)) {
      const m = pads[key].current
      for (let j = slot[key]; j < N; j++) { tmp.scale.setScalar(0); tmp.updateMatrix(); m.setMatrixAt(j, tmp.matrix) }
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    for (const m of [heads.current, cones.current]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true }
    crosses.current.instanceMatrix.needsUpdate = true; poles.current.instanceMatrix.needsUpdate = true

    // selection ring
    const sel = st.selLight
    ring.current.visible = !!sel
    if (sel) { const l = LIGHTS.find(x => x.id === sel); ring.current.position.set(l.pos[0], 0.24, l.pos[2]); ring.current.scale.setScalar(1 + 0.12 * Math.sin(t * 5)) }
  })

  const pick = e => { e.stopPropagation(); const l = LIGHTS[e.instanceId]; if (l) { const s = useCitadel.getState(); s.selectZone(l.zone); s.selectLight(l.id) } }
  const over = e => { e.stopPropagation(); const l = LIGHTS[e.instanceId]; if (l) sceneCursor(useCitadel.getState().status.lights[l.id] === 'critical' ? 'danger' : 'select', l.id) }
  const out = () => sceneCursor(null)
  return (
    <group>
      <instancedMesh ref={poles} args={[null, null, N]}><cylinderGeometry args={[0.04, 0.05, 1.1, 6]} /><meshStandardMaterial color="#2b303c" /></instancedMesh>
      <instancedMesh ref={heads} args={[null, null, N]} onClick={pick} onPointerOver={over} onPointerOut={out}>
        <sphereGeometry args={[0.15, 12, 8]} /><meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={cones} args={[null, null, N]}>
        <coneGeometry args={[0.75, 0.8, 12, 1, true]} /><meshBasicMaterial transparent opacity={0.1} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={crosses} args={[null, null, N * 2]}><boxGeometry args={[0.34, 0.05, 0.05]} /><meshBasicMaterial color={SURFACE.dim} /></instancedMesh>
      {Object.entries(pads).map(([k, r]) => (
        <instancedMesh key={k} ref={r} args={[null, null, N]}>
          <circleGeometry args={[0.3, SHAPES[k]]} /><meshBasicMaterial transparent opacity={0.9} toneMapped={false} />
        </instancedMesh>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[0.62, 0.7, 32]} /><meshBasicMaterial color="#fff" toneMapped={false} /></mesh>
    </group>
  )
}

// ── server core ──────────────────────────────────────────────────────────────
const LED_ROWS = 7
function ServerCore() {
  const leds = useRef(), root = useRef()
  const markers = useRef({})
  useFrame(({ clock }) => {
    const st = useCitadel.getState(), t = clock.elapsedTime
    const pw = intro.power.core                                              // intro: the civic core rises last
    root.current.scale.y = Math.max(pw, 0.001); root.current.visible = pw > 0.002
    SERVERS.forEach((s, si) => {
      const sv = st.servers[s.id], status = st.status.servers[s.id]
      const load = Math.min(2.5, sv.rps / s.baseline)
      for (let r = 0; r < LED_ROWS; r++) {
        const i = si * LED_ROWS + r
        tmp.position.set(s.pos[0], 0.55 + r * 0.22, s.pos[2] + 0.49); tmp.rotation.set(0, 0, 0); tmp.scale.set(0.6, 0.07, 0.02); tmp.updateMatrix(); leds.current.setMatrixAt(i, tmp.matrix)
        const blink = sv.up ? (motion.reduced ? 0.8 : 0.35 + 0.65 * (Math.sin(t * (2 + load * 4) + i * 1.9) > 0.1 ? 1 : 0)) : 0.04
        tmpC.copy(col[status]).multiplyScalar(blink); leds.current.setColorAt(i, tmpC)
      }
      const g = markers.current[s.id]
      if (g) {
        g.position.y = motion.reduced ? 0 : 0.07 * Math.sin(t * 2 + si) + (status === 'critical' ? 0.05 * Math.sin(t * 9) : 0)
        g.children.forEach(m => { m.visible = m.userData.shape === STATUS[status].shape; m.material.color.copy(col[status]) })
      }
    })
    leds.current.instanceMatrix.needsUpdate = true; leds.current.instanceColor.needsUpdate = true
  })
  const pick = id => e => { e.stopPropagation(); useCitadel.getState().selectServer(id) }
  const over = id => e => { e.stopPropagation(); sceneCursor(useCitadel.getState().status.servers[id] === 'critical' ? 'danger' : 'select', SERVER_BY_ID[id].short) }
  const out = () => sceneCursor(null)
  return (
    <group ref={root}>
      <mesh position={[0, 0.1, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[3.0, 3.2, 0.25, 8]} /><meshStandardMaterial color="#12161e" roughness={0.9} /><Edges color={BRAND} threshold={15} />
      </mesh>
      {SERVERS.map(s => (
        <group key={s.id} position={s.pos}>
          <mesh position={[0, 1.35, 0]} onClick={pick(s.id)} onPointerOver={over(s.id)} onPointerOut={out}>
            <boxGeometry args={[0.95, 2.2, 0.95]} /><meshStandardMaterial color="#171b24" roughness={0.7} flatShading />
          </mesh>
          <Billboard position={[0, 2.75, 0]}>
            <group ref={el => (markers.current[s.id] = el)}>
              {Object.values(STATUS).map(st => (
                <mesh key={st.shape} userData={{ shape: st.shape }} rotation={[0, 0, st.shape === 'triangle' ? Math.PI / 2 : Math.PI / 8]}>
                  <circleGeometry args={[0.26, SHAPES[st.shape]]} /><meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
              ))}
            </group>
          </Billboard>
          <ServerTag id={s.id} />
        </group>
      ))}
      {/* LEDs live in world space (rack positions already baked in) */}
      <instancedMesh ref={leds} args={[null, null, SERVERS.length * LED_ROWS]}><boxGeometry /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    </group>
  )
}

function ServerTag({ id }) {
  const s = SERVER_BY_ID[id]
  const status = useCitadel(st => st.status.servers[id])
  const sv = useCitadel(st => st.servers[id])
  const iso = useCitadel(st => st.isolated.servers.includes(id))
  const standby = useCitadel(st => st.continuity.servers.includes(id))
  const booted = useCitadel(st => st.bootStage >= 4)
  return (
    <Html position={[0, 3.25, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag3d tag3d-srv" data-s={status} data-hidden={!booted}>
        <StatusGlyph status={status} size={12} />
        <div><b>{s.short}</b><span>{sv.up ? `${Math.round(sv.rps)} req/s` : 'OFFLINE'}</span>{iso && <span className="iso">ISOLATED</span>}{standby && <span className="iso alt">STANDBY</span>}</div>
      </div>
    </Html>
  )
}

// ── Zero Trust micro-perimeters ─────────────────────────────────────────────
// Raised when an incident's "isolate" step is ticked: translucent walls rise around the zone
// (or a cage around the rack). Brand colour on purpose: this is a control, not a status.
function Perimeters() {
  const zoneRefs = useRef({}), srvRefs = useRef({}), mats = useRef([])
  const wall = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 4, 1, true), [])
  const wallEdges = useMemo(() => new THREE.EdgesGeometry(wall), [wall])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const boxEdges = useMemo(() => new THREE.EdgesGeometry(box), [box])
  const half = (ZONE_SIZE / 2 + 0.12) / Math.SQRT1_2
  useFrame(({ clock }, dt) => {
    const iso = useCitadel.getState().isolated, t = clock.elapsedTime
    const step = (g, on) => { g.scale.y = THREE.MathUtils.damp(g.scale.y, on ? 1 : 0.001, 4, dt); g.visible = g.scale.y > 0.02 }
    ZONES.forEach(z => step(zoneRefs.current[z.id], iso.zones.includes(z.id)))
    SERVERS.forEach(s => step(srvRefs.current[s.id], iso.servers.includes(s.id)))
    const o = 0.1 + (motion.reduced ? 0 : 0.05 * Math.sin(t * 2))
    mats.current.forEach(m => m && (m.opacity = o))
  })
  const mat = el => el && !mats.current.includes(el) && mats.current.push(el)
  return (
    <group>
      {ZONES.map(z => (
        <group key={z.id} position={[z.center[0], 0.2, z.center[2]]} ref={el => (zoneRefs.current[z.id] = el)} visible={false}>
          <mesh geometry={wall} position={[0, 0.9, 0]} scale={[half, 1.8, half]} rotation={[0, Math.PI / 4, 0]}>
            <meshBasicMaterial ref={mat} color={BRAND} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            <lineSegments geometry={wallEdges}><lineBasicMaterial color={BRAND} /></lineSegments>
          </mesh>
        </group>
      ))}
      {SERVERS.map(s => (
        <group key={s.id} position={[s.pos[0], 0.25, s.pos[2]]} ref={el => (srvRefs.current[s.id] = el)} visible={false}>
          <mesh geometry={box} position={[0, 1.4, 0]} scale={[1.35, 2.8, 1.35]}>
            <meshBasicMaterial ref={mat} color={BRAND} transparent depthWrite={false} toneMapped={false} />
            <lineSegments geometry={boxEdges}><lineBasicMaterial color={BRAND} /></lineSegments>
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── mouse-reactive tilt: the city leans a few degrees toward the pointer, like a physical model ──
function Parallax({ children }) {
  const g = useRef()
  useFrame(({ pointer }, dt) => {
    const k = motion.reduced ? 0 : 1
    g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, pointer.x * 0.05 * k, 3, dt)
    g.current.rotation.x = THREE.MathUtils.damp(g.current.rotation.x, -pointer.y * 0.025 * k, 3, dt)
  })
  return <group ref={g}>{children}</group>
}

// ── scene root ───────────────────────────────────────────────────────────────
export default function CityScene() {
  const controls = useRef()
  const idle = useRef(0)
  return (
    <Canvas
      dpr={[1, 1.75]} camera={{ position: [0, 24, 38], fov: 36, near: 0.5, far: 120 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => { /* clicking empty table keeps selection; use Esc / close */ }}>
      <color attach="background" args={[SURFACE.bg]} />
      <fog attach="fog" args={[SURFACE.bg, 34, 70]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#aab4ff', '#0a0b10', 0.55]} />
      <directionalLight position={[8, 16, 10]} intensity={1.1} />
      <Parallax>
        <Table /><Roads /><Buildings />
        {ZONES.map(z => <Zone key={z.id} z={z} />)}
        <Streetlights />
        <ServerCore />
        <Perimeters />
      </Parallax>
      <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.07}
        minDistance={5} maxDistance={34} minPolarAngle={0.35} maxPolarAngle={1.38}
        autoRotate={!motion.reduced && !intro.enabled} autoRotateSpeed={0.22} onStart={() => (controls.current.autoRotate = false)} />
      <CameraRig controlsRef={controls} />
      <ViewShift />
    </Canvas>
  )
}
