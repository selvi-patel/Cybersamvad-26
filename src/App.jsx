import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useCitadel } from './store'
import { detectMode } from './lib/device'
import { smoothPage } from './lib/smooth'
import { initSound, setSound, sound, playAlert } from './lib/sound'
import Boot from './components/Boot'
import Cursor from './components/Cursor'
import AutoCaption from './components/AutoCaption'
import { useNow, fmtTime } from './lib/format'
import RiskGauge from './components/RiskGauge'
import AlertQueue from './components/AlertQueue'
import EventFeed from './components/EventFeed'
import ZonePanel from './components/ZonePanel'
import ZoneMap2D from './components/ZoneMap2D'
import ZoneBar from './components/Controls'
import Filmstrip from './components/Filmstrip'
import IncidentPanel from './components/IncidentPanel'
import AuditLog, { AuditChip } from './components/AuditLog'
import ViewDrawer, { ViewBar } from './components/ViewDrawer'
import StatusGlyph from './components/StatusGlyph'

const CityScene = lazy(() => import('./scene/CityScene'))   // three.js is code-split & lazy

function RailLower() {
  const tab = useCitadel(s => s.railTab)
  const open = useCitadel(s => s.incidents.filter(i => i.status !== 'Resolved').length)
  const setTab = useCitadel.getState().setRailTab
  return (
    <section className="panel lower" aria-label="Incident and live events">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'incident'} onClick={() => setTab('incident')}>RESPONSE{open > 0 && <b>{open}</b>}</button>
        <button role="tab" aria-selected={tab === 'events'} onClick={() => setTab('events')}>LIVE EVENTS</button>
      </div>
      <div className="lower-body">{tab === 'incident' ? <IncidentPanel /> : <EventFeed bare />}</div>
    </section>
  )
}

// Left column is retracted by default (less clutter). The handle shows the live alert count and pulses on new criticals.
function RailHandle() {
  const open = useCitadel(s => s.railOpen)
  const n = useCitadel(s => s.alerts.length)
  const crit = useCitadel(s => s.alerts.some(a => a.severity === 'critical'))
  const inc = useCitadel(s => s.incidents.filter(i => i.status !== 'Resolved').length)
  return (
    <button className="rail-handle" data-open={open} data-s={crit ? 'critical' : n ? 'warning' : 'normal'} data-hot={!open && crit}
            aria-expanded={open} aria-label={open ? 'Retract alert panel' : `Open alert panel, ${n} active alerts`} title={open ? 'Retract' : 'Alerts, response and live events'}
            onClick={() => useCitadel.getState().setRailOpen(!open)}>
      <StatusGlyph status={crit ? 'critical' : n ? 'warning' : 'normal'} size={12} />
      <b className="display">{String(n).padStart(2, '0')}</b>
      <span>{open ? 'RETRACT' : 'ALERTS'}</span>
      {!open && inc > 0 && <em>{inc} INC</em>}
    </button>
  )
}

function Header() {
  const [on, setOn] = useState(sound.on)
  return (
    <header className="head">
      <div>
        <h1 className="display wordmark">CITADEL</h1>
        <div className="eyebrow">SMART-CITY SECURITY OPERATIONS · 3 ZONES · 4 SERVICES</div>
      </div>
      <div className="head-r">
        <div className="sim-badge" role="note"><span className="dot" />SIMULATION ONLY<small>synthetic data · no real systems</small></div>
        <button className="snd" aria-pressed={on} onClick={() => { setSound(!on); setOn(!on) }} title="Audible tone when a new alert is raised: two beeps for a warning, three urgent pulses for a critical">
          ALERT SOUND {on ? 'ON' : 'OFF'}
        </button>
      </div>
    </header>
  )
}

// editorial edge label: breaks the grid on purpose, doubles as a live city clock
function EdgeLabel() {
  const now = useNow(1000)
  return <div className="edge" aria-hidden>CITADEL OPS-01 · CITY TIME {fmtTime(now)} · LIVE FEED · SIMULATED</div>
}

export default function App() {
  const [mode, setMode] = useState(detectMode)
  const newest = useCitadel(s => s.newest)
  const panelOpen = useCitadel(s => !!s.panelZone)
  const booting = useCitadel(s => s.bootStage < 5)
  const railOpen = useCitadel(s => s.railOpen)
  const downSrv = useCitadel(s => Object.values(s.servers).filter(v => !v.up))
  const page = useRef(null)
  useEffect(() => { initSound(); useCitadel.getState().start(); return () => useCitadel.getState().stop() }, [])
  useEffect(() => { if (newest) playAlert(newest.severity) }, [newest])
  // re-pick 3D / 2D when the window crosses the breakpoint (unless forced with ?mode=)
  useEffect(() => {
    if (new URLSearchParams(location.search).get('mode')) return
    let t; const r = () => { clearTimeout(t); t = setTimeout(() => setMode(detectMode()), 200) }
    addEventListener('resize', r); return () => { removeEventListener('resize', r); clearTimeout(t) }
  }, [])
  // 2D layout: Lenis page scroll + ScrollTrigger section reveals
  useEffect(() => { if (mode !== '2d' || !page.current) return; const s = smoothPage(page.current); return s.destroy }, [mode])

  const banner = downSrv.length > 0 && (
    <div className="banner" role="alert"><StatusGlyph status="critical" size={18} />
      CRITICAL SERVICE DOWN · {downSrv.map(s => s.id).join(', ')}</div>
  )

  if (mode === '2d') return (
    <main className="compact" ref={page}>
      <Header />
      {banner}
      <RiskGauge />
      <ZoneMap2D />
      <ZonePanel mode="sheet" />
      <ZoneBar />
      <ViewBar />
      <Filmstrip />
      <ViewDrawer inline />
      <AlertQueue />
      <section className="panel lower inline"><div className="lower-body"><IncidentPanel /></div></section>
      <EventFeed />
      <AuditLog inline />
      <AutoCaption />
      <div className="sr" aria-live="assertive">{newest ? `New alert: ${newest.title} on ${newest.assetId}` : ''}</div>
    </main>
  )

  return (
    <>
    <Cursor />
    <main className="stage" data-panel={panelOpen} data-booting={booting} data-rail={railOpen ? 'open' : 'closed'}>
      <div className="canvas-wrap">
        <Suspense fallback={<div className="boot eyebrow">LOADING CITY MODEL…</div>}><CityScene /></Suspense>
      </div>
      <Header />
      <div className="rail-r"><RiskGauge /><AuditChip /></div>
      <div className="rail-l" inert={railOpen ? undefined : ''}><AlertQueue /><RailLower /></div>
      <RailHandle />
      {banner}
      <ZonePanel />
      <div className="topctl"><ZoneBar /><ViewBar /></div>
      <div className="botctl"><Filmstrip /></div>
      <ViewDrawer />
      <AuditLog />
      <EdgeLabel />
      <AutoCaption />
      <Boot />
      <div className="sr" aria-live="assertive">{newest ? `New alert: ${newest.title} on ${newest.assetId}` : ''}</div>
    </main>
    </>
  )
}
