import { useCitadel } from '../store'
import { RISK_LEVELS, STATUS } from '../config'
import StatusGlyph from './StatusGlyph'

// Compact city-risk read-out: level + score + four-step scale (Low / Elevated / High / Critical).
export default function RiskGauge() {
  const risk = useCitadel(s => s.risk)
  const lvl = risk.level
  return (
    <div className="gauge compact-g" data-s={lvl.status} role="status" aria-label={`City risk level ${lvl.label}, score ${risk.score} of 100`}>
      <div className="eyebrow">CITY RISK</div>
      <div className="gauge-read">
        <StatusGlyph status={lvl.status} size={16} hollow={lvl.key === 'high'} className={lvl.key === 'critical' ? 'pulse' : ''} />
        <span className="display gauge-level" style={{ color: STATUS[lvl.status].color }}>{lvl.label}</span>
        <span className="display gauge-score">{risk.score}<small>/100</small></span>
      </div>
      <i className="scale" aria-hidden>{RISK_LEVELS.map(l => <u key={l.key} data-on={RISK_LEVELS.indexOf(l) <= RISK_LEVELS.indexOf(lvl)} data-s={l.status} />)}</i>
    </div>
  )
}
