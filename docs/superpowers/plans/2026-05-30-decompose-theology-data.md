# Decompose TheologyPanel — data/helpers module (F21) Implementation Plan

> **Sub-skill:** verbatim-sibling extraction (established F pattern). Behavior-preserving; tsc-driven imports; verified by the existing Theology e2e suite.

**Goal:** Move the JSX-free data/parsing/label/stats helpers + pure types out of the 1996-line
`TheologyPanel.tsx` into new `app/src/features/theology/theologyData.ts`.

**Spec:** `docs/superpowers/specs/2026-05-30-decompose-theology-data-design.md`

**Verification:** `npm run check` + full `npm run test:e2e:build` (flaky-cascade protocol).

---

## Task 1: Spec + plan commit

- [ ] Commit the spec + plan docs.

## Task 2: Extract theologyData.ts

- [ ] **Step 1:** Create `app/src/features/theology/theologyData.ts` with a `type`-only import from
  `../../lib/bible` (`TheologyLink`, `TheologyConclusion`, `TheologyTopic`, `TheologyPosition`) and the
  **exported, byte-identical** moved decls: types `TopicStatus`, `DoctrineRelationKind`,
  `DoctrineRelationPayload`, `TopicStats`, `ReviewCard`, `StudyPrompt`; fns `asTheologyPayloadRecord`,
  `readPayloadString`, `readPositiveInteger`, `readTheologyLinkPayload`, `stripSnippetMarkup`,
  `parseDoctrineRelation`, `relationLabel`, `theologyLinkKindLabel`, `theologyLinkPreview`,
  `groupTheologyEvidence`, `countOpenQuestions`, `buildTopicStats`, `buildProgressSummary`,
  `buildStudyPrompts`, `reviewAnswerFromTheologyLink`, `uniqueReviewCards`, `readReviewCards`.
- [ ] **Step 2:** Delete those decls from `TheologyPanel.tsx` (6 contiguous blocks: types 26–55;
  1449–1561; 1626–1669; 1693–1751; 1887–1930; 1940–1972). Leave `GUIDED_TEMPLATES`, the
  guided-* helpers, and the 4 JSX sub-components in place.
- [ ] **Step 3:** Add `import { … } from "./theologyData";` to `TheologyPanel.tsx`.
- [ ] **Step 4:** `npm run build` → fix TS2304 (add import) / TS6133 (drop unused) until clean.
- [ ] **Step 5:** Byte-diff the moved bodies vs the original (export-stripped) to confirm identity.
- [ ] **Step 6:** Commit:
  `git add app/src/features/theology/theologyData.ts app/src/features/theology/TheologyPanel.tsx`
  `git commit -m "refactor(theology): extract data/helpers module from TheologyPanel"`

## Task 3: Full gate + e2e + finish

- [ ] **Step 1:** `cd app && npm run check` → exit 0 (capture via redirect, not `| tail`).
- [ ] **Step 2:** `npm run test:e2e:build` → all pass (Theology blocks especially); flaky re-run protocol.
- [ ] **Step 3:** Mark spec Implemented; commit.
- [ ] **Step 4:** ff-merge to main, delete branch. Stage ONLY listed files; leave `Cargo.toml` + `.claude/` alone.

---

## Self-Review (plan author)

- **Scope discipline:** only JSX-free, non-`GUIDED_TEMPLATES` helpers move; 6 contiguous blocks → low risk of catching a stay-function in a range.
- **Verify-driven:** tsc finalizes the import set; byte-diff guarantees behavior preservation; existing Theology e2e is the regression net.
- **No new public behavior:** pure internal reorganization.
