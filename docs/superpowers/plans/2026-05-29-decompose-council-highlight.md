# Extract highlight/evidence-text utilities from CouncilPanel.tsx Implementation Plan

> **Sub-skill:** verbatim-sibling move (inline; ~86-line block extracted via `sed` for byte-identity, then diffed).

**Goal:** Move the highlight + evidence-verse-map utilities (971–1056) out of `CouncilPanel.tsx` into `features/council/councilHighlight.tsx`, verbatim. Ninth CouncilPanel slice (leaf of the result-view chain).

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-highlight-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders evidence views using HighlightedText; flaky-cascade protocol). No new test.

---

## Task 1: Move the block, rewire CouncilPanel

- [ ] **Step 1: Create `app/src/features/council/councilHighlight.tsx`** — `import type { CouncilResponse } from "../../lib/bible";`, blank, then the verbatim block (971–1056). Prepend `export ` to exactly `HighlightedText`, `buildEvidenceTermsByVerse`, `buildRetrievedCitationByVerse`. Extract via `sed -n '971,1056p'`.
- [ ] **Step 2: Edit `CouncilPanel.tsx`** — delete the contiguous block 971–1056 (+ its one trailing blank); add `import { HighlightedText, buildEvidenceTermsByVerse, buildRetrievedCitationByVerse } from "./councilHighlight";`. Keep call sites (715/755/877/897/942) unchanged.
- [ ] **Step 3: Byte-identity diff** — `git show HEAD:…CouncilPanel.tsx` (971–1056) vs the new file's body; confirm identical modulo the 3 `export` prefixes.
- [ ] **Step 4: Build** — `npm run build` clean.
- [ ] **Step 5: Commit** — stage only the two files: `refactor(council): extract highlight + evidence-text utilities from CouncilPanel`.

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (flaky-cascade re-run protocol).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.
