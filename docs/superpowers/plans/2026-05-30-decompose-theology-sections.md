# Decompose TheologyPanel — JSX sub-components (F22) Implementation Plan

> **Sub-skill:** verbatim-sibling extraction (established F pattern). Tail-cut of 4 contiguous prop-driven components. tsc-driven imports; verified by byte-diff + existing Theology e2e.

**Goal:** Move `DoctrineMap`, `TheologyEvidenceSection`, `ProgressMetric`, `TheologyTextarea` out of
`TheologyPanel.tsx` into new `app/src/features/theology/TheologySections.tsx`.

**Spec:** `docs/superpowers/specs/2026-05-30-decompose-theology-sections-design.md`

**Verification:** `npm run check` + full `npm run test:e2e:build` (flaky-cascade protocol).

---

## Task 1: Spec + plan commit

- [ ] Commit spec + plan docs.

## Task 2: Extract TheologySections.tsx

- [ ] **Step 1:** Create `TheologySections.tsx`: type-only import of `TheologyLink`, `TheologyTopic`
  from `../../lib/bible`; named import of `relationLabel`, `theologyLinkKindLabel`,
  `theologyLinkPreview` + types `DoctrineRelationKind`, `DoctrineRelationPayload` from `./theologyData`;
  the 4 components **exported, byte-identical** to the originals.
- [ ] **Step 2:** Delete the contiguous block `function DoctrineMap({ … }` → EOF from `TheologyPanel.tsx`.
- [ ] **Step 3:** Add `import { DoctrineMap, ProgressMetric, TheologyEvidenceSection, TheologyTextarea } from "./TheologySections";` to the panel.
- [ ] **Step 4:** `npm run build` → drop now-unused names from the panel's `./theologyData` import (TS6133) / add any missing (TS2304) until clean.
- [ ] **Step 5:** Byte-diff the 4 moved bodies vs original (export-stripped) → identical.
- [ ] **Step 6:** Commit:
  `git add app/src/features/theology/TheologySections.tsx app/src/features/theology/TheologyPanel.tsx`
  `git commit -m "refactor(theology): extract JSX sub-components from TheologyPanel"`

## Task 3: Full gate + e2e + finish

- [ ] **Step 1:** `cd app && npm run check` → exit 0 (capture via redirect).
- [ ] **Step 2:** `npm run test:e2e:build` → all pass; flaky re-run protocol.
- [ ] **Step 3:** Mark spec Implemented; commit.
- [ ] **Step 4:** ff-merge to main, delete branch. Stage ONLY listed files; leave Cargo.toml + .claude/.

---

## Self-Review (plan author)

- **Scope discipline:** the 4 components are the file's contiguous tail → unambiguous cut, no risk of catching a stay-decl.
- **Verify-driven:** tsc finalizes the panel import drops; byte-diff guarantees preservation; smoke.spec renders all 4.
- **No new behavior:** pure internal reorganization.
