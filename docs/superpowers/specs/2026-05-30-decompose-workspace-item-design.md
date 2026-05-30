# Decompose WorkspacesPanel — WorkspaceItem component (F25) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (branch `decompose-workspace-item`)
- **Theme:** F — god-component decomposition, sub-project 25 (second slice of WorkspacesPanel)

## Problem

After F24 (data helpers → `workspaceData.ts`), `WorkspacesPanel.tsx` is 1181 lines. The largest
remaining chunk is the `WorkspaceItem` sub-component plus the small private `SearchResultList` JSX
component it renders — together the entire file tail (from `function WorkspaceItem({` to EOF).

## Goal

Extract `WorkspaceItem` (and `SearchResultList`, its sole consumer) into a new
`app/src/features/workspaces/WorkspaceItem.tsx`, imported back. Behavior-preserving.

## Scope (F25) — what moves (contiguous tail)

- `WorkspaceItem` (exported — rendered by the main panel at one `<WorkspaceItem … />` site).
- `SearchResultList` (private — used only inside `WorkspaceItem`).

`WorkspaceItem.tsx` imports (all tsc-confirmed used):
- `react`: `useEffect`, `useState`.
- `@tauri-apps/plugin-dialog`: `save as saveDialog`.
- `../../lib/bible`: `addStudyItem`, `createTheologyLink`, `deleteStudyItem`, `explainPassage`,
  `updateStudyItem` + types `CouncilResponse`, `StudyItem`, `TheologyTopic`.
- `../../components/StateViews`: `ErrorState`.
- `./workspaceData`: `isCouncilResponse`, `isObjectRecord`, `nonNegativeIntegerPayloadValue`,
  `payloadString`, `positiveIntegerPayloadValue`, `stripSnippetMarkup`.

## Panel import reconciliation (tsc-driven, 11 dropped)

- from `lib/bible`: `addStudyItem`, `createTheologyLink`, `deleteStudyItem`, `explainPassage`,
  `updateStudyItem`, `type StudyItem`.
- from `workspaceData`: `isObjectRecord`, `payloadString`, `positiveIntegerPayloadValue`,
  `stripSnippetMarkup`, `studyItemMatches`.
- adds `import { WorkspaceItem } from "./WorkspaceItem"`.
- `listTheologyTopics` STAYS (orchestrator still fetches topics to pass as a prop).

## Out of scope

The main `WorkspacesPanel` orchestrator (1–643) — the irreducible core (state/effects/reorder/
export handlers/render). `defaultMarkdownFilename` stays.

## Testing

- `npm run build` clean; full `npm run check` green (exit 0, sidecar 65/65).
- Full `npm run test:e2e:build` — workspace.spec renders WorkspaceItem cards and exercises
  edit/remove/export; all green.

## Risks & mitigations

- **Large verbatim move** → built programmatically with a **content anchor** (`function
  WorkspaceItem({`, asserted unique), NOT line numbers. Node byte-diff confirms 0 mismatches vs HEAD.
- **SearchResultList cycle** → moves WITH WorkspaceItem (private), no panel import cycle.
- **Import reconciliation** → tsc (captured to file, read cleanly) drove the exact 11-name drop;
  build confirms exit 0.

## Rollout

Branch `decompose-workspace-item`. New: `WorkspaceItem.tsx` + spec/plan. Modify: `WorkspacesPanel.tsx`.
Verified with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
