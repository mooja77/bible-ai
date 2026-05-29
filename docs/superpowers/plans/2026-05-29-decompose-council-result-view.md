# Extract the CouncilResultView chain from CouncilPanel.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the 8-function `CouncilResultView` render chain (507–895) out of `CouncilPanel.tsx` into `features/council/CouncilResultView.tsx`, verbatim, zero behavior change. Twelfth/capstone CouncilPanel slice.

**Architecture:** Verbatim-sibling move of a contiguous, self-contained subtree. Exports `CouncilResultView` (main render + VoiceRow) + `ConfidenceBadge` (CouncilConfidenceRationale); the other 6 are private. Heavy import rerouting — tsc is the arbiter of the exact drop list.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-result-view-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the full result view + VoiceRow's embedded CouncilResultView; flaky-cascade protocol). No new test.

---

## Task 1: Move the chain, rewire CouncilPanel

**Files:** Create `app/src/features/council/CouncilResultView.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** the 8 functions (507–895): `SynthesisModeBanner` (507–524), `CouncilResultView` (525–602), `ConfidenceBadge` (603–619), `CouncilWinnerSummary` (620–691), `WinnerMetric` (692–709), `PositionCard` (710–783), `CouncilEvidenceTabs` (784–849), `EvidenceDisplayItem` (850–895). The cleanest capture is `sed -n '507,895p'`.

- [ ] **Step 2: Create `app/src/features/council/CouncilResultView.tsx`** — the import header from the spec's Design block, then the verbatim 507–895 span. Prepend `export ` to exactly `CouncilResultView` and `ConfidenceBadge`; leave the other 6 as plain `function`. Adjust ONLY the import set to what tsc accepts (the spec lists the expected set) — never a body. If any body references a CouncilPanel identifier not covered by the imports, STOP and report.

- [ ] **Step 3: Edit `CouncilPanel.tsx`:**
  - Delete the contiguous span 507–895.
  - Add `import { CouncilResultView, ConfidenceBadge } from "./CouncilResultView";` near the other council component imports.
  - Delete the entire line `import { HighlightedText, buildEvidenceTermsByVerse } from "./councilHighlight";`.
  - In the `councilTransparency` import: KEEP `buildConfidenceFactors`; DROP `buildPositionEvidenceGroups`, `countVoiceMentions`, `formatPercent`, `labelsOverlap`, `evidenceStatusClass`, `evidenceStatusLabel`, `evidenceStatusTooltip`, `sourceDisplay`, `sourceTooltip`, `type EvidenceDisplayRow`. (If tsc shows any of these is somehow still used, keep that one — tsc is the arbiter.)
  - Keep the call sites unchanged: `<CouncilResultView … />` (358), the `CouncilResultView` use inside `VoiceRow`, and `<ConfidenceBadge … />` in `CouncilConfidenceRationale`.

- [ ] **Step 4: Unused-symbol check.** Grep CouncilPanel.tsx: the 6 private chain fns + `buildPositionEvidenceGroups`/`countVoiceMentions`/`formatPercent`/`labelsOverlap`/`HighlightedText`/`buildEvidenceTermsByVerse`/`evidenceStatus*`/`source*`/`EvidenceDisplayRow` → ZERO refs; `CouncilResultView`/`ConfidenceBadge` → only the import + their call sites (358/VoiceRow/907); `buildConfidenceFactors` → still used (897). No remaining DEFS of the 8 moved functions.

- [ ] **Step 5: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix import sets and re-run until clean.

- [ ] **Step 6: Commit:**
```bash
git add app/src/features/council/CouncilResultView.tsx app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CouncilResultView render chain from CouncilPanel"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` stays uncommitted. Stage only the two files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/crv.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/crv.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (600000 ms) → all pass. `council-mock.spec.ts` is direct coverage (full result view + VoiceRow). If failures are a contiguous block unrelated to council, re-run `npm run test:e2e` (no rebuild) to confirm (known flaky cascade). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-result-view spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** 8-function chain → new file (Step 2); CouncilPanel removes the span, adds the component import, removes the councilHighlight import, prunes the councilTransparency import (Step 3); verbatim/no-behavior-change; build + check + suite incl. VoiceRow's embedded CouncilResultView (Tasks 1/2) ✓.
- **Type/name consistency:** exports = `CouncilResultView`/`ConfidenceBadge` (consumed by main render + VoiceRow + CouncilConfidenceRationale); other 6 private; one-directional imports (no cycle); `buildConfidenceFactors` retained.
- **Drop-list rigor:** grounding shows every dropped helper is chain-only now (prior slices F14–F18 already moved the other consumers); tsc is the final arbiter.
- **Placeholder scan:** spec Design lists exact imports; `sed -n '507,895p'` capture; exact commit command.
