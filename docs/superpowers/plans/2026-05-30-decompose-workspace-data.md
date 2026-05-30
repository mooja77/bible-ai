# Decompose WorkspacesPanel — data/helpers module (F24) Implementation Plan

> **Sub-skill:** verbatim-sibling extraction (F pattern). Contiguous mid-file block (helpers + type-guards). tsc-driven imports; byte-diff + workspace e2e.

**Goal:** Move the JSX-free helper/type-guard cluster (lines 1129–1283) out of `WorkspacesPanel.tsx`
into new `app/src/features/workspaces/workspaceData.ts`.

**Spec:** `docs/superpowers/specs/2026-05-30-decompose-workspace-data-design.md`

**Verification:** `npm run check` + full `npm run test:e2e:build` (flaky-cascade protocol).

## Tasks (as executed)

- [x] Create `workspaceData.ts`: type-only `lib/bible` import; 16 functions (12 exported + 4 private
  Council guards), byte-identical to the originals.
- [x] Cut lines 1129–1283 from the panel via a python anchor-verified middle-block removal (keep
  1–1127 + 1284–EOF); node brace-balance check.
- [x] Add the 9-name import from `./workspaceData`; drop now-unused `CouncilJudgment` from the
  `lib/bible` import (TS6133).
- [x] `npm run build` → exit 0, 0 TS errors.
- [x] Byte-diff all 16 moved bodies vs HEAD → 0 mismatches.
- [x] `npm run check` → exit 0 (sidecar 65/65).
- [x] `npm run test:e2e:build` → 59 passing (after a wedged-driver re-run).
- [x] Spec + plan committed; spec marked Implemented; ff-merge to main; delete branch.

## Self-Review

- **Lesson reinforced:** STOP batching mutate+verify steps — a `grep -c` returning 0 or an
  `&&`-chain failure cancels every later call in the block. Run cut → verify → import → build → gate
  as separate single calls.
- **Wedged e2e:** a near-total-failure run with an abnormal ~11m runtime is an environment wedge, not
  a regression; re-run (no rebuild) to confirm.
- **Verify-driven:** tsc finalized imports; byte-diff guarantees behavior; the workspace e2e suite is
  the regression net.
