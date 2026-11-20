// Request-rate sparkline with baseline + threshold guides. Neutral colours: status colour is reserved for status.
export default function Spark({ values, baseline, threshold, w = 220, h = 62 }) {
  const max = Math.max(threshold * 1.15, ...values), pad = 3
  const x = i => pad + (i / (values.length - 1)) * (w - pad * 2)
  const y = v => h - pad - (v / max) * (h - pad * 2)
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values.at(-1)
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Request rate ${Math.round(last)} per second, baseline ${baseline}`} preserveAspectRatio="none">
      <line x1="0" x2={w} y1={y(threshold)} y2={y(threshold)} className="sp-thr" />
      <line x1="0" x2={w} y1={y(baseline)} y2={y(baseline)} className="sp-base" />
      <polyline points={`${pad},${h} ${pts} ${w - pad},${h}`} className="sp-area" />
      <polyline points={pts} className="sp-line" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="2.8" className="sp-dot" />
    </svg>
  )
}
