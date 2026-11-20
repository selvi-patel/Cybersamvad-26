// ─────────────────────────────────────────────────────────────────────────────
// CITADEL — single source of truth for theme, thresholds and layout constants.
// Colors/fonts here are injected as CSS variables at startup (see lib/theme.js)
// and read directly by the 3D scene, so editing this file re-skins everything.
// ─────────────────────────────────────────────────────────────────────────────

// ── COLORS ── tweak here ─────────────────────────────────────────────────────
// BRAND is the ONLY non-status accent. Never use the status colors decoratively.
export const BRAND = '#8C7BFF'

export const STATUS = {
  normal:   { key: 'normal',   label: 'NORMAL',   color: '#2FD27E', shape: 'circle',   rank: 0 },
  warning:  { key: 'warning',  label: 'WARNING',  color: '#FFC233', shape: 'triangle', rank: 1 },
  critical: { key: 'critical', label: 'CRITICAL', color: '#FF4651', shape: 'octagon',  rank: 2 },
}

export const SURFACE = {
  bg: '#07080B', panel: '#0D0F14', line: '#232733', ink: '#ECEEF4', dim: '#8A90A2', offline: '#3A3F4B',
}

// ── FONTS ── (also change the <link> in index.html) ──────────────────────────
export const FONTS = {
  display: "'Big Shoulders Display', 'Arial Narrow', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
}

// ── DETECTION THRESHOLDS ── tweak here ───────────────────────────────────────
export const THRESHOLDS = {
  flicker:      { changes: 5, windowMs: 60_000 },                    // rule R1
  remote:       { bulkCount: 8, oddFrom: 22, oddTo: 5 },             // rule R2 (odd hour = 22:00–05:00)
  unauthorized: { attempts: 3, windowMs: 60_000 },                   // rule R3
  bruteForce:   { fails: 5, windowMs: 120_000 },                     // rule R4
  spike:        { multiplier: 3, clearBelow: 1.5 },                  // rule R6  (>3× baseline)
  alertTtlMs: 75_000,   // an alert with no fresh evidence for this long auto-clears (R7 is sticky)
  critScore: 15,        // priority score at/above which an alert is CRITICAL (max score is 25)
}

// ── EVENT GENERATOR ──────────────────────────────────────────────────────────
export const TICK = { minMs: 1000, maxMs: 3000 }   // spec: one event every 1–3 s

// ── RISK GAUGE ── score 0–100 → level ────────────────────────────────────────
export const RISK_LEVELS = [
  { key: 'low',      label: 'LOW',      from: 0,  status: 'normal'   },
  { key: 'elevated', label: 'ELEVATED', from: 25, status: 'warning'  },
  { key: 'high',     label: 'HIGH',     from: 50, status: 'critical' },
  { key: 'critical', label: 'CRITICAL', from: 75, status: 'critical' },
]

// ── LAYOUT (px) — shared by CSS and the 3D camera view-offset ────────────────
// foldMinWidth: below this the zone panel becomes a bottom sheet instead of the side hinge (also edit the @media in index.css)
export const UI = { queueW: 392, leafW: 310, foldMinWidth: 1680, filmH: 190 }
