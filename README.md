# CITADEL — smart-city security command center (SIMULATION ONLY)

Everything is synthetic and client-side. No networking, scanning or attack code.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 10 unit tests for the detection rules (plain Node, no browser)
npm run build && npm run preview
```
Force a renderer with `?mode=2d` or `?mode=3d` (auto-detected otherwise: narrow screens, ≤2 cores, Save-Data or no WebGL2 → 2D).

## Structure (build steps 1–5)
```
src/
  config.js            ← COLORS, FONTS, THRESHOLDS, tick rate, risk bands, panel widths
  store.js             ← Zustand store + engine wiring (generator → detector → alert book → UI)
  sim/
    model.js           ← zones, streetlights, servers, services (+impact), 3D positions
    events.js          ← event envelope
    generator.js       ← 1–3 s event stream + control API used by scenarios
    rules.js           ← rule catalogue (R1–R7): text shown as "WHY FLAGGED", Zero Trust pillar
    detector.js        ← rule engine (pure; sliding windows)
    alertBook.js       ← merge/score/expire alerts
    scoring.js         ← PRIORITY = IMPACT × URGENCY, risk gauge maths
    scenarios.js       ← 5 simulated attacks (flicker, brute force, surge, rogue remote, outage); events carry `hostile`
    incidents.js       ← incident model, 4-step checklist, lifecycle rules (New → Investigating → Contained → Resolved)
    audit.js           ← append-only SHA-256 hash chain, verify(), CSV/JSON export
    sha256.js          ← Web Crypto, with a pure-JS fallback for plain-http demos
    monitor.js         ← server health score, availability, failed-login level
    zeroTrust.js       ← 5 CISA ZTMM pillars: rule → pillar mapping, live status, enforcement
    resilience.js      ← per-service state (operational / on backup / degraded / down); BACKUPS live in model.js
  scene/CityScene.jsx  ← R3F tabletop city, instanced lights, server racks, camera rig
  lib/                 ← autodemo.js (one-click guided demo), intro.js (boot controller, camera poses), cursor.js, smooth.js (Lenis + ScrollTrigger), sound.js, fx.js (tilt, magnet), device.js (2D/3D + live reduced-motion flag)
  components/          ← Boot (intro), Cursor, AlertQueue, RiskGauge, ZonePanel (hinged), EventFeed, ZoneMap2D, ZoneBar,
                         Filmstrip (scenario cards + flow tracker), IncidentPanel (checklist), AuditLog,
                         ViewDrawer → ServerMonitor, ZeroTrust, Resilience, Spark
test/detector.test.mjs
```

## Where to tweak
| What | Where |
|---|---|
| Brand / status colours, surfaces | `src/config.js` → `BRAND`, `STATUS`, `SURFACE` (injected as CSS vars + read by the 3D scene) |
| Fonts | `FONTS` in `src/config.js` **and** the Google Fonts `<link>` in `index.html` |
| Detection thresholds (5 changes/60 s, 5 fails/2 min, >3× baseline, odd hours…) | `THRESHOLDS` in `src/config.js` |
| Alert lifetime, critical cut-off score | `alertTtlMs`, `critScore` in `THRESHOLDS` |
| Event cadence | `TICK` in `src/config.js` |
| Impact of each public service | `SERVICES[*].impact` in `src/sim/model.js` |
| Urgency rules per detection | `urgency` arguments in `src/sim/detector.js` |
| Risk gauge weighting / bands | `riskFrom()` in `scoring.js`, `RISK_LEVELS` in config |
| Scenario pacing / targets | `src/sim/scenarios.js` |
| 3D assets | `Buildings`, `ServerCore` in `CityScene.jsx` are procedural; swap for GLTFs via drei `useGLTF` |
| Camera poses | `HOME` / `poseFor()` in `CityScene.jsx` |

## Status is never colour alone
circle = Normal (green), triangle = Warning (yellow), octagon = Critical (red). Used in the DOM (`StatusGlyph`), on the 3D ground pads under each light, on server markers, and in the 2D map.

## Demo flow (step 3)
Click RUN on a filmstrip card. The tracker lights up as each stage really happens:
`EVENT → RULE FIRED → 3D MODEL → QUEUED → CHECKLIST → LOGGED`.
- Every new alert opens an **incident** with 4 steps: isolate, notify, verify continuity / fail over, record. Ticking is one-way.
- **Isolate** raises a Zero Trust micro-perimeter in the 3D map. Hostile traffic to that zone/server is then blocked before it reaches the detector, and the alert cools ~8 s later.
- **Fail over** on a service outage actually restores the server and clears the alert.
- Status moves New → Investigating → Contained → Resolved; every tick, detection and reset is appended to the **audit log** (open it from the right rail).
- Reset restores the city but never clears the audit log (append-only).
- Tamper test (console only, there is intentionally no edit UI): replace an entry in `__citadel.engine.audit.entries` and press RE-VERIFY → "CHAIN BROKEN at entry #n".
- `npm test` covers the hash chain (tamper, deletion, freeze), the SHA-256 fallback vs Web Crypto, and the incident lifecycle.

## Views (step 4): SERVERS · ZERO TRUST · RESILIENCE (top bar, or click a rack in the 3D model)
- **Servers:** health score, availability (uptime samples), failed-login counter (x/5), request-rate sparkline with baseline and 3× alert line. Weights in `sim/monitor.js`.
- **Zero Trust:** failed logins/unusual logins/denied access → Identity; flicker/remote commands → Devices; request spikes + **zone/server isolation + blocked events** → Networks; service outage → Applications & Workloads; audit-chain integrity + successful unusual logins → Data. Prototype mapping, not a compliance assessment.
- **Resilience:** each service shows its primary vs backup path, switch-over time and manual fallback (edit `BACKUPS` in `sim/model.js`). Ticking *isolate* or *verify continuity / fail over* moves a service onto its backup path until the incident is resolved (failback).

## Motion, cursor, responsive (step 5)
- **Intro:** `Boot.jsx` runs a ~4.8 s GSAP timeline: log lines, camera fly-in, zone A → B → C → civic core rise out of the table (`intro.power` scales buildings, lights and racks), then the UI panels glide in. Click or press any key to skip. `?intro=0` disables it. Pacing = the seconds in `run()` and `LOG`.
- **Cursor:** dot + ring, fine pointers only. default (ring) · hover (filled ring) · select (brackets, over 3D zones/lights/racks, with a label) · **danger** (red octagon over anything CRITICAL) · drag (filmstrip). Add `data-cursor="select" data-cursor-label="…"` to any element to opt in.
- **Smooth scroll:** Lenis drives the filmstrip (wheel/trackpad glide it sideways; numerals drift with parallax) and the 2D page, where ScrollTrigger reveals each section. The city also leans a few degrees toward the pointer.
- **Alert sound (optional):** header toggle, off by default, soft two-tone on a *new critical* alert. Only starts after a click (browser autoplay rules).
- **Reduced motion:** no intro, no Lenis, no tilt/magnet/ripple/flicker/bobbing, static glow, instant camera moves, CSS animations collapsed. It follows the OS setting live.
- **Responsive:** ≥1680 px side hinge · 1100–1679 px zone panel becomes a bottom sheet · <1100 px simplified 2D layout (re-evaluated live on resize). Short screens compact the filmstrip. Breakpoints: `UI.foldMinWidth` in `config.js`, the `@media` blocks in `index.css`, and `detectMode()` in `lib/device.js`.

## One-click auto demo
**AUTO DEMO** (filmstrip header, brand-coloured) plays the whole story in about 3½ minutes (paced so you can read and explain each caption), driving the real app rather than a recording:
flicker attack → brute-force login (server monitor, then Zero Trust view) → dispatch outage (resilience view, failover) → audit trail (chain verified, export).
Each scene resets the city, launches the real scenario, waits for the real detection, then ticks the real checklist steps with a caption per step.
STOP (button or Esc) leaves the city as it is. Pressing any scenario card or Reset takes over manually. The audit log is never cleared, so it keeps the full record.
Edit the script in `src/lib/autodemo.js` (`SCENES`, `CAP`, the `sleep()` values). `?demospeed=2` plays at double speed.

## UI tidy-up pass
- **Left column retracted by default.** Click the ALERTS tab on the left edge (it shows the live count, goes red and pulses on a critical, and shows open incidents). It opens by itself during AUTO DEMO.
- **City risk** is now a compact read-out (level, score, four-step scale) instead of the big gauge.
- **Zone panel is resizable.** Drag the grip on its outer edge (side hinge: left edge; bottom sheet: top edge), or focus it and use the arrow keys. Double-click resets. Limits: `setLeafW` / `setSheetH` in `store.js`.
- **Alert sound** is audible and on by default: two beeps for a new warning, three urgent pulses for a new critical. Toggle in the header; remembered. Volume and pitches: `playAlert()` in `lib/sound.js`.
- **LOCATE** is a permanent button on every alert row. Servers fly to the racks and open the server monitor; zone alerts fly to the zone; light alerts also ring the exact light.

**Demo controls (caption box):** PAUSE / RESUME (or the Space key, anywhere) freezes the demo so you can talk through a step; PACE cycles normal → slower → slowest → faster; STOP / Esc ends it. The base pace is `PACE` at the top of `src/lib/autodemo.js` (2.2 = 2.2× the original script; lower it to speed up the default).

## Verified in testing
Touch-drag resize of the zone panel (side hinge and bottom sheet) via real touch events; alert-sound output level measured on the audio graph (warning peak 0.16, critical 0.24 of full scale); pause freezes all state; full demo timed at about 3.7 min.
"# Cybersamvad-26" 
