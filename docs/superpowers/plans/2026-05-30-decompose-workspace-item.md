# Decompose WorkspacesPanel — WorkspaceItem component (F25) Implementation Plan

> **Sub-skill:** verbatim-sibling extraction (F pattern). Tail-cut of WorkspaceItem + its private SearchResultList. Built via a CONTENT-anchored script (not line numbers); tsc-driven panel import reconciliation.

**Goal:** Move `WorkspaceItem` + `SearchResultList` out of `WorkspacesPanel.tsx` into new
`app/src/features/workspaces/WorkspaceItem.tsx`.

**Spec:** `docs/superpowers/specs/2026-05-30-decompose-workspace-item-design.md`

**Verification:** `npm run check` + full `npm run test:e2e:build` (flaky-cascade protocol).

## Tasks (as executed)

- [x] Build `WorkspaceItem.tsx` programmatically: split panel on the unique content marker `function
  WorkspaceItem({` (everything to EOF is the tail); prepend the import header; `function
  WorkspaceItem` → `export function WorkspaceItem`; SearchResultList stays private. Panel keeps
  everything before, asserted to end at the orchestrator's `}`.
- [x] Add `import { WorkspaceItem } from "./WorkspaceItem"`.
- [x] `npx tsc --noEmit` (captured to file, read cleanly) → 11 TS6133 in panel → drop the 11
  (6 lib/bible + 5 workspaceData) via two block-replace edits. `listTheologyTopics` kept.
- [x] `npm run build` → exit 0.
- [x] Byte-diff WorkspaceItem + SearchResultList vs HEAD → 0 mismatches.
- [x] `npm run check` → exit 0 (sidecar 65/65).
- [x] `npm run test:e2e:build` → 59 passing.
- [x] Spec + plan committed; spec marked Implemented; ff-merge to main; delete branch.

## Self-Review

- **Hard lessons (this slice, recovered):** (1) an early build-script used STALE hardcoded line
  anchors — switched to a unique CONTENT marker. (2) Heavy parallel tool batching repeatedly
  cancelled later calls and raced edits; switched to strictly SEQUENTIAL single calls. (3) Output
  truncation made greps unreadable and a parsed TS6133 list unreliable — captured tsc to a file and
  read it with the Read tool; treated the build (exit 0 / TS2304) as the final arbiter.
- **Verify-driven:** tsc is the authority for import drops; byte-diff guarantees behavior; the
  workspace e2e suite is the regression net.
