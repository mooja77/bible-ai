# UX H1 — Accessibility & legibility baseline — Implementation Plan

> Additive legibility baseline: global UI text-scale (persisted, mirrors useTheme), stronger focus ring, larger nav title. Default render unchanged (scale 100%).

**Spec:** `docs/superpowers/specs/2026-05-30-ux-h1-legibility-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build` (flaky-cascade protocol).

## Task 1: Spec + plan commit

## Task 2: useUiScale hook
- [ ] Create `app/src/lib/useUiScale.ts` mirroring `useTheme`: steps [100,112,125,140], default 100,
  localStorage key "ui-scale", effect sets `documentElement.style.fontSize`, returns
  {uiScale,setUiScale,increaseUiScale,decreaseUiScale,canIncrease,canDecrease}.
- [ ] `npm run build` clean.

## Task 3: Wire into App + header control
- [ ] In App.tsx, call `useUiScale()` near `useTheme()`.
- [ ] Add the compact `− {pct}% +` control to the header button cluster with aria-labels + testids.
- [ ] `npm run build` clean.

## Task 4: CSS — focus ring + nav title
- [ ] App.css: `:focus-visible` outline to solid amber-500; `.nav-section-title` 0.6875rem → 0.75rem.
- [ ] `npm run build` clean.

## Task 5: e2e
- [ ] Create `app/tests/e2e/ui-scale.spec.ts`: click `ui-scale-inc`, assert root font-size grew +
  readout changed, then decrease back to 100% to leave the shared session clean. (PowerShell-edit
  wdio.conf.mts to register last, preserving BOM/CRLF — per the global-error-notice lesson.)
- [ ] Register spec in `app/wdio.conf.mts`.

## Task 6: Gate + finish
- [ ] `npm run check` exit 0; `npm run test:e2e:build` all pass (flaky re-run protocol).
- [ ] Desktop-MCP visual smoke of the control (optional but preferred).
- [ ] Mark spec Implemented; commit; ff-merge to main; delete branch.

## Self-review
- Lowest-risk H-item: purely additive, default unchanged, mirrors an established hook pattern.
- Sequential single calls during mutate/verify (per prior session lessons); tsc/build is the arbiter.
