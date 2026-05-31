# Council failure UX — automated coverage — Implementation Plan

> Cover the previously-untested council error UX end-to-end via a mock-only
> sentinel that drives the real failure path. No production behaviour changes.

**Spec:** `docs/superpowers/specs/2026-05-31-council-failure-ux-test-design.md`
**Verification:** `npm run check` (incl. `test:sidecar`) + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] `sidecar/council.mjs` — inside `runCouncil`'s `BIBLE_AI_MOCK_COUNCIL === "1"`
  branch, throw an actionable auth error when the question contains
  `__FORCE_COUNCIL_ERROR__`. Unreachable in production (mock-only branch).
- [x] `src/features/council/CouncilPanel.tsx` — upgrade the bare
  `<ErrorState message={error} />` to a titled "The Council could not finish"
  error plus a "Try again" button (`data-testid="council-retry"`) that re-runs
  the question. This is the UX the test asserts and the real user benefit.
- [x] `sidecar/tests/council.test.mjs` — unit test: mock mode + sentinel rejects
  with a Settings/"try again" message.
- [x] `tests/e2e/council-error.spec.ts` — e2e: sentinel question → calm error
  title + actionable hint + "Try again" + no false "Synthesis"; bounded wait.
- [x] `wdio.conf.mts` — register the new spec after `council-mock.spec.ts`.
- [x] `npm run check` green (sidecar 58→59 incl. new test); `npm run test:e2e:build` green.
- [x] Docs committed; ff-merge to main.

## Self-review
- The injection is in the mock-only branch → zero production risk; a unit test
  pins the behaviour and a code comment states the invariant.
- The e2e drives the genuine failure path (throw → dispatcher → Rust Err →
  ErrorState), not a UI shortcut, so it would catch a regression that broke error
  surfacing.
- Did not duplicate already-covered backup/restore or error-classification tests.
- Flagged the no-client-timeout UX risk as a follow-up rather than silently
  expanding scope.
