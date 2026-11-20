import { useEffect, useState } from 'react'
export const fmtTime = ts => new Date(ts).toTimeString().slice(0, 8)
export const ago = ms => (ms < 1500 ? 'now' : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`)
export function useNow(every = 1000) {
  const [n, setN] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setN(Date.now()), every); return () => clearInterval(t) }, [every])
  return n
}
