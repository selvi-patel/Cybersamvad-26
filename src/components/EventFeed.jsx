import { useCitadel } from '../store'
import { fmtTime } from '../lib/format'
import StatusGlyph from './StatusGlyph'

const describe = ev => {
  const d = ev.data
  switch (ev.kind) {
    case 'light.state': return `${d.lit ? 'ON ' : 'OFF'} set by ${d.source}`
    case 'light.fault': return d.online ? 'back online' : 'lost comms'
    case 'light.remote': return `remote cmd ×${d.count} from ${d.source} @${String(d.hour).padStart(2, '0')}h`
    case 'light.access': return `access ${d.result} (${d.source})`
    case 'server.login': return `login ${d.ok ? 'ok' : 'FAILED'} ${d.user} · ${d.location}`
    case 'server.status': return d.up ? 'health probe OK' : 'HEALTH PROBE FAILED'
    default: return ev.kind
  }
}

export default function EventFeed({ bare = false }) {
  const feed = useCitadel(s => s.feed)
  const totals = useCitadel(s => s.totals)
  return (
    <section className={bare ? 'feed bare' : 'panel feed'} aria-label="Live event stream">
      <header className="panel-h tight">
        <div className="eyebrow">EVENTS → DETECTIONS</div>
        <div className="eyebrow dimmer">{totals.events} ev · {totals.detections} det{totals.blocked ? ` · ${totals.blocked} blocked` : ''}</div>
      </header>
      <ul className="feed-list">
        {feed.slice(0, 40).map(f => f.type === 'blocked' ? (
          <li key={f.id} className="f-blk"><time>{fmtTime(f.ts)}</time><b>{f.ev.assetId}</b><span>BLOCKED at micro-perimeter · {describe(f.ev)}</span></li>
        ) : f.type === 'detection' ? (
          <li key={f.id} className="f-det" data-s={f.alert.severity}>
            <time>{fmtTime(f.ts)}</time><StatusGlyph status={f.alert.severity} size={11} />
            <span>RULE {f.alert.code} FIRED · {f.alert.title} · {f.alert.assetId}</span>
          </li>
        ) : (
          <li key={f.id}><time>{fmtTime(f.ts)}</time><b>{f.ev.assetId}</b><span>{describe(f.ev)}</span></li>
        ))}
      </ul>
    </section>
  )
}
