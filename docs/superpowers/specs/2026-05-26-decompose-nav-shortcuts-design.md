# Decompose God-Components F2 — Extract NavigationShortcuts from App.tsx — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `decompose-nav-shortcuts`)
- **Theme:** F — Decompose god-components, sub-project 2
- **Owner:** John Moore

## Problem

`App.tsx` is now ~2,079 lines (after F1). The next-largest self-contained sibling is
**`NavigationShortcuts`** (lines ~1708–1930, ~223 lines) — the sidebar shortcuts panel
(bookmarks/recents/saved-searches/workspaces + the tag chips/filter). It is fully prop-driven, so
extracting it (plus the pure `formatVerseId` helper it shares with `App()`) into dedicated modules
shrinks `App.tsx` by ~240 lines with zero behavior change. Continues the F pattern established in F1.

## Goals

1. Move `NavigationShortcuts` out of `App.tsx` into its own module, verbatim, zero behavior change.
2. Move the pure helper `formatVerseId` (used by both `NavigationShortcuts` and `App()`) into a
   shared module imported by both — no duplication.
3. `App.tsx` compiles and behaves identically (the bookmark/tag e2e tests are the proof).

## Non-goals (YAGNI)

- No change to `NavigationShortcuts`' markup, props, state, or behavior — verbatim move.
- No extraction of other siblings (CommandPalette/InterleavedReader) here (later F sub-projects).
- No refactor of the `App()` body.

## Boundary analysis (from grounding)

- `NavigationShortcuts` (1708–1930): props `books, bookmarks, history, savedSearches, workspaces,
  onJumpToVerse, onJumpToChapter, onRunSavedSearch, onRenameSavedSearch, onDeleteSavedSearch,
  onOpenWorkspace, tags, bookmarkTags, bookmarkTagFilter, onSetBookmarkTagFilter,
  onAttachBookmarkTag, onDetachBookmarkTag` (types from `lib/bible`). Internal `useState`
  (editing/busy state for saved-search rename). External refs: `formatVerseId` (line ~1794),
  `TagFilterBar` + `ItemTagRow` (already imported from `features/tags/TagControls`). No other App
  identifiers.
- `formatVerseId` (1932): pure (`verseId`, `books`). Used by `NavigationShortcuts` (1794) **and**
  `App()` (line ~826, for command-palette bookmark labels). → shared.

## Design

### New `app/src/lib/verse.ts`

```ts
import type { Book } from "./bible";

export function formatVerseId(verseId: number, books: Book[]) {
  // ← moved verbatim from App.tsx (body unchanged)
}
```
(Confirm `formatVerseId` references only `verseId` + `books` + the `Book` type — it does.)

### New `app/src/features/app-shell/NavigationShortcuts.tsx`

Moved verbatim, with these imports at the top:
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

export function NavigationShortcuts({ … }: { … }) {
  // ← moved verbatim from App.tsx (signature + body unchanged)
}
```
(Only import what it actually uses — confirm the type list against the prop signature; drop any
unused. `useState` is used for the saved-search edit state.)

### `app/src/App.tsx`

- **Remove** the `NavigationShortcuts` function (1708–1930) and the `formatVerseId` function (1932–).
- **Add** imports near the other feature imports:
  ```tsx
  import { NavigationShortcuts } from "./features/app-shell/NavigationShortcuts";
  import { formatVerseId } from "./lib/verse";
  ```
- **Keep** unchanged: the `<NavigationShortcuts … />` call site (passing all 17 props) and `App()`'s
  use of `formatVerseId` (line ~826).
- Confirm no now-unused imports/types remain in `App.tsx` (e.g. if a `bible.ts` type was only used by
  the moved `NavigationShortcuts`; most are used elsewhere in `App()` too — verify with the build).

## Data flow / behavior

Unchanged. `App()` still owns the nav-list state (`bookmarks`/`history`/`savedSearches`/`tags`/…) and
passes it as props; `NavigationShortcuts` renders identically. `formatVerseId` produces the same
strings from the same module.

## Edge cases

- **No circular import:** `App.tsx` → `NavigationShortcuts.tsx` → (`lib/bible`, `features/tags`,
  `lib/verse`); none import `App.tsx`. `lib/verse` → `lib/bible` (type only). One-directional.
- **Unused-type imports** in the new file → import exactly the types the signature uses; tsc flags
  extras.
- **`formatVerseId` correctness** → pure move; the bookmark-shortcut e2e renders a bookmark label via
  it, and tag tests render the shortcuts panel, catching any drift.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **`npm run test:e2e:build`** — `NavigationShortcuts` is exercised by `reader-interactions.spec.ts`
  *"bookmarks a verse and shows it in shortcuts"* (renders the bookmark in the sidebar) and the
  bookmark/tag tests (`reader-interactions` tag test, `tags-browse.spec.ts`) which render its tag
  chips/filter — strong behavior-preservation coverage. All specs must pass.
- **Full `npm run check`** green (capture the REAL npm exit code).
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference** → tsc fails the build.
- **Accidental edit during the move** → must be verbatim; the e2e tests render the panel + bookmark
  labels; reviewers diff the moved code.
- **Import-path mistakes** in the new file (relative paths to `lib`/`features/tags`) → tsc + the e2e
  catch them.

## Rollout

Single feature branch `decompose-nav-shortcuts`. Files:
- **New:** `app/src/lib/verse.ts`, `app/src/features/app-shell/NavigationShortcuts.tsx`.
- **Modify:** `app/src/App.tsx` (remove the two definitions; add two imports).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
