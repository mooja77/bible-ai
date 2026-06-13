# EP-019: Council cancellation — Implementation Plan

> Stale-result suppression already existed (requestId guard). Add a client-side
> Cancel button so a user can abandon a stuck run; defer provider-level abort.

**Spec:** `docs/superpowers/specs/2026-06-13-ep019-council-cancel-design.md`
**Verification:** `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify: `onAsk`'s `requestId` guard + `loading` guard already suppress
  superseded/stale results. The missing piece was a user-facing cancel.
- [x] Add `onCancelCouncil` (bump `councilViewRequestId` -> late result
  suppressed; clear loading/error -> timer stops, returns to preview) and a
  "Cancel" button (`data-testid="council-cancel"`) shown during a run.
- [x] Verify: `tsc` clean; `npm run check` green; `npm run test:e2e:build`
  (no regression).

## Notes

- Client-side cancel only: the backend run completes and is saved; the result is
  suppressed in the UI. True provider abort = a change to the single sidecar
  transport every AI call depends on -> dedicated session (see the H8b notes),
  NOT a tail-of-long-session attempt.
- Mid-flight cancel is not deterministically e2e-tested (mock resolves <1s);
  relies on the already-correct requestId suppression + no-regression.
