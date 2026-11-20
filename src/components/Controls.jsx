import { useCitadel } from '../store'
import { ZONES } from '../sim/model'
import StatusGlyph from './StatusGlyph'

// Zone switcher: keyboard-accessible alternative to clicking the model.
export default function ZoneBar() {
  const status = useCitadel(s => s.status.zones)
  const panelZone = useCitadel(s => s.panelZone)
  const { selectZone, goHome } = useCitadel.getState()
  return (
    <div className="zonebar" role="group" aria-label="Zones">
      <button className="zb" data-on={!panelZone} onClick={goHome}>CITY</button>
      {ZONES.map(z => (
        <button key={z.id} className="zb" data-on={panelZone === z.id} onClick={() => selectZone(z.id)}>
          <StatusGlyph status={status[z.id]} size={12} /> {z.id}
        </button>
      ))}
    </div>
  )
}
