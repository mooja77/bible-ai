# Study Organization E2 — Tag Verse Notes — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `study-tags-notes`)
- **Theme:** E — Study organization, sub-project 2
- **Owner:** John Moore

## Problem

E1 shipped the tag foundation + bookmark tagging. The biggest study artifact — **verse notes** — is
still untaggable, and there's no way to find notes by theme. E2 extends tagging to verse notes (in
the `NoteTab` editor) and makes tagged notes findable via a tag filter on the existing note search.
The tag backend already supports `item_type='note'`, so this is **frontend-only**.

## Goals

1. Tag/untag the current verse's note from the Note tab; see its tag chips there.
2. In the note-search view ("My notes"), filter results by tag and show each note's tags.
3. Reuse the E1 tag components (DRY) without breaking the E1 bookmark e2e.

## Non-goals (YAGNI)

- **Range notes are out of scope.** `NoteHit` (note search) carries `verse_id` for `kind:"verse"`
  but not the `user_range_notes.id` for `kind:"range"`, so range notes can't be tag-filtered without
  surfacing that id. E2 tags only verse notes (`item_type='note'`, `item_id=verse_id`); range-note
  tagging is a later slice.
- No backend/Rust change (item_type `'note'` already validated + supported; `delete_note` need not
  clear `item_tags` — see Edge cases).
- No tag manager / rename / colors (separate sub-project). No backup/export (still deferred).
- No browse-by-tag view (E3).

## Approach

Generalize the E1 `BookmarkTagRow` into a presentational `ItemTagRow` (parameterized by a
`testIdPrefix`), self-fetch the note's tags inside `NoteTab`, and add a tag filter to
`NoteSearchResults` derived from the notes' own tags.

## Design

### `app/src/features/tags/TagControls.tsx` — generalize the row

Rename `BookmarkTagRow` → `ItemTagRow`, presentational and item-agnostic:

```tsx
export function ItemTagRow({
  testIdPrefix,
  tags,
  allTags,
  onAttach,
  onDetach,
}: {
  testIdPrefix: string;            // e.g. "bookmark" | "note" — also namespaces data-testids + datalist id
  tags: ItemTag[];                  // this item's current tags
  allTags: Tag[];                   // vocabulary for the datalist
  onAttach: (name: string) => void; // parent binds the item identity
  onDetach: (tagId: number) => void;
}) { /* same markup as BookmarkTagRow, with: */ }
```

- `data-testid`s become `${testIdPrefix}-add-tag`, `${testIdPrefix}-tag-input`, `${testIdPrefix}-tag-chip`;
  datalist id `tag-options-${testIdPrefix}`. The remove-button stays `aria-label={`Remove tag ${t.name}`}`.
- `onAttach`/`onDetach` drop the `bookmarkId` arg (the parent's closure supplies the item).
- `TagFilterBar` is unchanged.

### `App.tsx` — bookmark call site (behavior-preserving)

Replace `<BookmarkTagRow bookmarkId={b.id} … onAttach={onAttachBookmarkTag} onDetach={onDetachBookmarkTag} />`
with:

```tsx
<ItemTagRow
  testIdPrefix="bookmark"
  tags={bookmarkTags.filter((it) => it.item_id === b.id)}
  allTags={tags}
  onAttach={(name) => onAttachBookmarkTag(b.id, name)}
  onDetach={(tagId) => onDetachBookmarkTag(b.id, tagId)}
/>
```

`testIdPrefix="bookmark"` keeps the E1 bookmark e2e's `data-testid`s (`bookmark-add-tag`, etc.) intact.

### `NoteTab` (in `VersePanel.tsx`) — tag the verse note

`NoteTab` already self-fetches its note via `getNote(verseId)`. Add parallel tag state + fetch:

- State: `allTags: Tag[]`, `noteTags: ItemTag[]`.
- On `verseId` change (in/with the existing note-load effect), fetch `listTags()` and
  `listItemTags("note")`; set `allTags`, and `noteTags` filtered to `it.item_id === verseId`.
- A `reloadTags()` helper re-runs those fetches.
- Render `<ItemTagRow testIdPrefix="note" tags={noteTags} allTags={allTags} onAttach={attachNoteTag}
  onDetach={detachNoteTag} />` near the note editor.
- `attachNoteTag(name)` → `const t = await createTag(name); await tagItem(t.id, "note", verseId);
  await reloadTags();`
- `detachNoteTag(tagId)` → `await untagItem(tagId, "note", verseId); await reloadTags();`

`NoteTab` imports `createTag, tagItem, untagItem, listTags, listItemTags, type Tag, type ItemTag`
from `../../lib/bible` and `ItemTagRow` from `../tags/TagControls`.

### Note search — filter by tag (`App.tsx` + `NoteSearchResults`)

- **`App.tsx`:** add `noteTags: ItemTag[]` and `noteTagFilter: number | null` state. In the
  note-search effect (where `searchNotes(trimmed, 100)` runs, ~line 526), also fetch
  `listItemTags("note")` and `setNoteTags(...)`. Reset `noteTagFilter` to `null` when the query
  clears. Pass `noteTags`, `noteTagFilter`, `setNoteTagFilter` to `<NoteSearchResults>`.
- **`NoteSearchResults`:** new props `noteTags: ItemTag[]`, `selectedTagId: number | null`,
  `onSelectTag: (id: number | null) => void`.
  - Derive the filter vocabulary from the notes' own tags: distinct `{ id: tag_id, name }` present in
    `noteTags` (so the bar shows only tags that actually label a note — no staleness, only relevant
    tags). Build minimal `Tag[]` for `TagFilterBar` (`created_at: ""`, unused by the bar).
  - Render `<TagFilterBar allTags={filterTags} selectedTagId={selectedTagId} onSelect={onSelectTag} />`
    under the header.
  - Filter the rendered hits: a `kind:"verse"` hit passes when `selectedTagId === null` OR
    `noteTags.some(it => it.item_id === hit.verse_id && it.tag_id === selectedTagId)`. (`kind:"range"`
    hits have no note-tags, so an active filter naturally excludes them.)
  - Show read-only tag chips on each verse-note hit (the tags from `noteTags` for that `verse_id`) —
    small muted chips, no remove button (tagging happens in the Note tab).

## Data flow

```
NoteTab open (verseId) → getNote + listTags + listItemTags("note")→filter to verseId
  attach: createTag(name) → tagItem(tag.id,"note",verseId) → reloadTags → chip appears
Note search active → searchNotes(query) + listItemTags("note")
  TagFilterBar (from notes' tags) → select tag → hits filtered to verse notes with it; chips shown
```

## Edge cases

- **Tagging a verse with no saved note yet:** allowed — the tag is on the `verse_id` slot. If the
  user never writes a note body, the tag exists but the note won't appear in keyword note search
  (which matches bodies). Harmless; acceptable for E2 (the chip is visible in the Note tab).
- **`delete_note` (empty body) leaves `item_tags` rows:** intentionally **not** cleaned up — the
  user may clear a note body but keep its tags (re-typing restores the note at the same `verse_id`).
  Orphan-ish but low-cost and arguably desirable; a later cleanup pass can revisit. (Documented.)
- **New tag created in NoteTab not instantly in the sidebar bookmark filter bar:** the sidebar's
  `tags` refreshes on the next `refreshNavigationLists`; minor, acceptable.
- **Note-search filter when no notes are tagged:** `TagFilterBar` returns `null` (empty `allTags`),
  so the bar simply doesn't render.

## Testing

Extend `app/tests/e2e/notes-search.spec.ts` (the existing test creates a verse note with a
distinctive word, saves on blur, and finds it in "My notes" search). Before closing the verse panel
(while the Note tab is open), add: click `[data-testid="note-add-tag"]`, type a timestamped tag into
`[data-testid="note-tag-input"]`, press Enter, assert a `[data-testid="note-tag-chip"]` with that
name appears. Then after the note result renders in search, assert the tag filter bar shows the tag,
click it, and assert the note result is still shown (and contains the tag). Reuse the spec's existing
setup/teardown. Plus `npm run build` + full `npm run check` + `npm run test:e2e:build`. (The E1
bookmark e2e must still pass — `testIdPrefix="bookmark"` preserves its selectors.)

## Risks & mitigations

- **Refactor breaks E1 bookmark tagging** → `ItemTagRow` keeps identical markup; `testIdPrefix="bookmark"`
  preserves the data-testids; the bookmark e2e is the regression check.
- **`NoteTab` self-fetch adds round-trips** → two small queries on verse change; negligible and keeps
  the component self-contained (no prop-drilling through ChapterReader/VersePanel).
- **Deep prop chain avoided** → `NoteTab` owns its tag state; only the note-search filter touches
  `App.tsx`.

## Rollout

Single feature branch `study-tags-notes`. Files:
- **Modify:** `app/src/features/tags/TagControls.tsx` (`BookmarkTagRow`→`ItemTagRow`),
  `app/src/App.tsx` (bookmark call site + note-search tag state/props),
  `app/src/features/reader/VersePanel.tsx` (`NoteTab` tagging),
  `app/src/features/search/NoteSearchResults.tsx` (filter bar + chips).
- **Modify:** `app/tests/e2e/notes-search.spec.ts` (tag a note + filter).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
