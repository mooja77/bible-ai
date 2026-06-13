# EP-017: Study Packet leak scan — Design

- **Date:** 2026-06-13
- **Status:** Implemented (scanner + tests + check gate); export wiring follows
  with the folder export (EP-015/016).
- **Gate:** Study Packet v1 / release trust (Gate 3)
- **Source:** `docs/development-implementation-plan.md` EP-017; forbidden-data
  list from `docs/study-packet-v1-contract.md` (EP-001 draft).

## Background

A Study Packet must never contain provider API keys, gateway tokens, local/build
paths, environment variables, or machine identifiers. The existing
`sanitizeExportText` (workspace export) covers the common cases, but the EP-001
draft flagged gaps (machine ids, UNC/network paths, bare env values). There was
no dedicated, tested leak scanner that could be run over generated packet output.

## Change

`scripts/scan-packet-leaks.mjs` -- a conservative, unit-tested scanner in the
provider-free `node --test` ecosystem (the frontend has no unit harness):

- `scanForLeaks(text)` returns `{ type, sample }` findings, where `type` is one of
  `LEAK_TYPES` (`provider_api_key`, `secret_assignment`, `local_path`,
  `network_path`) and `sample` is a short **redacted** snippet -- the full secret
  is never echoed back.
- Patterns target high-confidence shapes (sk-ant-/sk-proj-/AIza keys; secret-named
  assignments whose value contains a digit; Windows `C:\...`, Unix `/Users//home/
  /tmp...` paths; `\\host\share` UNC paths) so Scripture and ordinary prose do not
  false-positive.
- Run directly, it walks a packet directory (default
  `docs/samples/study-packets/`) and exits non-zero on any finding; it no-ops
  cleanly when the directory does not exist yet.
- Wired into `npm run check` (`node --check` + a real run).

## Scope

- This packet delivers the reusable scanner + gate. Calling it from the packet
  export (refuse to write a packet that scans dirty) lands with the folder export
  (EP-015/016) and the sample packets (EP-018), which will populate the scanned
  directory.

## Testing

- **7 unit tests** in `sidecar/tests/scan-packet-leaks.test.mjs`: clean Scripture
  -> no findings; provider keys, secret assignments, local paths, and UNC paths
  detected; findings never echo the full secret; `LEAK_TYPES` enumerated. RED
  first (module missing).
- `npm run check` green (81 sidecar tests incl. the 7 new; scan gate runs).
