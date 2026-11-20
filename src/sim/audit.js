// Append-only, hash-chained audit log. Each entry stores the previous entry's hash;
// hash = SHA-256( seq | ts | asset | severity | event | action | operator | status | prevHash ).
// There is deliberately NO update/delete API. Entries are frozen; verify() recomputes the chain.
import { sha256Hex } from './sha256.js'

export const GENESIS = '0'.repeat(64)
const canon = e => JSON.stringify([e.seq, e.ts, e.assetId, e.severity, e.event, e.action, e.operator, e.status, e.prevHash])

export class AuditChain {
  constructor() { this.entries = []; this.head = GENESIS; this.tail = Promise.resolve() }

  /** queue an entry; resolves with the sealed entry. Order of calls == order in the chain. */
  append(f) {
    this.tail = this.tail.then(async () => {
      const body = {
        seq: this.entries.length + 1, ts: f.ts ?? Date.now(), assetId: f.assetId ?? '—', severity: f.severity ?? 'normal',
        event: f.event, action: f.action, operator: f.operator ?? 'SYSTEM', status: f.status ?? '—', prevHash: this.head,
      }
      const entry = Object.freeze({ ...body, hash: await sha256Hex(canon(body)) })
      this.entries = [...this.entries, entry]
      this.head = entry.hash
      return entry
    })
    return this.tail
  }

  /** recompute every hash and every prev-link. @returns {{ok, count, brokenAt}} (brokenAt is a seq number) */
  static async verify(entries) {
    let prev = GENESIS
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      if (e.seq !== i + 1 || e.prevHash !== prev || e.hash !== (await sha256Hex(canon(e)))) return { ok: false, count: entries.length, brokenAt: i + 1 }
      prev = e.hash
    }
    return { ok: true, count: entries.length, brokenAt: null }
  }
}

// ── export for post-incident reporting ───────────────────────────────────────
const iso = ts => new Date(ts).toISOString()
const csvCell = v => `"${String(v).replace(/"/g, '""')}"`

export function toCSV(entries) {
  const head = ['seq', 'timestamp', 'asset_id', 'severity', 'event', 'operator_action', 'operator', 'status', 'prev_hash', 'hash']
  const rows = entries.map(e => [e.seq, iso(e.ts), e.assetId, e.severity, e.event, e.action, e.operator, e.status, e.prevHash, e.hash])
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}

export function toJSON(entries, verify) {
  return JSON.stringify({
    source: 'CITADEL (SIMULATION ONLY — synthetic data)', algorithm: 'SHA-256', genesis: GENESIS,
    exportedAt: new Date().toISOString(), chainHead: entries.at(-1)?.hash ?? GENESIS, verified: verify, entries,
  }, null, 2)
}

export function download(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
