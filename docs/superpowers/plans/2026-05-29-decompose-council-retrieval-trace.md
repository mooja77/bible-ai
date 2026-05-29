# Extract CouncilRetrievalTrace + lift evidence-status helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Lift the 5 evidence-status helpers into `councilTransparency.ts` and move `CouncilRetrievalTrace` + `RetrievalScoreBar` into `features/council/CouncilRetrievalTrace.tsx`, verbatim, zero behavior change. Tenth CouncilPanel slice.

**Architecture:** Shared-helper lift (status helpers used by 3 consumers → shared module) + verbatim-sibling component move. Same patterns as F8/F16.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-retrieval-trace-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the trace + evidence audit; flaky-cascade protocol). No new test.

---

## Task 1: Lift status helpers + extract retrieval trace, rewire CouncilPanel

**Files:** Modify `app/src/features/council/councilTransparency.ts`; create `app/src/features/council/CouncilRetrievalTrace.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** from `CouncilPanel.tsx`: `CouncilRetrievalTrace` (890–955), `RetrievalScoreBar` (957–970), and the 5 status helpers `evidenceStatusLabel` (1216–1221), `evidenceStatusClass` (1223–1228), `evidenceStatusTooltip` (1230–1235), `sourceDisplay` (1237–1242), `sourceTooltip` (1244–1252).

- [ ] **Step 2: Append the 5 status helpers to `councilTransparency.ts`**, each `export`ed, verbatim (keep the inline `"used"|"supporting"|"conflicting"|"ignored"` union — do NOT rewrite to `EvidenceStatus`). FIRST grep `councilTransparency.ts` for any pre-existing `evidenceStatusLabel|evidenceStatusClass|evidenceStatusTooltip|sourceDisplay|sourceTooltip` — if one exists byte-identical, reuse it (export it if needed) instead of adding a duplicate; if it exists but DIFFERS, STOP and report. Verify the file type-checks.

- [ ] **Step 3: Create `app/src/features/council/CouncilRetrievalTrace.tsx`** with imports: `type { CouncilResponse }` from lib/bible; `{ buildRetrievalTraceRows, evidenceStatusClass, evidenceStatusTooltip, sourceTooltip, type EvidenceDisplayRow }` from `./councilTransparency`; `{ HighlightedText, buildRetrievedCitationByVerse }` from `./councilHighlight`. Then `export function CouncilRetrievalTrace` (verbatim 890–955) + private `function RetrievalScoreBar` (verbatim 957–970). Adjust ONLY the import set if tsc flags unused/missing.

- [ ] **Step 4: Edit `CouncilPanel.tsx`:**
  - Delete `CouncilRetrievalTrace` + `RetrievalScoreBar` (890–970) and the 5 status helpers (1216–1252).
  - Add `import { CouncilRetrievalTrace } from "./CouncilRetrievalTrace";`.
  - In the `councilTransparency` import: ADD `evidenceStatusLabel, evidenceStatusClass, evidenceStatusTooltip, sourceDisplay, sourceTooltip`; REMOVE `buildRetrievalTraceRows`.
  - In the `councilHighlight` import: REMOVE `buildRetrievedCitationByVerse` (keep `HighlightedText`, `buildEvidenceTermsByVerse`).
  - Keep the `<CouncilRetrievalTrace … />` call site (367) and the `EvidenceDisplayItem`/`CouncilEvidenceAudit` bodies unchanged.

- [ ] **Step 5: Unused-symbol check.** Grep CouncilPanel.tsx: `buildRetrievalTraceRows`/`buildRetrievedCitationByVerse` → ZERO refs; `evidenceStatusLabel`/`evidenceStatusClass`/`evidenceStatusTooltip`/`sourceDisplay`/`sourceTooltip` → still referenced (EvidenceDisplayItem + CouncilEvidenceAudit), now via import; `HighlightedText`/`buildEvidenceTermsByVerse` → still referenced; no remaining DEFS of the moved 7 functions. tsc enforces.

- [ ] **Step 6: Build.** From `app/`: `npm run build` → clean. Fix import sets and re-run.

- [ ] **Step 7: Commit:**
```bash
git add app/src/features/council/CouncilRetrievalTrace.tsx app/src/features/council/councilTransparency.ts app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CouncilRetrievalTrace + lift evidence-status helpers"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` stays uncommitted. Stage only the three files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/crt2.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/crt2.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (600000 ms) → all pass. If failures are a contiguous block unrelated to council, re-run `npm run test:e2e` (no rebuild) to confirm (known flaky cascade). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-retrieval-trace spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** 5 status helpers → `councilTransparency` (Step 2); `CouncilRetrievalTrace`+`RetrievalScoreBar` → new file (Step 3); CouncilPanel removes both regions + adjusts 3 import groups + adds 1 component import (Step 4); verbatim/no-behavior-change; build + check + suite (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports `CouncilRetrievalTrace` (RetrievalScoreBar private); status helpers exported from councilTransparency, consumed by 3 callers; `buildRetrievalTraceRows`/`buildRetrievedCitationByVerse` dropped from CouncilPanel (cluster-only); one-directional imports (no cycle); call site unchanged.
- **Collision guard:** Step 2 greps councilTransparency for pre-existing status helpers (F8-style reuse).
- **Placeholder scan:** spec Design lists exact imports; verbatim markers + exact commit command given.
