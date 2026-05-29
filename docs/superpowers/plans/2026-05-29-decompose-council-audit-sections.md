# Extract CouncilSourceDrawer + CouncilEvidenceAudit Implementation Plan

> **Sub-skill:** verbatim-sibling move (inline; each function extracted via `sed` for byte-identity, then diffed).

**Goal:** Move `CouncilSourceDrawer` (941–1066) and `CouncilEvidenceAudit` (1068–1137) out of `CouncilPanel.tsx` into two single-concern files, verbatim. Eleventh CouncilPanel slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-audit-sections-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders both; flaky-cascade protocol). No new test.

---

## Task 1: Move both leaves, rewire CouncilPanel

- [ ] **Step 1: Create `CouncilSourceDrawer.tsx`** — `import { useState } from "react";` + `import type { CouncilResponse } from "../../lib/bible";`, blank, then `export function CouncilSourceDrawer` (verbatim 941–1066, `export` prepended). Extract via `sed -n '941,1066p'`.
- [ ] **Step 2: Create `CouncilEvidenceAudit.tsx`** — `import type { CouncilResult, RetrievedEvidence } from "../../lib/bible";` + `import { evidenceStatusClass, evidenceStatusLabel, evidenceStatusTooltip, sourceDisplay, sourceTooltip } from "./councilTransparency";`, blank, then `export function CouncilEvidenceAudit` (verbatim 1068–1137, `export` prepended). Extract via `sed -n '1068,1137p'`.
- [ ] **Step 3: Edit `CouncilPanel.tsx`** — delete the contiguous block 941–1137 (+ trailing blank); add the two component imports. Build; if tsc reports `RetrievedEvidence`/`CouncilResult` (or any other) now-unused in CouncilPanel, drop only those from the `lib/bible` import. Keep status-helper imports (EvidenceDisplayItem) + `buildConfidenceFactors`. Keep call sites (387/393) unchanged.
- [ ] **Step 4: Byte-identity diff** — `git show HEAD:…CouncilPanel.tsx` (941–1066, 1068–1137) vs each new file; confirm identical modulo the `export` prefix.
- [ ] **Step 5: Build** — `npm run build` clean.
- [ ] **Step 6: Commit** — stage only the three files: `refactor(council): extract CouncilSourceDrawer + CouncilEvidenceAudit from CouncilPanel`.

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (flaky-cascade re-run protocol).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.
