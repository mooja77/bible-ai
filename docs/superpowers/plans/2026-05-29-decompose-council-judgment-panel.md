# Extract CouncilJudgmentPanel from CouncilPanel.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the judgment cluster (~440 lines) out of `CouncilPanel.tsx` into `features/council/CouncilJudgmentPanel.tsx`, verbatim, zero behavior change. Largest CouncilPanel slice.

**Architecture:** Verbatim-sibling move. `readPayloadJudgment`/`createEmptyJudgment` are EXPORTED from the new module (the main component imports them — this prevents a circular import, since the new module's `normalizeJudgment` needs `createEmptyJudgment`). `formatPercent` + `upsertCouncilJudgment` stay shared.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-judgment-panel-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock + council-follow-up cover the panel, restore, starting-view, and follow-up paths; flaky-cascade protocol applies). No new test.

---

## Task 1: Move the cluster, rewire CouncilPanel

**Files:** Create `app/src/features/council/CouncilJudgmentPanel.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** from `CouncilPanel.tsx`: the `FollowUpQuestion` interface (59–62), and the contiguous block 525–965: `readPayloadJudgment` (525–528), `createEmptyJudgment` (530–548), `normalizeJudgment` (550–571), `CouncilJudgmentPanel` (573–901), `buildCouncilFollowUpQuestions` (902–941), `LabeledTextarea` (943–965).

- [ ] **Step 2: Create `app/src/features/council/CouncilJudgmentPanel.tsx`** with imports:
```ts
import { useEffect, useMemo, useState } from "react";
import {
  getCouncilJudgment,
  upsertCouncilJudgment,
  type CouncilJudgment,
  type CouncilResponse,
  type PositionJudgment,
  type PositionUserRating,
} from "../../lib/bible";
import { formatPercent } from "./councilTransparency";
```
Then, verbatim: the `interface FollowUpQuestion` (private), `export function readPayloadJudgment`, `export function createEmptyJudgment`, `function normalizeJudgment` (private), `export function CouncilJudgmentPanel`, `function buildCouncilFollowUpQuestions` (private), `function LabeledTextarea` (private). Add `export` to exactly the three named (readPayloadJudgment/createEmptyJudgment/CouncilJudgmentPanel); the rest are private. If a body references a CouncilPanel identifier NOT covered by the imports, STOP and report. If tsc reports an import unused/missing, adjust ONLY the import set.

- [ ] **Step 3: Edit `CouncilPanel.tsx`** (delete the LOWER block first to keep line numbers stable):
  - Delete the contiguous block 525–965 (the six functions). Keep clean single-blank spacing (the preceding `hasSettingValue` and following `CouncilRetrievalControls` should be separated by one blank line).
  - Delete the `FollowUpQuestion` interface (59–62) + keep single-blank spacing.
  - Add `import { CouncilJudgmentPanel, readPayloadJudgment, createEmptyJudgment } from "./CouncilJudgmentPanel";` near the other council component imports.
  - From the `lib/bible` import block, REMOVE: `getCouncilJudgment`, `type PositionJudgment`, `type PositionUserRating`. KEEP `upsertCouncilJudgment` (used at ~176), `type CouncilJudgment` (state ~91), and everything else. Do NOT touch the `councilTransparency` import (`formatPercent` stays).
  - Keep the call site (379–384) and the main-component judgment logic (91/124/173/176) unchanged.

- [ ] **Step 4: Unused-symbol check.** Grep CouncilPanel.tsx: `getCouncilJudgment`/`PositionJudgment`/`PositionUserRating`/`FollowUpQuestion`/`normalizeJudgment`/`buildCouncilFollowUpQuestions`/`LabeledTextarea` → ZERO references. `readPayloadJudgment`/`createEmptyJudgment`/`CouncilJudgmentPanel` → only the import + their existing call sites (124/173/379). `upsertCouncilJudgment` → STILL present (~176). `CouncilJudgment` → still present. `formatPercent` → still present (multiple).

- [ ] **Step 5: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix import sets and re-run until clean.

- [ ] **Step 6: Commit:**
```bash
git add app/src/features/council/CouncilJudgmentPanel.tsx app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CouncilJudgmentPanel from CouncilPanel"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the two files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/cjp.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/cjp.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. `council-mock.spec.ts` (session submit/persist/restore + judgment) and `council-follow-up.spec.ts` (follow-up question) are direct coverage. If failures are a contiguous block unrelated to council, re-run `npm run test:e2e` (no rebuild) to confirm green (known flaky cascade). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-judgment-panel spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** 6 functions + the local interface → new file (Step 2); CouncilPanel removes both regions, imports the 3 exported symbols, drops the 3 dead `lib/bible` symbols (Step 3); verbatim/no-behavior-change; build + full check + suite regression incl. council-mock/follow-up (Tasks 1/2) ✓.
- **Type/name consistency:** exports = `CouncilJudgmentPanel`/`readPayloadJudgment`/`createEmptyJudgment`; private = `normalizeJudgment`/`buildCouncilFollowUpQuestions`/`LabeledTextarea`/`FollowUpQuestion`; `upsertCouncilJudgment`+`CouncilJudgment`+`formatPercent` kept in CouncilPanel; one-directional imports (cycle avoided by exporting the factories from the new module).
- **Exclusivity verified:** `getCouncilJudgment`/`PositionJudgment`/`PositionUserRating`/`FollowUpQuestion`/`normalizeJudgment`/`buildCouncilFollowUpQuestions`/`LabeledTextarea` used only within the cluster; `readPayloadJudgment`/`createEmptyJudgment` also used by main → exported; `upsertCouncilJudgment` also used by main → kept in both.
- **Placeholder scan:** spec Design block lists exact imports + verbatim markers; exact import line + commit command given; deletion-order note (lower block first) included.
