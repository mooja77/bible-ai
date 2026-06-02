# Hide empty translation columns — Design

- **Date:** 2026-06-02
- **Status:** Implemented
- **Theme:** UX. Follow-up to the size-control fix; logged during the manual
  walkthrough as the "empty 4th column" problem.

## Problem

When two or more translations are active, the Reader's **Columns** layout (and the
**Interleaved** layout) renders one column/row group per active translation —
*even for a translation that has no text for the current chapter*. The bundled
corpus has canon-limited translations:

- **TR** (Textus Receptus) — New Testament only → 0 verses in Genesis.
- **WLC** (Westminster Leningrad Codex) — Old Testament only → 0 verses in John.

So with **KJV + TR** active on **Genesis 1**, TR gets a full-width column that
just reads *"No verses for this chapter."* — wasting reading width and looking
broken to a non-technical user. Interleaved layout has the matching defect: every
verse row renders an empty `TR  ` line.

## Change (in `app/src/App.tsx`)

Partition the active translations by whether they actually have verses for the
current chapter, then drive every layout off the **present** subset:

- `presentActive` = active translations that have ≥1 verse for this chapter.
- `absentActive`  = active translations with 0 verses for this chapter.
- **Guarded by `loading`:** while a chapter is fetching, `chapterData` still holds
  the previous chapter, so we do **not** filter (use all active) — this avoids a
  flicker where columns vanish mid-load. Filtering applies only once loaded.

Render logic:

- `presentActive.length === 1` → the single `ChapterReader` (with heading).
- Interleaved → `InterleavedReader translations={presentActive}`.
- Columns → map over `presentActive` only.
- `!loading && presentActive.length === 0` (every enabled translation lacks this
  chapter) → a `ReaderPlaceholder` ("No text for this chapter") instead of N empty
  columns.

### Nothing silently vanishes

When `absentActive` is non-empty, a subtle note is shown above the reader
(`data-testid="absent-translations-note"`): *"No text in this chapter for TR."*
This tells the user their enabled translation simply doesn't cover this chapter —
deliberately chosen over silently dropping the column, so a non-technical user is
never left wondering where a translation went.

No data/handler changes: `chapterData`, `activeTranslations`, and all reader
handlers are untouched; this is purely which translations each layout iterates.

## Testing

- **e2e** `tests/e2e/empty-translation-column.spec.ts`: enable **KJV + TR**, jump
  to **Genesis 1** (Columns), assert the omission note names **TR**, assert
  *"No verses for this chapter."* is **not** shown, and KJV verses still render.
  Restores translation state (TR off) so the shared wdio session is unperturbed.
- `npm run check` (tsc/build + rust + sidecar) and full `npm run test:e2e:build`.
- Visual confirmation in the running app via windows-mcp.
