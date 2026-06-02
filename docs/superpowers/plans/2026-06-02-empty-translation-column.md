# Hide empty translation columns — Implementation Plan

> Don't give a translation a column/row when it has no text for the current
> chapter; tell the user it was omitted instead of silently dropping it.

**Spec:** `docs/superpowers/specs/2026-06-02-empty-translation-column-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build` + windows-mcp visual.

## Tasks (as executed)
- [x] **TDD:** `tests/e2e/empty-translation-column.spec.ts` — pins active set to
  KJV+TR (everything else off); Genesis → `absent-translations-note` names TR
  (not KJV), no "No verses for this chapter." text, KJV verses render; John →
  no note; restores single-KJV at end. Registered in `wdio.conf.mts` after
  `ui-scale.spec.ts`. Navigates via the **book-list buttons** (`button=Genesis`/
  `button=John`), not the jump input — the controlled jump-input update raced
  the Go click and re-navigated with the stale value.
- [x] **Implement:** in `App.tsx`, added `chapterDataKey` (which book:chapter the
  loaded data is for) → `chapterDataReady` gate; `presentActive`/`absentActive`
  memos filter only when ready; single/interleaved/columns render off
  `presentActive`; all-absent `ReaderPlaceholder`; the `absent-translations-note`.
- [x] **Verify:** `npm run check` 66/66; full `npm run test:e2e` 64/64 (clean
  green run; earlier failures were machine-starvation flakes in unrelated specs).
- [x] **Runtime confirm:** the e2e ran in the real built app; a DOM diagnostic
  captured the live note text ("No text in this chapter for WLC." on John when
  WLC was active) — proving the omission logic fires exactly when a translation
  lacks the chapter. (Pixel-level screenshot skipped: desktop too cluttered with
  the user's other live sessions to surface the window safely.)
- [x] Docs Implemented; ff-merge to main; delete branch.

## Notes / watchpoints (resolved)
- **Stale-data flicker was the real subtlety:** right after navigation
  `selectedBook` updates a render *before* the load effect runs, so `chapterData`
  still held the previous chapter — briefly showing a wrong omission note. Fixed
  with the `chapterDataKey`/`chapterDataReady` gate (only filter once the loaded
  data belongs to the current chapter), not just the `loading` flag.
- Shared wdio session — the spec pins the full 6-translation active set and
  restores single-KJV (an earlier spec had left **WLC** enabled, which surfaced
  as a correct-but-unexpected note on John during debugging).
- `ui-scale-*` / reader testids untouched.
