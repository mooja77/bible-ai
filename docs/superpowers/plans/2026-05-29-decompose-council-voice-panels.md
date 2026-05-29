# Extract CouncilVoicePreview + CouncilRunningPanel from CouncilPanel.tsx Implementation Plan

> **Sub-skill:** verbatim-sibling move (executed inline by the orchestrator, like F9, with a git-diff byte-identity check).

**Goal:** Move `getCouncilVoices` + `hasSettingValue` + `CouncilVoicePreview` + `CouncilRunningPanel` out of `CouncilPanel.tsx` into `features/council/CouncilVoicePanels.tsx`, verbatim, zero behavior change. Sixth CouncilPanel slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-voice-panels-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the preview/running panels; flaky-cascade protocol applies). No new test.

---

## Task 1: Move the block, rewire CouncilPanel

- [ ] **Step 1: Create `app/src/features/council/CouncilVoicePanels.tsx`** — `import type { AppSettings } from "../../lib/bible";`, then verbatim: `getCouncilVoices` (private), `CouncilVoicePreview` (export), `CouncilRunningPanel` (export), `hasSettingValue` (private). No react import.
- [ ] **Step 2: Edit `CouncilPanel.tsx`** — delete the contiguous block 396–516; add `import { CouncilVoicePreview, CouncilRunningPanel } from "./CouncilVoicePanels";`. Keep `AppSettings` import and the call sites (255/257) unchanged.
- [ ] **Step 3: Byte-identity diff** — `git show HEAD:…CouncilPanel.tsx` (pre-change) vs the new file; confirm each function identical modulo the added `export`.
- [ ] **Step 4: Build** — `npm run build` clean.
- [ ] **Step 5: Commit** — stage only the two files: `refactor(council): extract CouncilVoicePreview + CouncilRunningPanel from CouncilPanel`.

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (flaky-cascade re-run protocol).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.
