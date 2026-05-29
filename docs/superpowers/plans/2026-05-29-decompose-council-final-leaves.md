# Extract CouncilConfidenceRationale + VoicesAuditTrail/VoiceRow Implementation Plan

> **Sub-skill:** verbatim-sibling move (inline; each region extracted via `sed` for byte-identity, then diffed; tsc arbiter for import drops).

**Goal:** Move `CouncilConfidenceRationale` (493–537) and `VoicesAuditTrail`+`VoiceRow` (539–660) out of `CouncilPanel.tsx` into two single-concern files, verbatim. Final CouncilPanel leaves.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-final-leaves-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders both; flaky-cascade protocol). No new test.

---

## Task 1: Move both leaves, rewire CouncilPanel

- [ ] **Step 1: Create `CouncilConfidenceRationale.tsx`** — imports (`type CouncilResponse` from lib/bible; `buildConfidenceFactors` from `./councilTransparency`; `ConfidenceBadge` from `./CouncilResultView`), blank, then `export function CouncilConfidenceRationale` (verbatim 493–537, `export` prepended). Extract via `sed -n '493,537p'`.
- [ ] **Step 2: Create `CouncilVoicesAudit.tsx`** — imports (`useState` from react; `type { CouncilProviderInfo, CouncilVoice }` from lib/bible; `CouncilResultView` from `./CouncilResultView`), blank, then `export function VoicesAuditTrail` (verbatim 539–571, `export` prepended) + private `function VoiceRow` (verbatim 573–660). Extract via `sed -n '539,660p'` and prepend `export` to the `VoicesAuditTrail` line only.
- [ ] **Step 3: Edit `CouncilPanel.tsx`** — delete `CouncilConfidenceRationale` (493–537) and `VoicesAuditTrail`+`VoiceRow` (539–660); add the two component imports; change the CouncilResultView import to drop `ConfidenceBadge` (keep `CouncilResultView`); remove the `buildConfidenceFactors` councilTransparency import line. Build; drop now-unused `CouncilVoice`/`CouncilProviderInfo` from the lib/bible import per tsc. Keep call sites (344/360/375).
- [ ] **Step 4: Byte-identity diff** — `git show HEAD:…CouncilPanel.tsx` (493–537, 539–660) vs each new file's body; confirm identical modulo the `export` prefixes (use full-span diff, not per-function `/^}$/`).
- [ ] **Step 5: Build** — `npm run build` clean.
- [ ] **Step 6: Commit** — stage only the three files: `refactor(council): extract CouncilConfidenceRationale + VoicesAuditTrail from CouncilPanel`.

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (flaky-cascade re-run protocol).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.
