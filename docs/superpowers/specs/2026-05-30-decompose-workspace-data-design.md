# Decompose WorkspacesPanel — data/helpers module (F24) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (branch `decompose-workspace-data`)
- **Theme:** F — god-component decomposition, sub-project 24 (first slice of WorkspacesPanel)

## Problem

With TheologyPanel decomposed (F21–F23), `WorkspacesPanel.tsx` (1327 lines) is the next-largest
god-component. It is a main component (54–633), a large `WorkspaceItem` sub-component (634–1128), a
contiguous cluster of JSX-free helpers + Council type-guards (1129–1283), and a `SearchResultList`
JSX component (1285–EOF).

## Goal

Extract the **JSX-free helper/type-guard cluster** into a new
`app/src/features/workspaces/workspaceData.ts` (verbatim), imported back. Behavior-preserving.

## Scope (F24) — what moves (lines 1129–1283, contiguous)

- Search matchers: `workspaceSummaryMatches`, `studyItemMatches`, `payloadSearchText`.
- Payload coercion: `payloadString`, `positiveIntegerPayloadValue`, `nonNegativeIntegerPayloadValue`,
  `stripSnippetMarkup`, `numericPayloadValue`.
- Council-judgment merge: `mergeWorkspaceJudgments`, `workspaceCouncilSessionId`.
- Council type-guards: `isCouncilResponse` (exported) + `isCouncilVoiceLike`, `isCouncilPositionLike`,
  `isCouncilProviderLike`, `isCouncilConfidence` (private — used only by `isCouncilResponse`),
  `isObjectRecord` (exported, widely used).

`workspaceData.ts` imports types only from `../../lib/bible`: `CouncilJudgment`, `CouncilResponse`,
`StudyItem`, `StudyWorkspace`, `StudyWorkspaceSummary`. No React.

**9 imported back** into the panel (used by main + WorkspaceItem + SearchResultList):
`workspaceSummaryMatches`, `studyItemMatches`, `payloadString`, `positiveIntegerPayloadValue`,
`nonNegativeIntegerPayloadValue`, `stripSnippetMarkup`, `mergeWorkspaceJudgments`,
`isCouncilResponse`, `isObjectRecord`. The other 7 (`payloadSearchText`, `numericPayloadValue`,
`workspaceCouncilSessionId` + the 4 private guards) are module-internal. The panel also drops the
now-unused `CouncilJudgment` type import (only the moved `mergeWorkspaceJudgments` used it). tsc
finalizes the set.

## Out of scope

- `defaultMarkdownFilename` (line 41 — sits before the main component, not part of the trailing
  cluster; left in place).
- `WorkspaceItem` and `SearchResultList` JSX components — later slices.
- The main `WorkspacesPanel` component body.

## Testing

- `npm run build` clean; full `npm run check` green (exit 0, sidecar 65/65).
- Full `npm run test:e2e:build` — workspace.spec exercises this panel heavily; all green (59 passing).
  Flaky re-run protocol (one run hit a wedged driver — 54 spurious failures at 11m; clean re-run 59/0).

## Risks & mitigations

- **Mid-file block cut** (not a tail-cut) → keep file lines 1–1127 + 1284–EOF; anchors verified
  programmatically (start = `workspaceSummaryMatches`, end = `isObjectRecord` close, next =
  `SearchResultList`). Node brace-balance check.
- **Now-unused panel imports** → tsc TS6133 drove the `CouncilJudgment` drop.
- Byte-diff confirms all 16 moved bodies identical to HEAD (0 mismatches).

## Rollout

Branch `decompose-workspace-data`. New: `workspaceData.ts` + spec/plan. Modify: `WorkspacesPanel.tsx`.
Verified with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
