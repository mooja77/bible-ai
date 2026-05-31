# Council client-side timeout — Implementation Plan

> Add a 5-minute client-side backstop so a stuck Council run surfaces a calm,
> actionable error + retry instead of an endless spinner.

**Spec:** `docs/superpowers/specs/2026-05-31-council-client-timeout-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] `src/features/council/CouncilPanel.tsx` — add `withCouncilTimeout` (races
  `askCouncil` against a 5-min backstop; overridable by tests via
  `window.__BIBLE_AI_COUNCIL_TIMEOUT_MS__`) and wrap the `askCouncil` call.
- [x] `sidecar/council.mjs` — add a `__FORCE_COUNCIL_SLOW__` sentinel (2s delay)
  in the mock-only branch so the backstop can be tested deterministically.
- [x] `tests/e2e/council-error.spec.ts` — 2nd case: shrink the window, ask a slow
  question, assert the timeout message + "Try again" + no "Synthesis"; restore
  the window override in `finally`.
- [x] Docs; `npm run check` green; `npm run test:e2e:build` green; ff-merge to main.

## Self-review
- Generous default (5 min) avoids aborting legitimate slow runs; backstop only
  catches true stalls.
- Reuses the council error UI added alongside the failure-UX tests (title +
  retry), so the timeout path and the provider-failure path look consistent.
- Late results can't overwrite the timeout (Promise.race + existing requestId
  guard); the timer is always cleared in `finally`.
- Test hooks mirror the established `__FORCE_COUNCIL_ERROR__` pattern: mock-only
  sentinel + a prod-undefined window override.
