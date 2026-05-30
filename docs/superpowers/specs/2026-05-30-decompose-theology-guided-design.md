# Decompose TheologyPanel — guided-study cluster (F23) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (branch `decompose-theology-guided`)
- **Theme:** F — god-component decomposition, sub-project 23 (third slice of TheologyPanel)

## Problem

After F21 (data helpers) + F22 (JSX sub-components), `TheologyPanel.tsx` is 1521 lines. The
guided-study domain (`GUIDED_TEMPLATES` const, `GuidedTemplateSlug` type, and the 4 guided helpers)
is a cohesive, self-contained cluster that the main component consumes but does not need inlined.

## Goal

Extract the guided cluster into `app/src/features/theology/theologyGuided.ts` (verbatim, exported),
imported back into the panel. Behavior-preserving.

## Scope (F23) — what moves

- `GUIDED_TEMPLATES` (const), `GuidedTemplateSlug` (type).
- `buildGuidedReviewCards`, `guidedTemplateTitle`, `guidedSessionPreview`,
  `buildGuidedStudyCouncilQuestion`.

`theologyGuided.ts` imports from `lib/bible` (types): `GuidedStudySession`, `TheologyConclusion`,
`TheologyLink`, `TheologyPosition`, `TheologyTopic`; and from `./theologyData`:
`reviewAnswerFromTheologyLink`, `uniqueReviewCards`, `ReviewCard` (used by `buildGuidedReviewCards`).

The main `TheologyPanel` uses all six exports (GUIDED_TEMPLATES at the template picker + default
resolution; GuidedTemplateSlug for the selected-template state; the 4 functions in handlers/render),
so all six are imported back. The panel drops `reviewAnswerFromTheologyLink`, `uniqueReviewCards`,
`ReviewCard` from its own `theologyData` import (they were used only by the moved
`buildGuidedReviewCards`).

## Out of scope

The ~1400-line main `TheologyPanel` component body — the irreducible orchestrator (state/effects/
handlers/render), or a future multi-section split with state threaded.

## Testing

- `npm run build` clean; full `npm run check` green (exit 0, sidecar 65/65).
- Full `npm run test:e2e:build` — smoke.spec guided-study + backup-restore guided-session import
  tests render this cluster; all green (59 passing). Flaky-cascade re-run protocol.

## Risks & mitigations

- **Two-region cluster (top const/type + bottom functions)** → top edit replaced the const/type +
  inserted the import in one Edit; bottom removed by a `head -n` tail-cut.
- **Tail-cut off-by-one** → the main component's closing `}` sits one line below the JSX `);`;
  re-add it if the cut removes it (caught by tsc `'}' expected`). Verify brace balance with a node
  open/close count.
- **Now-unused panel imports** → tsc TS6133 drives the drop set (the 3 review-card names).
- Byte-diff confirms all moved bodies + the const block are identical to HEAD.

## Rollout

Branch `decompose-theology-guided`. New: `theologyGuided.ts` + spec/plan. Modify: `TheologyPanel.tsx`.
Verified with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
