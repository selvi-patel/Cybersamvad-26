import { STATUS } from '../config'

// Status is ALWAYS shape + colour (circle = normal, triangle = warning, octagon = critical).
const PATHS = {
  circle: <circle cx="8" cy="8" r="6" />,
  triangle: <polygon points="8,1.5 15,14 1,14" />,
  octagon: <polygon points="5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5" />,
}
export default function StatusGlyph({ status = 'normal', size = 14, hollow = false, className = '' }) {
  const st = STATUS[status]
  return (
    <svg className={`glyph ${className}`} width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={st.label}
         fill={hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={hollow ? 1.8 : 0} strokeLinejoin="round"
         style={{ color: st.color }}>
      {PATHS[st.shape]}
    </svg>
  )
}
