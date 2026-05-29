# Extract CouncilPositionComparison from CouncilPanel.tsx Implementation Plan

> **Sub-skill:** verbatim-sibling move (executed inline by the orchestrator; the ~157-line block is extracted via `sed` to guarantee byte-identity, then diffed against the original).

**Goal:** Move `CouncilPositionComparison` + `PositionSelect` + `PositionComparisonCard` + `ComparisonFact` (702–858) out of `CouncilPanel.tsx` into `features/council/CouncilPositionComparison.tsx`, verbatim, zero behavior change. Eighth CouncilPanel slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-position-comparison-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the comparison; flaky-cascade protocol). No new test.

---

## Task 1: Move the block, rewire CouncilPanel

- [ ] **Step 1: Create `app/src/features/council/CouncilPositionComparison.tsx`** — import header (`useState`; `type { CouncilPosition, CouncilResponse, CouncilVoice }` from lib/bible; `buildPositionEvidenceGroups, countVoiceMentions, formatPercent` from `./councilTransparency`), blank line, then the verbatim block (702–858) with `export` prepended to `CouncilPositionComparison` only. Extract via `sed -n '702,858p'`.
- [ ] **Step 2: Edit `CouncilPanel.tsx`** — delete the contiguous block 702–858 (+ its one trailing blank); add `import { CouncilPositionComparison } from "./CouncilPositionComparison";`. Leave the `councilTransparency` import as-is (members still used elsewhere). Keep the call site (358) unchanged.
- [ ] **Step 3: Byte-identity diff** — `git show HEAD:…CouncilPanel.tsx` vs the new file's four functions; confirm identical modulo the added `export`.
- [ ] **Step 4: Build** — `npm run build` clean (if tsc reports a now-unused `councilTransparency` member, drop only that one).
- [ ] **Step 5: Commit** — stage only the two files: `refactor(council): extract CouncilPositionComparison from CouncilPanel`.

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (flaky-cascade re-run protocol).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.
