# Decompose TheologyPanel — data/helpers module (F21) — Design

- **Date:** 2026-05-30
- **Status:** Draft (branch `decompose-theology-data`)
- **Theme:** F — god-component decomposition, sub-project 21 (first slice of TheologyPanel)

## Problem

`TheologyPanel.tsx` is **1996 lines** — now the single largest frontend file and the one
major god-component Theme F never touched (F did App.tsx + CouncilPanel; D started SettingsPanel).
It is a ~1350-line main component (lines 94–1448) followed by ~25 trailing pure helpers and
small presentational sub-components (1449–1996).

## Goal

Extract the **JSX-free data/parsing/label/stats helpers** (and their pure types) into a new
`app/src/features/theology/theologyData.ts`, the leaf-most layer of the file. Behavior-preserving
verbatim move + import-back, following the established F verbatim-sibling pattern.

## Scope (F21) — what moves

These are JSX-free, React-free, and do **not** depend on `GUIDED_TEMPLATES` (which stays in the
panel, heavily used by the main render). They form 6 contiguous source blocks:

- **Types:** `TopicStatus`, `DoctrineRelationKind`, `DoctrineRelationPayload`, `TopicStats`,
  `ReviewCard`, `StudyPrompt`.
- **Payload/parsing primitives:** `asTheologyPayloadRecord`, `readPayloadString`,
  `readPositiveInteger`, `readTheologyLinkPayload`, `stripSnippetMarkup`.
- **Link/relation helpers:** `parseDoctrineRelation`, `relationLabel`, `theologyLinkKindLabel`,
  `theologyLinkPreview`, `groupTheologyEvidence`.
- **Stats/review-card data:** `countOpenQuestions`, `buildTopicStats`, `buildProgressSummary`,
  `buildStudyPrompts`, `reviewAnswerFromTheologyLink`, `uniqueReviewCards`, `readReviewCards`.

`theologyData.ts` imports from `lib/bible`: `TheologyLink`, `TheologyConclusion`, `TheologyTopic`,
`TheologyPosition` (types only).

## Out of scope (stays in TheologyPanel; future slices)

- `GUIDED_TEMPLATES` const + its dependents: `guidedTemplateTitle`, `guidedSessionPreview`,
  `buildGuidedStudyCouncilQuestion`, `buildGuidedReviewCards` (the latter imports the moved
  `reviewAnswerFromTheologyLink`/`uniqueReviewCards`).
- JSX sub-components: `DoctrineMap`, `TheologyEvidenceSection`, `ProgressMetric`,
  `TheologyTextarea` (a later slice — they import `relationLabel`/`theologyLinkKindLabel`/
  `theologyLinkPreview` + the relation types from `theologyData`).
- The main `TheologyPanel` component body.

## Import-back surface (tsc-driven)

`TheologyPanel.tsx` will import from `./theologyData` whatever it still references — at minimum:
`buildTopicStats`, `buildProgressSummary`, `buildStudyPrompts`, `readReviewCards`,
`parseDoctrineRelation`, `relationLabel`, `groupTheologyEvidence`, `theologyLinkKindLabel`,
`theologyLinkPreview`, `reviewAnswerFromTheologyLink`, `uniqueReviewCards`, and types
`DoctrineRelationKind`, `DoctrineRelationPayload`, `TopicStats`, `ReviewCard`. The exact set is
finalized by `npm run build` (tsc): add for TS2304, drop for TS6133 until clean.

## Testing

- `npm run build` (tsc + vite) clean; full `npm run check` green.
- Full `npm run test:e2e:build` — the smoke.spec Theology block + reader-interactions Theology
  links + backup-restore guided-study tests exercise this panel; all must stay green
  (flaky-cascade re-run protocol).
- No new e2e — pure behavior-preserving move, verified by the existing Theology suite + tsc.

## Risks & mitigations

- **Interleaved move/stay functions** → move only the 6 contiguous JSX-free blocks; never touch
  `GUIDED_TEMPLATES` dependents or the JSX sub-components.
- **Missed cross-reference** → tsc drives the import set (TS2304/TS6133); verify the moved bodies
  are byte-identical to the originals.
- **Flaky Theology e2e** → documented cascade; re-run `npm run test:e2e` (no rebuild) to confirm.

## Rollout

Branch `decompose-theology-data`. New: `theologyData.ts` + spec/plan. Modify: `TheologyPanel.tsx`.
Verify with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
