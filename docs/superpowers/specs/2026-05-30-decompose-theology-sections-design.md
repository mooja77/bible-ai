# Decompose TheologyPanel — JSX sub-components (F22) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (branch `decompose-theology-sections`)
- **Theme:** F — god-component decomposition, sub-project 22 (second slice of TheologyPanel)

## Problem

After F21 (data/helpers → `theologyData.ts`), `TheologyPanel.tsx` is 1687 lines. The next clean,
low-risk slice is the **4 presentational JSX sub-components** that form the file's contiguous tail
(`DoctrineMap`, `TheologyEvidenceSection`, `ProgressMetric`, `TheologyTextarea`). They now depend
only on `theologyData` exports + `lib/bible` types — no panel state — so they extract cleanly.

## Goal

Move the 4 sub-components into a new `app/src/features/theology/TheologySections.tsx` (verbatim,
exported), imported back into the panel. Behavior-preserving.

## Scope (F22) — what moves

`DoctrineMap`, `TheologyEvidenceSection`, `ProgressMetric`, `TheologyTextarea` (the contiguous
block from `function DoctrineMap({` to EOF — they are the last 4 declarations in the file).

`TheologySections.tsx` imports:
- from `../../lib/bible` (types): `TheologyLink`, `TheologyTopic`.
- from `./theologyData`: `relationLabel`, `theologyLinkKindLabel`, `theologyLinkPreview`, and types
  `DoctrineRelationKind`, `DoctrineRelationPayload`.

No React import (automatic JSX runtime, matching the rest of the codebase). These are pure prop-driven
components — no hooks.

## Out of scope (stays in panel; future slices)

`GUIDED_TEMPLATES` + guided-* helpers; the main `TheologyPanel` component body (the remaining ~1430
lines — a later, riskier slice or left as the irreducible orchestrator).

## Import-back surface (tsc-driven)

`TheologyPanel.tsx` adds `import { DoctrineMap, ProgressMetric, TheologyEvidenceSection, TheologyTextarea } from "./TheologySections";`
and **drops from its `./theologyData` import** whatever the 4 components were the sole consumers of
(candidates: `relationLabel`, `theologyLinkKindLabel`, `theologyLinkPreview`, `DoctrineRelationKind`).
The exact drop set is finalized by `npm run build` (TS6133 = drop, TS2304 = keep). `DoctrineRelationPayload`,
`relationLabel`, etc. likely remain — the panel body still builds relation lists — so trust tsc.

## Testing

- `npm run build` clean; full `npm run check` green.
- Full `npm run test:e2e:build` — the smoke.spec Theology block renders `DoctrineMap`
  (`data-testid="doctrine-map"`), evidence sections, and progress metrics; all must stay green
  (flaky-cascade re-run protocol).
- No new e2e — behavior-preserving move, verified by byte-diff + existing Theology suite.

## Risks & mitigations

- **Missed cross-reference** → tsc drives the import set; byte-diff confirms the moved bodies.
- **Tail-cut precision** → the block is the file's last 4 decls (contiguous to EOF), so the cut is
  unambiguous; verify no code follows `TheologyTextarea`.
- **Flaky Theology e2e** → documented cascade; re-run `npm run test:e2e` (no rebuild).

## Rollout

Branch `decompose-theology-sections`. New: `TheologySections.tsx` + spec/plan. Modify:
`TheologyPanel.tsx`. Verify with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
