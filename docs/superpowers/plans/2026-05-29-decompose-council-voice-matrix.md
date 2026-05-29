# Extract CouncilVoiceMatrix from CouncilPanel.tsx Implementation Plan

> **Sub-skill:** verbatim-sibling move (executed inline by the orchestrator; the ~150-line block is extracted via `sed` to guarantee byte-identity, then diffed against the original).

**Goal:** Move `CouncilVoiceMatrix` (1046–1195) out of `CouncilPanel.tsx` into `features/council/CouncilVoiceMatrix.tsx`, verbatim, zero behavior change. Seventh CouncilPanel slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-voice-matrix-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the matrix; flaky-cascade protocol). No new test.

**Deferral note:** `VoicesAuditTrail`/`VoiceRow` are NOT in scope — `VoiceRow` embeds `CouncilResultView` (still in CouncilPanel), so moving them now would create a cycle. They follow the result/process-wrappers extraction.

---

## Task 1: Move the block, rewire CouncilPanel

- [ ] **Step 1: Create `app/src/features/council/CouncilVoiceMatrix.tsx`** — import header (`useState`; `type { CouncilPosition, CouncilResponse }` from lib/bible; `buildVoiceAgreementMatrix, formatPercent, labelsOverlap` from `./councilTransparency`), blank line, then the verbatim `CouncilVoiceMatrix` function (1046–1195) with `export` prepended. Extract via `sed -n '1046,1195p'` to guarantee byte-identity.
- [ ] **Step 2: Edit `CouncilPanel.tsx`** — delete the contiguous block 1046–1195 (+ its one trailing blank); add `import { CouncilVoiceMatrix } from "./CouncilVoiceMatrix";`; drop `buildVoiceAgreementMatrix` from the `councilTransparency` import (keep `labelsOverlap`/`formatPercent`/rest). Keep the call site (359) unchanged.
- [ ] **Step 3: Byte-identity diff** — `git show HEAD:…CouncilPanel.tsx` vs the new file's function; confirm identical modulo the added `export`.
- [ ] **Step 4: Build** — `npm run build` clean.
- [ ] **Step 5: Commit** — stage only the two files: `refactor(council): extract CouncilVoiceMatrix from CouncilPanel`.

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (flaky-cascade re-run protocol).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.
