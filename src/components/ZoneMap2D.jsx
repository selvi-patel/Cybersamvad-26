// Simplified 2D fallback (mobile / low-power / no WebGL). Same store, same shapes + colours.
import { useCitadel } from '../store'
import { ZONES, LIGHTS, SERVERS, ZONE_SIZE } from '../sim/model'
import { STATUS } from '../config'
import StatusGlyph from './StatusGlyph'

const S = 14                                    // px per world unit
const bounds = { x0: -12.5, z0: -8, w: 25, h: 21 }
const X = x => (x - bounds.x0) * S, Z = z => (z - bounds.z0) * S

const Shape = ({ shape, c, r = 6 }) =>
  shape === 'circle' ? <circle r={r} fill={c} />
  : shape === 'triangle' ? <polygon points={`0,${-r - 1} ${r + 2},${r} ${-r - 2},${r}`} fill={c} />
  : <polygon points={[...Array(8)].map((_, i) => `${(r + 1) * Math.cos(Math.PI / 8 + i * Math.PI / 4)},${(r + 1) * Math.sin(Math.PI / 8 + i * Math.PI / 4)}`).join(' ')} fill={c} />

export default function ZoneMap2D() {
  const status = useCitadel(s => s.status)
  const lights = useCitadel(s => s.lights)
  const servers = useCitadel(s => s.servers)
  const panelZone = useCitadel(s => s.panelZone)
  const selectZone = useCitadel(s => s.selectZone)
  return (
    <svg className="map2d" viewBox={`0 0 ${bounds.w * S} ${bounds.h * S}`} role="group" aria-label="City map, simplified">
      {ZONES.map(z => {
        const s = status.zones[z.id], c = STATUS[s].color
        return (
          <g key={z.id} tabIndex={0} role="button" aria-label={`Zone ${z.id}, ${STATUS[s].label}`} className="z2d" data-sel={panelZone === z.id}
             onClick={() => selectZone(z.id)} onKeyDown={e => e.key === 'Enter' && selectZone(z.id)}>
            <rect x={X(z.center[0] - ZONE_SIZE / 2)} y={Z(z.center[2] - ZONE_SIZE / 2)} width={ZONE_SIZE * S} height={ZONE_SIZE * S}
                  fill={s === 'normal' ? 'transparent' : c} fillOpacity=".1" stroke={s === 'normal' ? 'var(--brand)' : c} strokeWidth="2" />
            <text x={X(z.center[0]) } y={Z(z.center[2] - ZONE_SIZE / 2) + 18} textAnchor="middle" className="z2d-t">ZONE {z.id}</text>
          </g>
        )
      })}
      {LIGHTS.map(l => {
        const s = status.lights[l.id], on = lights[l.id].online
        return <g key={l.id} transform={`translate(${X(l.pos[0])} ${Z(l.pos[2])})`} opacity={lights[l.id].lit ? 1 : 0.45}>
          <Shape shape={on ? STATUS[s].shape : 'circle'} c={on ? STATUS[s].color : 'var(--offline)'} />
          {!on && <path d="M-4 -4L4 4M4 -4L-4 4" stroke="var(--dim)" strokeWidth="1.5" />}
        </g>
      })}
      {SERVERS.map(s => {
        const st = status.servers[s.id], up = servers[s.id].up
        return <g key={s.id} role="img" aria-label={`${s.name}: ${up ? STATUS[st].label : 'DOWN'}`} transform={`translate(${X(s.pos[0] * 1.6)} ${Z(s.pos[2] * 1.6)})`}>
          <rect x="-18" y="-18" width="36" height="36" fill="var(--panel)" stroke={STATUS[st].color} strokeWidth="2" strokeDasharray={up ? undefined : '4 3'} />
          <g transform="translate(0 -5)"><Shape shape={STATUS[st].shape} c={STATUS[st].color} r={5} /></g>
          <text y="12" textAnchor="middle" className="z2d-s">{up ? s.code : 'DOWN'}</text>
        </g>
      })}
    </svg>
  )
}
