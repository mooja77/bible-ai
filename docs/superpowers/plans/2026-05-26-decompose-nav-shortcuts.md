# Extract NavigationShortcuts from App.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `NavigationShortcuts` + the shared `formatVerseId` helper out of `App.tsx` into dedicated modules, verbatim, with zero behavior change.

**Architecture:** Pure structural extraction (same pattern as F1/GuidedTour). `formatVerseId` → `lib/verse.ts` (shared by App + the component); `NavigationShortcuts` → `features/app-shell/NavigationShortcuts.tsx`. `App.tsx` imports both and removes the local definitions.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-decompose-nav-shortcuts-design.md`

**Verification:** `npm run build` + `npm run test:e2e:build` (bookmark-shortcut + tag tests render `NavigationShortcuts`) + full `npm run check`. No new test.

---

## Task 1: Move NavigationShortcuts + formatVerseId

**Files:** Create `app/src/lib/verse.ts` + `app/src/features/app-shell/NavigationShortcuts.tsx`; modify `app/src/App.tsx`.

- [ ] **Step 1: Read the source ranges** in `App.tsx` (move verbatim):
  - `function NavigationShortcuts({ … }) { … }` (~1708–1930, through its closing brace) — note the exact prop destructuring + the prop type block + the body.
  - `function formatVerseId(verseId: number, books: Book[]) { … }` (~1932, through its closing brace).

- [ ] **Step 2: Create `app/src/lib/verse.ts`:**
```ts
import type { Book } from "./bible";

// ← paste the exact formatVerseId body from App.tsx
export function formatVerseId(verseId: number, books: Book[]) {
  // …verbatim…
}
```

- [ ] **Step 3: Create `app/src/features/app-shell/NavigationShortcuts.tsx`:**
```tsx
import { useState } from "react";
import type {
  Book,
  Bookmark,
  ReadingHistoryItem,
  SavedSearch,
  StudyWorkspaceSummary,
  Tag,
  ItemTag,
} from "../../lib/bible";
import { TagFilterBar, ItemTagRow } from "../tags/TagControls";
import { formatVerseId } from "../../lib/verse";

// ← paste the exact NavigationShortcuts function from App.tsx (add `export`)
export function NavigationShortcuts({
  // …verbatim props…
}: {
  // …verbatim prop types…
}) {
  // …verbatim body…
}
```
Confirm the moved body references ONLY: its props, internal `useState`, `formatVerseId`,
`TagFilterBar`, `ItemTagRow`. If it uses any other `App.tsx` identifier, STOP and report it (the
boundary analysis says it shouldn't). Import exactly the `bible.ts` types the signature uses (drop
any unused so tsc doesn't error).

- [ ] **Step 4: Edit `App.tsx`:** delete the `NavigationShortcuts` function and the `formatVerseId`
function. Add imports near the other feature imports (e.g. by the `GuidedTour`/`TagBrowser` imports):
```tsx
import { NavigationShortcuts } from "./features/app-shell/NavigationShortcuts";
import { formatVerseId } from "./lib/verse";
```
Keep unchanged: the `<NavigationShortcuts … />` call site (all 17 props) and `App()`'s use of
`formatVerseId` (~line 826).

- [ ] **Step 5: Unused-symbol check in `App.tsx`.** After removal, verify no now-unused imports/types
remain (most `bible.ts` types used by `NavigationShortcuts` are also used elsewhere in `App()`; the
build will flag any that became unused — remove them from `App.tsx`'s imports if so).

- [ ] **Step 6: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix any dangling ref / unused import and re-run until clean.

- [ ] **Step 7: Commit:**
```bash
git add app/src/lib/verse.ts app/src/features/app-shell/NavigationShortcuts.tsx app/src/App.tsx
git commit -m "refactor(app): extract NavigationShortcuts + formatVerseId from App.tsx"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`, capture the real exit: `npm run check > /tmp/nav.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/nav.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass, especially `reader-interactions.spec.ts` *"bookmarks a verse and shows it in shortcuts"* + the bookmark/tag tests + `tags-browse.spec.ts` (they render `NavigationShortcuts`). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-nav-shortcuts spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** `formatVerseId` → `lib/verse.ts` (shared, Task 1 Step 2); `NavigationShortcuts` → `features/app-shell/` (Step 3); App removes both + imports them (Step 4); verbatim/no-behavior-change ("paste exact"); build + e2e (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports match App imports (`{ NavigationShortcuts }`, `{ formatVerseId }`); `NavigationShortcuts` prop shape unchanged; `formatVerseId(verseId, books)` signature unchanged; one-directional imports (no cycle).
- **Placeholder scan:** the `← paste exact` markers are explicit verbatim-copy instructions for a 220-line component move (the honest way to specify a byte-identical move), not vague placeholders; exact import lines + commands given.
