# Study Organization E3 — Browse by Tag — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `study-tags-browse`)
- **Theme:** E — Study organization, sub-project 3
- **Owner:** John Moore

## Problem

Tags now label bookmarks (E1) and verse notes (E2), but there's no way to see everything carrying a
given tag — tags are only visible/filterable within each entity's own surface. E3 adds a **"Tags"
view**: pick a tag → see all tagged items (bookmarks + verse notes) with citations → click to jump
to the reader. This turns tags into a real cross-cutting navigation surface.

## Goals

1. A "Tags" mode (sidebar nav button) listing every tag with its item count.
2. Selecting a tag lists its items (bookmarks + verse notes) with a type badge, the Scripture
   citation, and a preview; clicking an item jumps to that verse in the reader.
3. Reuse the existing citation-stitching pattern (no new corpus plumbing concepts).

## Non-goals (YAGNI)

- No tag editing here (rename/colors/delete UI is a separate "tag manager" sub-project; `delete_tag`
  exists but no UI).
- No range-note / study-item items (only the tagged types so far: `bookmark`, `note`). The browse
  query unions exactly those; new types plug in when they become taggable.
- No search/filter *within* the Tags view, no pagination (item counts are small in practice). Revisit
  if a tag accumulates hundreds of items.
- No backup/export change (still deferred).

## Approach

Two new backend queries (tags-with-counts; items-for-tag as a UNION of bookmarks + notes), with the
command layer stitching citations from the corpus exactly like `search_notes`. A new `Mode "tags"` +
nav button renders a `TagBrowser` view.

## Backend (`user_db.rs` + `lib.rs`)

### `user_db.rs`

```rust
#[derive(Serialize, Clone)]
pub struct TagCount { pub id: i64, pub name: String, pub count: i64 }

#[derive(Serialize, Clone)]
pub struct TaggedItemRaw {
    pub item_type: String,
    pub item_id: i64,
    pub verse_id: i64,
    pub text: Option<String>, // bookmark label or note body
}
```

- `list_tags_with_counts(conn) -> SqlResult<Vec<TagCount>>`:
  ```sql
  SELECT t.id, t.name, COUNT(it.tag_id)
  FROM tags t
  LEFT JOIN item_tags it ON it.tag_id = t.id AND it.item_type IN ('bookmark', 'note')
  GROUP BY t.id, t.name
  ORDER BY t.name COLLATE NOCASE
  ```
  (Counts only the browsable types, so the count matches what the view can show. Tags with 0 items
  still appear.)

- `list_tagged_items(conn, tag_id) -> SqlResult<Vec<TaggedItemRaw>>`:
  ```sql
  SELECT 'bookmark' AS item_type, b.id AS item_id, b.verse_id AS verse_id, b.label AS text
  FROM item_tags it JOIN bookmarks b ON b.id = it.item_id
  WHERE it.tag_id = ?1 AND it.item_type = 'bookmark'
  UNION ALL
  SELECT 'note' AS item_type, n.verse_id AS item_id, n.verse_id AS verse_id, n.body AS text
  FROM item_tags it JOIN user_notes n ON n.verse_id = it.item_id
  WHERE it.tag_id = ?1 AND it.item_type = 'note'
  ORDER BY item_type, verse_id
  ```
  (Bind `tag_id` once with `?1`, or twice with `params![tag_id, tag_id]` if numbered params are
  awkward in this codebase — match the existing style.)

### `lib.rs`

```rust
#[derive(serde::Serialize)]
struct TaggedItem {
    item_type: String,
    verse_id: i64,
    citation: String,
    preview: String,
}
```

- `list_tags_with_counts() -> Result<Vec<user_db::TagCount>, String>` (just `with_user_db`).
- `list_tagged_items(tag_id: i64) -> Result<Vec<TaggedItem>, String>`:
  1. `with_user_db` → `user_db::list_tagged_items(conn, tag_id)`.
  2. Collect `verse_id`s; stitch citations from the corpus using the **same pattern as `search_notes`**
     (`open_corpus` → `SELECT v.id, v.book_id, b.name, v.chapter, v.verse FROM verses v JOIN books b …
     WHERE v.id IN (…)` → `refs` map) + `format_note_citation(&name, chapter, verse, None)`.
  3. Build `TaggedItem { item_type, verse_id, citation, preview }` where `preview` = the raw `text`
     trimmed to ~100 chars (bookmark label or note snippet; empty when a bookmark has no label).
     Skip items whose `verse_id` isn't in `refs` (defensive, same as `search_notes`).
- Register both commands in `generate_handler!`.

### Rust unit tests (`user_db.rs`)

- `list_tags_with_counts`: tag a bookmark + a verse note with one tag → count 2; a second tag with no
  items → count 0; ordering by name.
- `list_tagged_items`: returns the tagged bookmark (item_type "bookmark", correct verse_id, label) and
  the tagged note (item_type "note", verse_id, body) for the tag; empty for an unused tag.
  (Citation stitching is lib.rs/corpus and is covered by the e2e.)

## Frontend

### `bible.ts`

```ts
export interface TagCount { id: number; name: string; count: number }
export interface TaggedItem { item_type: string; verse_id: number; citation: string; preview: string }

export const listTagsWithCounts = () => invoke<TagCount[]>("list_tags_with_counts");
export const listTaggedItems = (tagId: number) =>
  invoke<TaggedItem[]>("list_tagged_items", { tagId });
```

### `App.tsx`

- Extend `type Mode` with `"tags"`.
- Add a `<ModeButton active={mode === "tags"} onClick={() => selectMode("tags")} label="Tags" />` to
  the sidebar `<nav>` (after Workspaces).
- In the main-content ternary, add a branch (e.g. before `mode === "council"`):
  ```tsx
  ) : mode === "tags" ? (
    <TagBrowser onJumpToVerse={(verseId) => jumpToVerse(verseId, activeTranslations[0] ?? "KJV")} />
  ) : …
  ```
- Import `TagBrowser` from `./features/tags/TagBrowser`.

### New `app/src/features/tags/TagBrowser.tsx`

```tsx
function TagBrowser({ onJumpToVerse }: { onJumpToVerse: (verseId: number) => void }) { … }
```

- On mount: `listTagsWithCounts()` → `tagCounts`. (The component mounts fresh each time the Tags mode
  opens — the mode ternary unmounts it on leave — so data is current.)
- A tag list (left/top): a button per tag showing `name` + a count badge; clicking sets
  `selectedTagId` and loads `listTaggedItems(id)` → `items`.
- An items panel (right/below): for each `TaggedItem`, a clickable `soft-card` row with a type badge
  (`bookmark` amber / `note` emerald, matching existing badge styles), the `citation`, and the
  `preview` (muted, truncated); click → `onJumpToVerse(item.verse_id)`.
- Empty states: no tags yet ("Tag bookmarks or notes to organize them here."); no tag selected
  ("Select a tag."); selected tag has no items ("No items with this tag.").
- `data-testid`s: `tag-browser`, `tag-browser-tag` (per tag button), `tag-browser-item` (per item).
- Layout: `max-w-4xl mx-auto px-6 py-6` header "Tags" + the two regions, reusing `soft-card`/muted
  styling. Responsive single-column is fine (sidebar already carries nav).

## Data flow

```
nav "Tags" → selectMode("tags") → TagBrowser mounts → listTagsWithCounts()
click a tag → listTaggedItems(tagId) → backend unions bookmarks+notes, stitches citations
click an item → onJumpToVerse(verse_id) → jumpToVerse(verse_id, activeTranslations[0] ?? "KJV")
  → selectMode("reader") side-effects via jumpToVerse → reader shows the verse
```

## Edge cases

- **Tag with 0 items** (e.g., all its items were deleted): appears with count 0; selecting it shows
  the empty-items state. Harmless.
- **Bookmark with null label:** `preview` is empty; the citation identifies it.
- **Note body very long:** preview truncated (~100 chars).
- **verse_id missing from corpus** (shouldn't happen): item skipped during stitching (defensive).
- **Same verse tagged as both a bookmark and a note:** two distinct rows (different `item_type`),
  both shown — intended.

## Testing

- **Rust unit tests** as above (counts + UNION items).
- **E2E** — new `app/tests/e2e/tags-browse.spec.ts` (registered in `wdio.conf.mts`): create a
  bookmark and tag it (reuse the E1 bookmark-tag steps), click the **Tags** nav button, find the tag
  (`[data-testid="tag-browser-tag"]` containing the name) and click it, assert a
  `[data-testid="tag-browser-item"]` shows the citation (e.g. "Genesis 1:1"), click the item, and
  assert the reader navigated (a chapter heading appears). Reset to a clean state at the end.
- **`npm run build`** + full **`npm run check`** (incl. new cargo tests) + **`npm run test:e2e:build`**
  green before merge. (Capture the real `npm` exit code, not a piped `tail`'s.)

## Risks & mitigations

- **Cross-DB citation stitching** → reuses the proven `search_notes` pattern verbatim (open_corpus +
  refs map); low risk.
- **New mode integration** → additive nav button + one ternary branch; other modes untouched.
- **`App.tsx` growth** → the view lives in `features/tags/TagBrowser.tsx`; `App.tsx` only gains the
  mode value, a nav button, an import, and one render branch.
- **Stale data after tagging elsewhere** → TagBrowser remounts on each Tags-mode entry, so it reloads
  counts; selecting a tag reloads its items. No manual refresh wiring needed.

## Rollout

Single feature branch `study-tags-browse`. Files:
- **Modify:** `app/src-tauri/src/user_db.rs` (2 structs + 2 fns + tests), `app/src-tauri/src/lib.rs`
  (TaggedItem + 2 commands + registration + citation stitching), `app/src/lib/bible.ts` (types +
  wrappers), `app/src/App.tsx` (Mode + nav button + render branch + import).
- **New:** `app/src/features/tags/TagBrowser.tsx`.
- **New:** `app/tests/e2e/tags-browse.spec.ts` (+ register in `app/wdio.conf.mts`).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
