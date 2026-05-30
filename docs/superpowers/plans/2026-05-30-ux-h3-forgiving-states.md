# UX H3 — Forgiving reference input — Implementation Plan

> Slice 1 of H3: accept book-only references ("John" → ch.1) + friendlier error/placeholder. e2e-safe (aria-label hook unchanged; existing jump tests use full refs).

**Spec:** `docs/superpowers/specs/2026-05-30-ux-h3-forgiving-states-design.md`
**Verification:** node behavioral check + `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] verse.ts: extract `resolveBook` helper; `parseReference` returns book@ch1 when no chapter is
  given but the input resolves to a book. All existing paths unchanged.
- [x] App.tsx: friendlier parse-fail message + richer placeholder; aria-label unchanged.
- [x] Standalone node behavioral test — 12 cases (book-only + regressions) all pass.
- [x] `npm run check` exit 0 (65/65); grep-confirm no e2e asserts the changed visible strings.
- [x] `npm run test:e2e:build` green (existing jump-box tests regression-cover the path).
- [x] spec/plan committed; ff-merge to main.

## Self-review
- Scoped to the reference input only; deferred empty-state CTAs + translation full-names to keep the
  slice small and e2e-safe. No new e2e authored because the file-read tooling was returning corrupted
  content mid-session, making a heading-dependent assertion unsafe; coverage via node test + existing
  jump e2e. Sequential single calls; tsc/build the arbiter.
