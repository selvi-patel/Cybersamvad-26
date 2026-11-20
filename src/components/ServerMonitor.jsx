import { useCitadel } from '../store'
import { SERVERS, SERVICES } from '../sim/model'
import { THRESHOLDS, STATUS } from '../config'
import { health, availability, loginLevel } from '../sim/monitor'
import StatusGlyph from './StatusGlyph'
import Spark from './Spark'

function ServerCard({ srv, i }) {
  const sv = useCitadel(s => s.servers[srv.id])
  const status = useCitadel(s => s.status.servers[srv.id])
  const iso = useCitadel(s => s.isolated.servers.includes(srv.id))
  const standby = useCitadel(s => s.continuity.servers.includes(srv.id))
  const sel = useCitadel(s => s.selServer === srv.id)
  const alerts = useCitadel(s => s.alerts).filter(a => a.assetId === srv.id)
  const h = health(sv, srv, alerts), av = availability(sv)
  const lvl = loginLevel(sv.failedLogins), thr = srv.baseline * THRESHOLDS.spike.multiplier
  const ratio = sv.rps / srv.baseline
  return (
    <article className="hcard srv" style={{ '--i': i }} data-s={status} data-sel={sel}>
      <header>
        <StatusGlyph status={status} size={15} />
        <div><b>{srv.name}</b><span>{srv.id} · {SERVICES[srv.service].label}</span></div>
        {iso && <em className="chipb">ISOLATED</em>}{standby && <em className="chipb alt">STANDBY</em>}
      </header>
      <div className="srv-nums">
        <div><span className="lab">HEALTH</span><b className="display big" style={{ color: STATUS[status].color }}>{h}</b></div>
        <div><span className="lab">AVAILABILITY</span><b className="display big">{av.toFixed(1)}<small>%</small></b></div>
        <div data-s={lvl}><span className="lab">FAILED LOGINS</span>
          <b className="display big" style={{ color: STATUS[lvl].color }}>{sv.failedLogins}<small>/{THRESHOLDS.bruteForce.fails}</small></b>
          <i className="pips" aria-hidden>{[...Array(THRESHOLDS.bruteForce.fails)].map((_, k) => <u key={k} data-on={k < sv.failedLogins} />)}</i>
        </div>
      </div>
      <div className="srv-spark">
        <div className="lab"><span>REQUESTS / S</span><span>{sv.up ? `${Math.round(sv.rps)} now` : 'NO RESPONSE'}</span></div>
        <Spark values={sv.history} baseline={srv.baseline} threshold={thr} />
        <div className="lab dimmer"><span>- - baseline {srv.baseline}</span><span>· · alert at {Math.round(thr)} (&gt;{THRESHOLDS.spike.multiplier}×)</span></div>
      </div>
      <footer>
        {!sv.up ? <b className="down"><StatusGlyph status="critical" size={12} /> SERVICE DOWN</b>
          : ratio > THRESHOLDS.spike.multiplier ? <b style={{ color: 'var(--crit)' }}><StatusGlyph status="critical" size={12} /> {ratio.toFixed(1)}× BASELINE</b>
          : alerts.length ? <b style={{ color: STATUS[status].color }}><StatusGlyph status={status} size={12} /> {alerts[0].title}{alerts.length > 1 ? ` +${alerts.length - 1}` : ''}</b>
          : <span><StatusGlyph status="normal" size={12} /> Nominal</span>}
        <button className="link" onClick={() => useCitadel.getState().selectServer(srv.id)}>Locate in model →</button>
      </footer>
    </article>
  )
}

export default function ServerMonitor() {
  const down = useCitadel(s => Object.values(s.servers).filter(v => !v.up))
  return (
    <>
      {down.length > 0 && <div className="vbanner" role="alert"><StatusGlyph status="critical" size={16} /> CRITICAL SERVICE DOWN · {down.map(d => d.id).join(', ')} · public service affected</div>}
      <div className="vgrid cols4">{SERVERS.map((s, i) => <ServerCard key={s.id} srv={s} i={i} />)}</div>
    </>
  )
}
