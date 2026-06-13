# EP-019: Council cancellation — Design

- **Date:** 2026-06-13
- **Status:** Implemented (client-side cancel + late-result suppression);
  provider-level abort is deferred transport work.
- **Gate:** AI lifecycle trust (Gate 4)
- **Source:** `docs/development-implementation-plan.md` EP-019.

## Background

EP-019 asks for "operation ids + stale-result suppression at minimum" and,
where practical, abort propagation. Verified state:

- **Stale-result suppression already exists**: `onAsk` captures a `requestId`
  from `councilViewRequestId` and drops any result whose id is no longer current
  (`if (requestId !== councilViewRequestId.current) return`), and the `loading`
  guard blocks a second concurrent run. So a superseded run can never overwrite
  the view.
- **What was missing**: a way for the user to *abandon* a slow/stuck run so its
  late result is suppressed and they can ask again.

## Change

A client-side **Cancel** button shown during a run. `onCancelCouncil` bumps
`councilViewRequestId` (so the in-flight run's late result is suppressed by the
existing guard) and clears `loading`/`error` (the elapsed timer is `loading`-
gated and stops itself). The user returns to the voice preview and can ask again.

## Scope / what is deferred

- This is **client-side** cancellation: the result is suppressed in the UI. The
  backend run still completes and is saved to history (so the work is not lost).
- **True provider-level abort** (cancelling the call UI -> Tauri -> sidecar ->
  provider fetch) is a change to the single sidecar transport every AI call
  depends on. It is deliberately deferred to a dedicated, focused session rather
  than risked at the tail of a long one. The client-side cancel delivers the
  user-facing guarantee (abandon a run, no stale result) in the meantime.

## Testing

- The mid-flight cancel cannot be asserted deterministically in the mock e2e (the
  mock Council resolves in under a second, so the loading state is too brief to
  click reliably). The cancel logic is a thin wrapper over the already-correct
  `requestId` suppression; it is verified by `tsc`, the full e2e no-regression
  run, and reasoning about the guard.
- `npm run check` green; `npm run test:e2e:build` (no regression).
