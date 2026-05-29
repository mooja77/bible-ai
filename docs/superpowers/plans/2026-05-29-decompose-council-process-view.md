# Extract CouncilProcessView from CouncilPanel.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the process-view cluster out of `CouncilPanel.tsx` (3,159 lines) into `features/council/CouncilProcessView.tsx`, and the 3 shared label/voice helpers into the existing `councilTransparency.ts`, verbatim, zero behavior change. First CouncilPanel decomposition slice.

**Architecture:** Same verbatim-sibling + shared-helper pattern as App.tsx F2/F3. Exclusive helpers travel with the component; shared helpers go to the shared util module.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-process-view-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock/follow-up specs cover the process view; Theology smoke tests known-flaky → re-run `npm run test:e2e`). No new test.

---

## Task 1: Move shared helpers + process-view cluster, rewire CouncilPanel

**Files:** Modify `app/src/features/council/councilTransparency.ts`; create `app/src/features/council/CouncilProcessView.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** from `CouncilPanel.tsx`: `CouncilProcessView` (1735–1833), `ProcessMetric` (1835–1851), `ProcessStep` (1853–1873), `ArgumentComparison` (1875–1910), `ArgumentSnapshot` (1912–1937), `countEvidenceClassifications` (1939–1960), `countVoiceMentions` (1962–1966), `labelsOverlap` (1968–1972), `normalizeLabel` (1974–1976), `buildComparisonReasons` (1978–2017).

- [ ] **Step 2: Append shared helpers to `councilTransparency.ts`** — add `countVoiceMentions` (exported), `labelsOverlap` (exported), `normalizeLabel` (NOT exported — private; only `labelsOverlap` uses it), verbatim per the spec's Design block. `CouncilVoice` is already imported at the top of the file — no new import needed. Verify the file still type-checks.

- [ ] **Step 3: Create `app/src/features/council/CouncilProcessView.tsx`** — `export function CouncilProcessView`, plus the 5 other exclusive functions as private (`ProcessMetric`, `ProcessStep`, `ArgumentComparison`, `ArgumentSnapshot`, `countEvidenceClassifications`, `buildComparisonReasons`), all verbatim. Imports: `import type { CouncilPosition, CouncilResponse, CouncilResult, RetrievedEvidence } from "../../lib/bible";` and `import { countVoiceMentions } from "./councilTransparency";`. (If tsc reports a type unused or missing, adjust the type import set to exactly what compiles — do not change any body.)

- [ ] **Step 4: Edit `CouncilPanel.tsx`:** delete the entire 1735–2017 block (all 10 functions). Add `import { CouncilProcessView } from "./CouncilProcessView";`. Update the existing `councilTransparency` import (lines 35–43) to ALSO import `countVoiceMentions, labelsOverlap` (CouncilPanel still uses `labelsOverlap` at 1689/2516 and `countVoiceMentions` at 2050/2234). Keep the `<CouncilProcessView response={response} />` call site (365) and all four shared-helper call sites unchanged.

- [ ] **Step 5: Unused-symbol check.** CouncilPanel must NOT reference `normalizeLabel`, `countEvidenceClassifications`, or `buildComparisonReasons` after the move (grounding: it doesn't). `countVoiceMentions`/`labelsOverlap` now imported. No now-unused imports. tsc enforces.

- [ ] **Step 6: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix import sets and re-run until clean.

- [ ] **Step 7: Commit:**
```bash
git add app/src/features/council/CouncilProcessView.tsx app/src/features/council/councilTransparency.ts app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CouncilProcessView + shared label helpers from CouncilPanel"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the three files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/cpv.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/cpv.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. The `council-mock.spec.ts` session-render test exercises the process view (`data-testid="council-process-view"`). If only the known-flaky `smoke.spec.ts` Theology tests fail, re-run `npm run test:e2e` (no rebuild) to confirm green. INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-process-view spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** process-view cluster (5 components + 2 exclusive helpers) → `CouncilProcessView.tsx` (Step 3); shared trio → `councilTransparency.ts` (Step 2); CouncilPanel removes the block + imports the component + the 2 shared helpers (Step 4); verbatim/no-behavior-change; build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports `CouncilProcessView`; `councilTransparency` exports `countVoiceMentions`/`labelsOverlap` (consumed by both files) with `normalizeLabel` private; one-directional imports (no cycle); CouncilPanel's 4 shared-helper call sites + the `<CouncilProcessView>` call site unchanged.
- **Shared-helper scoping:** the failure mode (trapping `countVoiceMentions`/`labelsOverlap` in the new module) is explicitly avoided by routing them to `councilTransparency`; tsc would fail otherwise.
- **Placeholder scan:** spec Design blocks are the verbatim source; exact import lines + commit command given.
