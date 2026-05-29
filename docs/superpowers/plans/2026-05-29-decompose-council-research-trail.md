# Extract CouncilResearchTrail from CouncilPanel.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `CouncilResearchTrail` + `buildResearchTrail` out of `CouncilPanel.tsx` into `features/council/CouncilResearchTrail.tsx`, verbatim, zero behavior change. Second CouncilPanel slice; no shared helpers.

**Architecture:** Verbatim-sibling move (F8 pattern, but simpler — no shared-helper routing). The exclusive helper `buildResearchTrail` travels with the component as a private function.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-research-trail-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the trail; flaky-cascade protocol applies). No new test.

---

## Task 1: Move the cluster, rewire CouncilPanel

**Files:** Create `app/src/features/council/CouncilResearchTrail.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** from `CouncilPanel.tsx`: `CouncilResearchTrail` (988–1042) and `buildResearchTrail` (1238–1295).

- [ ] **Step 2: Create `app/src/features/council/CouncilResearchTrail.tsx`** — `import type { CouncilResponse, ResearchTrailEvent } from "../../lib/bible";`, then `export function CouncilResearchTrail(...)` (verbatim) and `function buildResearchTrail(...)` (verbatim, NOT exported — private). Confirm the body references only its props/locals + `ResearchTrailEvent` fields + `CouncilResponse`. If it references any other CouncilPanel identifier, STOP and report.

- [ ] **Step 3: Edit `CouncilPanel.tsx`:** delete both functions (988–1042 and 1238–1295). Add `import { CouncilResearchTrail } from "./CouncilResearchTrail";`. Remove `type ResearchTrailEvent,` from the `lib/bible` import (line 21) — it is now unused in CouncilPanel. Keep the `<CouncilResearchTrail response={response} />` call site (378) unchanged.

- [ ] **Step 4: Unused-symbol check.** Grep CouncilPanel.tsx for `ResearchTrailEvent` → expect ZERO references (then the import drop is correct). Grep for `buildResearchTrail`/`CouncilResearchTrail` definitions → expect ZERO (only the import + call site remain). No other now-unused imports.

- [ ] **Step 5: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix and re-run until clean.

- [ ] **Step 6: Commit:**
```bash
git add app/src/features/council/CouncilResearchTrail.tsx app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CouncilResearchTrail from CouncilPanel"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the two files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/crt.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/crt.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. The `council-mock.spec.ts` session render exercises the trail (`data-testid="council-research-trail"`). If failures are a contiguous block unrelated to council, re-run `npm run test:e2e` (no rebuild) to confirm green (known flaky cascade). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-research-trail spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** `CouncilResearchTrail` + `buildResearchTrail` → new file (Step 2); CouncilPanel removes both + imports the component + drops the dead `ResearchTrailEvent` type import (Step 3); verbatim/no-behavior-change; build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports `CouncilResearchTrail`, keeps `buildResearchTrail` private; imports `CouncilResponse`/`ResearchTrailEvent` from lib/bible; one-directional import (no cycle); call site (378) unchanged.
- **No shared helpers:** `buildResearchTrail` is exclusive (only caller is `CouncilResearchTrail`) — confirmed by grounding; nothing routes to a shared module.
- **Placeholder scan:** `← verbatim` markers are explicit copy instructions; exact import lines + commit command given.
