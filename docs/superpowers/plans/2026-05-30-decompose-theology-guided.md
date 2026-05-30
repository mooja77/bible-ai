# Decompose TheologyPanel — guided-study cluster (F23) Implementation Plan

> **Sub-skill:** verbatim-sibling extraction (F pattern). Two-region cluster (top const/type + bottom helpers). tsc-driven imports; byte-diff + Theology e2e.

**Goal:** Move `GUIDED_TEMPLATES`/`GuidedTemplateSlug` + the 4 guided helpers into
`app/src/features/theology/theologyGuided.ts`.

**Spec:** `docs/superpowers/specs/2026-05-30-decompose-theology-guided-design.md`

**Verification:** `npm run check` + full `npm run test:e2e:build` (flaky-cascade protocol).

## Tasks (as executed)

- [x] Spec + plan committed.
- [x] Create `theologyGuided.ts`: exported, byte-identical `GUIDED_TEMPLATES`, `GuidedTemplateSlug`,
  `buildGuidedReviewCards`, `guidedTemplateTitle`, `guidedSessionPreview`,
  `buildGuidedStudyCouncilQuestion`; imports types from `lib/bible` + review-card helpers from
  `theologyData`.
- [x] Panel: replace the top `GUIDED_TEMPLATES` const + `GuidedTemplateSlug` type with an import
  from `./theologyGuided`; tail-cut the bottom 4 functions; re-add the main component's closing `}`
  (the head-cut removed it — tsc `'}' expected` caught it); drop now-unused review-card names from the
  `theologyData` import (TS6133).
- [x] `npm run build` → exit 0; byte-diff → 0 mismatches; `npm run check` → exit 0 (sidecar 65/65).
- [x] `npm run test:e2e:build` → 59 passing.
- [x] Mark spec Implemented; commit; ff-merge to main; delete branch.

## Self-Review

- **Lesson applied:** sequential edits (no parallel mutate-then-build races).
- **Gotcha hit + fixed:** `head -n` tail-cut dropped the component's closing brace; node brace-balance
  check + tsc confirmed the re-add.
- **Verify-driven:** byte-diff guarantees behavior; tsc finalized the panel import drops; Theology e2e
  is the regression net.
