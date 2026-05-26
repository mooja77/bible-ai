# Study Organization E1 — Tag Foundation + Tag Bookmarks — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `study-tags-bookmarks`)
- **Theme:** E — Study organization, sub-project 1 (foundation)
- **Owner:** John Moore

## Problem

There is no way to organize study artifacts by theme. Bookmarks, notes, and study items are flat
lists. Theme E adds a **tag system**; E1 builds the foundation and wires it end-to-end for
**bookmarks** (the cleanest first entity: stable `id`, an existing sidebar list, and an existing
e2e that creates one). Later sub-projects (E2/E3) extend tagging to notes/study-items and add a
cross-cutting browse view.

## Goals

1. A reusable, normalized tag system in `user.sqlite` (shared tag vocabulary, case-insensitive
   unique names) that future entities can adopt without schema rework.
2. Create tags, attach/detach them to bookmarks, and see a bookmark's tags as chips — from the
   sidebar Bookmarks list.
3. Filter the sidebar Bookmarks list by a selected tag.

## Non-goals (YAGNI)

- No tagging of notes/study-items yet (E2) — but the join table's `CHECK` already permits those
  `item_type`s so E2 needs no table recreate.
- No tag colors, descriptions, or rename UI in E1 (rename/colors can come later). Tag deletion is
  supported (needed to undo mistakes); a dedicated tag-manager view is E3.
- No cross-entity "browse by tag" view yet (E3) — E1's filter is scoped to the bookmark list.
- **No backup/export–import integration in E1 (deliberately deferred to its own sub-project).**
  `import_user_data_inner` does per-table id-remapping for the "duplicate" strategy; including
  `item_tags` correctly needs new `tags`/`bookmarks` id-maps and remapping of `item_tags.tag_id`
  **and** its polymorphic `item_id` (conditional on `item_type`) — a meaningful, test-heavy change
  that shouldn't ride along in the foundation. So `tags`/`item_tags` are **not** added to
  `USER_TABLES` yet. Consequence (documented limitation): E1 tags/links are stored locally but are
  not yet included in JSON backups (and a "replace"-strategy import leaves them untouched, so no data
  loss either way). A follow-up "E — tag backup/export" sub-project adds them to `USER_TABLES` with
  the remapping + tests.
- No change to corpus DB, sidecar, or Council.

## Data model (`user.sqlite`, bump `USER_SCHEMA_VERSION` 13 → 14)

Add to the `USER_SCHEMA` batch (idempotent `CREATE TABLE IF NOT EXISTS`):

```sql
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_tags (
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('bookmark', 'note', 'range_note', 'study_item')),
  item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tag_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_type, item_id);
```

- `name … UNIQUE COLLATE NOCASE` → one tag per name, case-insensitive (so "Grace" == "grace").
- `item_tags` is polymorphic; E1 only writes `item_type='bookmark'`, but the `CHECK` already allows
  the E2 types (SQLite can't easily widen a `CHECK` later without recreating the table).
- `ON DELETE CASCADE` on `tag_id` cleans links when a tag is deleted. The `item_id` side is
  polymorphic (no FK), so **`delete_bookmark` must also delete its `item_tags` rows** (see below).

**`USER_TABLES`** is intentionally **not** modified in E1 (backup/export deferred — see Non-goals).
The new tables are created via the idempotent `USER_SCHEMA` batch on open regardless; the version
bump records the schema change.

## Backend (`src-tauri/src/user_db.rs` + `lib.rs`)

### `user_db.rs` structs + fns

```rust
#[derive(Serialize, Clone)]
pub struct Tag { pub id: i64, pub name: String, pub created_at: String }

#[derive(Serialize, Clone)]
pub struct ItemTag { pub item_id: i64, pub tag_id: i64, pub name: String }
```

- `create_tag(conn, name: &str) -> SqlResult<Tag>` — trim; find-or-create: `INSERT INTO tags(name)
  VALUES(?) ON CONFLICT(name) DO NOTHING`, then `SELECT id, name, created_at FROM tags WHERE name = ?`
  (the column's `COLLATE NOCASE` makes the lookup case-insensitive). Returns the existing or new row.
  (Empty/whitespace name → return an `Err` so the command surfaces it.)
- `list_tags(conn) -> SqlResult<Vec<Tag>>` — `ORDER BY name COLLATE NOCASE`.
- `delete_tag(conn, id) -> SqlResult<usize>` — `DELETE FROM tags WHERE id = ?` (CASCADE drops links).
- `tag_item(conn, tag_id, item_type: &str, item_id) -> SqlResult<usize>` — `INSERT INTO item_tags
  (tag_id, item_type, item_id) VALUES (?,?,?) ON CONFLICT DO NOTHING`.
- `untag_item(conn, tag_id, item_type: &str, item_id) -> SqlResult<usize>` — `DELETE FROM item_tags
  WHERE tag_id=? AND item_type=? AND item_id=?`.
- `list_item_tags(conn, item_type: &str) -> SqlResult<Vec<ItemTag>>` — join `item_tags`→`tags` for a
  type: `SELECT it.item_id, t.id, t.name FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE
  it.item_type = ? ORDER BY it.item_id, t.name COLLATE NOCASE`. The frontend groups by `item_id`.
- **Modify `delete_bookmark`** to first `DELETE FROM item_tags WHERE item_type = 'bookmark' AND
  item_id = ?` (clean up the polymorphic links), then delete the bookmark.

### `lib.rs` commands (each `with_user_db`, register in `invoke_handler`)

`list_tags()`, `create_tag(name)`, `delete_tag(id)`, `tag_item(tag_id, item_type, item_id)`,
`untag_item(tag_id, item_type, item_id)`, `list_item_tags(item_type)`. The three commands taking
`item_type` validate it against `["bookmark","note","range_note","study_item"]` (return `Err` on an
unknown type) — defense in depth matching the DB `CHECK`.

## Frontend

### `bible.ts`

```ts
export interface Tag { id: number; name: string; created_at: string }
export interface ItemTag { item_id: number; tag_id: number; name: string }

export const listTags = () => invoke<Tag[]>("list_tags");
export const createTag = (name: string) => invoke<Tag>("create_tag", { name });
export const deleteTag = (id: number) => invoke<number>("delete_tag", { id });
export const tagItem = (tagId: number, itemType: string, itemId: number) =>
  invoke<number>("tag_item", { tagId, itemType, itemId });
export const untagItem = (tagId: number, itemType: string, itemId: number) =>
  invoke<number>("untag_item", { tagId, itemType, itemId });
export const listItemTags = (itemType: string) =>
  invoke<ItemTag[]>("list_item_tags", { itemType });
```

(Tauri maps `snake_case` command args to JS `camelCase`, matching the existing wrappers.)

### New module `app/src/features/tags/TagControls.tsx`

To avoid growing the `App.tsx` god-component, the tag UI lives here:
- `BookmarkTagRow({ bookmarkId, tags, allTags, onAttach, onDetach })` — renders the bookmark's tag
  chips (each with a ✕ that calls `onDetach(tagId)`) plus a compact "＋ tag" control: a text input
  backed by a `<datalist>` of `allTags` names; on submit (Enter) calls `onAttach(name)`.
- `TagFilterBar({ allTags, selectedTagId, onSelect })` — a chip row; clicking a tag toggles the
  filter (`onSelect(id | null)`); a "Clear" affordance when active.

### `App.tsx` wiring

- State: `tags: Tag[]`, `bookmarkTags: ItemTag[]`, `bookmarkTagFilter: number | null`.
- In `refreshNavigationLists` (the `Promise.all` at ~line 332), also call `listTags()` and
  `listItemTags("bookmark")`; set `tags` and `bookmarkTags`.
- Pass `tags`, `bookmarkTags`, the filter state, and handlers into `NavigationShortcuts`.
- Handlers:
  - `onAttachBookmarkTag(bookmarkId, name)` → `const t = await createTag(name); await tagItem(t.id,
    "bookmark", bookmarkId); refreshNavigationLists();`
  - `onDetachBookmarkTag(bookmarkId, tagId)` → `await untagItem(tagId, "bookmark", bookmarkId);
    refreshNavigationLists();`
- In `NavigationShortcuts`'s Bookmarks section: render `<TagFilterBar>` above the list; filter
  `bookmarks` to those whose `bookmarkTags` include `bookmarkTagFilter` (when set) **before** the
  existing `.slice(0, 8)`; under each bookmark render `<BookmarkTagRow>` with that bookmark's tags
  (grouped from `bookmarkTags` by `item_id`).

## Data flow

```
open user.sqlite → schema v14 ensures tags/item_tags exist
refreshNavigationLists → listBookmarks + listTags + listItemTags("bookmark")
add tag: type name → createTag(name) (find-or-create) → tagItem(tag.id,"bookmark",id) → refresh
remove tag: ✕ → untagItem(tagId,"bookmark",id) → refresh
filter: click tag chip → bookmarkTagFilter=id → list shows only bookmarks linked to it
delete bookmark (existing) → delete_bookmark also clears its item_tags rows
```

## Edge cases

- **Duplicate tag name (any case):** `create_tag` find-or-create returns the existing tag; no error,
  no dupes.
- **Re-attaching an existing link:** `tag_item` `ON CONFLICT DO NOTHING` (idempotent).
- **Deleting a tag that's filtered/attached:** CASCADE removes links; the next refresh drops it from
  chips and the filter bar; if it was the active filter, the filter shows no matches (handle by
  clearing the filter if the selected tag no longer exists).
- **Bookmark deleted while tagged:** `delete_bookmark` clears its links (no orphan `item_tags`).
- **Empty/whitespace tag name:** `create_tag` returns `Err`; the UI ignores empty submits.

## Testing

- **Rust unit tests** (`user_db.rs` test module, alongside the existing bookmark tests): create_tag
  find-or-create (same name twice / different case → one row); list_tags ordering; tag_item
  idempotency; untag_item; list_item_tags grouping; delete_tag cascades links; delete_bookmark
  clears its item_tags.
- **E2E** (extend the existing `reader-interactions.spec.ts` *"bookmarks a verse and shows it in
  shortcuts"* test, or a new test reusing its bookmark-creation steps): after the bookmark appears
  in the sidebar, type a tag in its `＋ tag` input, submit, assert the tag chip renders on that
  bookmark; click the tag in the filter bar, assert the bookmark list still shows it; (optionally)
  detach via ✕ and assert the chip disappears. Use stable `data-testid`s on the tag input, chips,
  and filter chips.
- **`npm run build`** + full **`npm run check`** (includes the new cargo tests) + **`npm run
  test:e2e:build`** green before merge.

## Risks & mitigations

- **Schema migration on existing user DBs** → `CREATE TABLE IF NOT EXISTS` is additive and safe; the
  `user_version` bump to 14 is recorded; no existing data touched. Export/import is untouched (the
  new tables are absent from `USER_TABLES`), so the existing backup/restore + key-redaction e2e tests
  are unaffected.
- **Polymorphic `item_id` has no FK** → handled by explicit cleanup in `delete_bookmark` (and E2
  will do the same for notes/study-items).
- **Sidebar density** (w-80) → chips are small/wrapping; the `＋ tag` control is compact; acceptable
  for E1. A roomier tag-manager view is E3.
- **`App.tsx` growth** → tag UI extracted to `features/tags/TagControls.tsx`; `App.tsx` only gains
  state + handlers + prop threading.

## Rollout

Single feature branch `study-tags-bookmarks`. Files:
- **Modify:** `app/src-tauri/src/user_db.rs` (schema + `USER_SCHEMA_VERSION` bump, structs, fns,
  tests, `delete_bookmark` cleanup; **not** `USER_TABLES`), `app/src-tauri/src/lib.rs` (6 commands +
  registration),
  `app/src/lib/bible.ts` (types + wrappers), `app/src/App.tsx` (state + load + handlers + threading).
- **New:** `app/src/features/tags/TagControls.tsx`.
- **Modify:** `app/tests/e2e/reader-interactions.spec.ts` (tag e2e).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`. First of the E theme.
