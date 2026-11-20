# CITADEL: Smart City Security Command Center

> **Simulation only.** Everything is synthetic and runs client-side in the browser. There is no networking, scanning, or attack code, and no real city infrastructure is touched.

Built for **Cybersamvad-26** by Selvi Patel

**Track:** Smart City and Critical Infrastructure Cybersecurity
**Demo:** [live link or video link]

![CITADEL screenshot] <img width="959" height="407" alt="Screenshot" src="https://github.com/user-attachments/assets/c92c834a-f1d2-4f74-aef4-b0fdf3662073" />


## The challenge

City services such as water, traffic, public lighting, and transport depend on connected systems. The task was to build a safe dashboard or simulation that helps an operator notice suspicious activity and prioritise the response.

## What CITADEL does

CITADEL is a 3D command center for a simulated city. An operator can watch assets, see attacks appear as they happen, decide what to deal with first, and keep a record of what was done.

| Requirement | How CITADEL covers it |
|---|---|
| Mock dashboard for sample assets | A 3D city (with a 2D fallback) of zones, streetlights, servers, and public services |
| Simulated alerts, asset status, and a simple risk level | Rule-based detection (R1 to R7) raises alerts. Every asset shows Normal, Warning, or Critical, using shapes as well as colour. A city risk read-out summarises the overall level |
| Prioritise alerts by impact and urgency | `PRIORITY = IMPACT × URGENCY`. Impact comes from how important the affected service is, and urgency from the detection rule. The alert queue is sorted by this score |
| Basic response checklist | Each alert opens an incident with 4 steps: isolate, notify, verify continuity / fail over, and record |
| Incident log with time, status, and action | Incidents move New → Investigating → Contained → Resolved. Every detection, tick, and reset goes into an append-only audit log, secured with a SHA-256 hash chain, that can be verified and exported as CSV or JSON |

## What to demonstrate

1. **Trigger a suspicious event.** Press RUN on any scenario card: streetlight flicker, brute-force login, request surge, rogue remote command, or service outage. The tracker lights up as the event is detected, shown in the 3D city, queued, and logged.
2. **Prioritise and record the incident.** The alert queue ranks alerts by impact and urgency. "Why flagged" explains which rule fired. Ticking checklist steps updates the incident status and writes to the audit log.
3. **Show resilience and continuity.** Isolating a zone raises a Zero Trust micro-perimeter that blocks hostile traffic. In the Resilience view, a service moves to its backup path during an incident and returns to normal once it is resolved. Failing over an outage restores the affected server.

Press **AUTO DEMO** to play all of this automatically in about 3½ minutes.

## Safe by design

CITADEL follows the challenge's rule: use only a simulated environment. All events come from a built-in generator. Nothing scans, accesses, or disrupts real systems.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 10 unit tests for the detection rules (plain Node, no browser)
npm run build && npm run preview
```
Force a renderer with `?mode=2d` or `?mode=3d` (auto-detected otherwise: narrow screens, ≤2 cores, Save-Data or no WebGL2 → 2D).

 `src/lib/autodemo.js` (2.2 = 2.2× the original script; lower it to speed up the default).

## Verified in testing
Touch-drag resize of the zone panel (side hinge and bottom sheet) via real touch events; alert-sound output level measured on the audio graph (warning peak 0.16, critical 0.24 of full scale); pause freezes all state; full demo timed at about 3.7 min.
"# Cybersamvad-26" 
