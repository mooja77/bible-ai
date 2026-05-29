# Extract CopyAsMarkdownButton + AddToTheologyMenu from CouncilPanel.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the two result-toolbar action controls + the markdown helpers out of `CouncilPanel.tsx` into two single-concern modules, verbatim, zero behavior change. Fourth CouncilPanel slice.

**Architecture:** Two new files — `CouncilMarkdownExport.tsx` (CopyAsMarkdownButton + 3 private markdown helpers) and `AddToTheologyMenu.tsx` (the theology-link menu). Verbatim-sibling pattern; `formatCouncilTransparencyMarkdown` stays shared in `councilTransparency`.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-result-actions-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the toolbar; smoke links a session to Theology; flaky-cascade protocol applies). No new test.

---

## Task 1: Move both concerns, rewire CouncilPanel

**Files:** Create `app/src/features/council/CouncilMarkdownExport.tsx` + `app/src/features/council/AddToTheologyMenu.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** from `CouncilPanel.tsx`: `formatPositionRating` (969–983), `CopyAsMarkdownButton` (1087–1116), `AddToTheologyMenu` (1118–1204), `renderResponseAsMarkdown` (1206–1243), `appendJudgmentMarkdown` (1245–1283).

- [ ] **Step 2: Create `app/src/features/council/CouncilMarkdownExport.tsx`:**
  - Imports: `import { useState } from "react";` `import type { CouncilJudgment, CouncilResponse, PositionUserRating } from "../../lib/bible";` `import { formatCouncilTransparencyMarkdown } from "./councilTransparency";`
  - `export function CopyAsMarkdownButton` (verbatim 1087–1116).
  - Private (NOT exported): `renderResponseAsMarkdown` (1206–1243), `appendJudgmentMarkdown` (1245–1283), `formatPositionRating` (969–983) — all verbatim.

- [ ] **Step 3: Create `app/src/features/council/AddToTheologyMenu.tsx`:**
  - Imports: `import { useState } from "react";` `import { createTheologyLink, listTheologyTopics, type CouncilResponse, type TheologyTopic } from "../../lib/bible";`
  - `export function AddToTheologyMenu` (verbatim 1118–1204).

- [ ] **Step 4: Edit `CouncilPanel.tsx`:**
  - Delete `formatPositionRating` (969–983) and the contiguous block 1087–1283 (the four functions).
  - Add `import { CopyAsMarkdownButton } from "./CouncilMarkdownExport";` and `import { AddToTheologyMenu } from "./AddToTheologyMenu";` (near the other council component imports).
  - From the `lib/bible` import: REMOVE `createTheologyLink`, `listTheologyTopics`, `type TheologyTopic`. KEEP `type CouncilJudgment`, `type PositionUserRating` (used at ~861), `type CouncilResponse`.
  - From the `councilTransparency` import (the `{ … } from "./councilTransparency"` block): REMOVE `formatCouncilTransparencyMarkdown`.
  - Keep the call sites (350 `<AddToTheologyMenu … />`, 355 `<CopyAsMarkdownButton … />`) unchanged.

- [ ] **Step 5: Unused-symbol check.** Grep CouncilPanel.tsx: `createTheologyLink`/`listTheologyTopics`/`TheologyTopic`/`formatCouncilTransparencyMarkdown` → ZERO references (drops correct). `PositionUserRating` → STILL present (~861, import kept). `CouncilJudgment` → still present. `formatPositionRating`/`renderResponseAsMarkdown`/`appendJudgmentMarkdown`/`CopyAsMarkdownButton`/`AddToTheologyMenu` → ZERO remaining DEFS (only the 2 imports + 2 call sites).

- [ ] **Step 6: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix import sets and re-run until clean.

- [ ] **Step 7: Commit:**
```bash
git add app/src/features/council/CouncilMarkdownExport.tsx app/src/features/council/AddToTheologyMenu.tsx app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CopyAsMarkdownButton + AddToTheologyMenu from CouncilPanel"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the three files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/cra.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/cra.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. `council-mock.spec.ts` renders the result toolbar; `smoke.spec.ts` links a Council session to Theology (exercises AddToTheologyMenu). If failures are a contiguous block unrelated to council, re-run `npm run test:e2e` (no rebuild) to confirm green (known flaky cascade). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-result-actions spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** markdown concern (4 fns) → `CouncilMarkdownExport.tsx`; theology menu → `AddToTheologyMenu.tsx` (Steps 2–3); CouncilPanel removes both regions, imports the 2 components, drops the 4 dead symbols across 2 import groups (Step 4); verbatim/no-behavior-change; build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** `CouncilMarkdownExport` exports `CopyAsMarkdownButton` (3 helpers private); `AddToTheologyMenu.tsx` exports `AddToTheologyMenu`; both import only what their bodies use; `formatCouncilTransparencyMarkdown` stays shared (imported, not moved); `PositionUserRating`/`CouncilJudgment` kept in CouncilPanel; one-directional imports (no cycle); call sites unchanged.
- **Exclusivity verified:** `formatPositionRating` used only at 1270 (moves); theology fns/`TheologyTopic`/`formatCouncilTransparencyMarkdown` used only in their cluster; `PositionUserRating` retained (861).
- **Placeholder scan:** spec Design block lists exact imports; `← verbatim` markers are copy instructions; exact commit command given.
