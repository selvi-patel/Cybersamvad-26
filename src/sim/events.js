// Event envelope. kinds:
//  light.state   {lit, source}                    on/off change
//  light.fault   {online}                         comms lost / restored (maintenance noise)
//  light.remote  {source, known, hour, count}     remote-control request (assetId = light or ZONE-x)
//  light.access  {result:'ok'|'denied', source}   access attempt on a light controller
//  server.login  {user, ok, location, device, knownLocation, knownDevice, hour}
//  server.metrics{rps}                            telemetry sample (quiet = hidden from feed)
//  server.status {up, reason}                     health probe result
let seq = 0
export const mkEvent = (kind, assetId, data = {}, extra = {}) =>
  ({ id: ++seq, ts: extra.ts ?? Date.now(), kind, assetId, zone: extra.zone ?? null, quiet: !!extra.quiet, hostile: !!extra.hostile, data })
