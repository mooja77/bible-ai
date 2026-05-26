# Study Organization — Tag Backup/Export Integration — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `study-tags-backup`)
- **Theme:** E — Study organization, sub-project 4 (closes E)
- **Owner:** John Moore

## Problem

E1–E3 shipped tags (`tags` + polymorphic `item_tags`) for bookmarks + verse notes, but the tables
were deliberately **left out of `USER_TABLES`**, so tags/links are **not included in JSON
backups** — they don't round-trip through export/import. This sub-project closes that documented gap.

The import (`import_user_data_inner`) is non-trivial: it id-remaps foreign keys for the **"duplicate"**
strategy via `prepare_duplicate_row` (per-table maps), and `import_insert_sql` uses
`INSERT OR IGNORE` (duplicate) / `… ON CONFLICT(pk) DO UPDATE` (replace_existing). Two natural-key
uniqueness constraints make a naive add insufficient:

- `tags.name` is `UNIQUE COLLATE NOCASE` → importing a tag whose name already exists is *ignored*,
  and the imported `tags.id` → local id mapping would be **lost**, orphaning its `item_tags`.
- `bookmarks` has `UNIQUE(verse_id, end_verse_id)` → same problem for the bookmark referenced by an
  `item_tags` row.
- `item_tags.item_id` is **polymorphic** (`bookmark` → a `bookmarks.id` that gets remapped; `note` →
  a `verse_id` that is **stable / not remapped**).

So `tags` and `item_tags` need natural-key **merge** semantics, applied under **both** strategies —
not the generic per-row insert.

## Goals

1. `tags` + `item_tags` are exported in JSON backups and imported back with correct id-remapping, so
   a tagged bookmark / verse note round-trips (the tag re-attaches to the right item).
2. Importing a tag whose name already exists **merges** onto the existing tag (no duplicate tag rows,
   links re-point to it).
3. Works for both "duplicate" and "replace_existing" import strategies.
4. Old backups (pre-v14, no `tags`/`item_tags` keys) import without error (tables simply skipped).

## Non-goals (YAGNI)

- Only the two **currently taggable** item types matter: `bookmark` and `note`. The import handles
  those; `study_item` and `range_note` will need their own id-map wiring **when they become
  taggable** (documented inline + here). The DB `CHECK` already allows them.
- No schema change (tables exist from E1; no version bump needed — they're already created on open).
  `USER_SCHEMA_VERSION` stays 14.
- No new UI. No change to export *file format* beyond the two added table arrays.

## Approach

Add `tags` + `item_tags` to `USER_TABLES` (so export is automatic and import iterates them), then give
each a **dedicated, strategy-independent import path** in `import_user_data_inner` that merges by
natural key and remaps `item_tags`' polymorphic FKs.

## Design (`app/src-tauri/src/user_db.rs`)

### `USER_TABLES`

Append after `"saved_searches"`:
```rust
    "tags",
    "item_tags",
```
Order rationale: `item_tags` references `tags` (FK) and, via `item_id`, `bookmarks` / `study_items`.
All of `tags`, `bookmarks` (already listed), and `study_items` (already listed) are imported before
`item_tags` (last), so their id-maps are populated when `item_tags` is processed. Export uses the same
list; `export_table_rows` dumps all columns of each (for `item_tags`: `tag_id, item_type, item_id,
created_at`).

### `import_user_data_inner` — new id-maps

Alongside the existing maps (`workspace_id_map`, …):
```rust
    let mut tag_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut bookmark_id_map = std::collections::HashMap::<i64, i64>::new();
```

### `bookmarks` — populate `bookmark_id_map` by natural key (both strategies)

After `insert_import_row(...)` for a row, add (independent of the `affected > 0` / strategy guards):
```rust
    if *table == "bookmarks" {
        if let Some(old_id) = old_id {
            if let Some(resolved) = resolve_imported_bookmark_id(conn, &row).map_err(|e| e.to_string())? {
                bookmark_id_map.insert(old_id, resolved);
            }
        }
    }
```
with a helper:
```rust
fn resolve_imported_bookmark_id(
    conn: &Connection,
    row: &serde_json::Map<String, serde_json::Value>,
) -> SqlResult<Option<i64>> {
    let Some(verse_id) = row.get("verse_id").and_then(serde_json::Value::as_i64) else {
        return Ok(None);
    };
    let end_verse_id = row.get("end_verse_id").and_then(serde_json::Value::as_i64);
    conn.query_row(
        "SELECT id FROM bookmarks
         WHERE verse_id = ?1 AND ((?2 IS NULL AND end_verse_id IS NULL) OR end_verse_id = ?2)",
        params![verse_id, end_verse_id],
        |r| r.get(0),
    )
    .optional()
}
```
`old_id` is captured before the `row.clone()` (and before `prepare_duplicate_row` strips `id`), so it
is available. `verse_id`/`end_verse_id` survive in the row (bookmarks has no FK-remap arm). Under
"replace_existing" the resolved id equals the imported id; under "duplicate" it's the new/merged id —
either way the map is correct.

### `tags` — find-or-create-by-name (dedicated branch, both strategies)

In the per-row loop, alongside the existing `app_settings` special-case (before the generic
insert path), add:
```rust
            if *table == "tags" {
                let old_id = row.get("id").and_then(serde_json::Value::as_i64);
                let name = row
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .unwrap_or_default();
                if name.is_empty() {
                    report.skipped += 1;
                    continue;
                }
                let tag = create_tag(conn, name).map_err(|e| e.to_string())?;
                if let Some(old) = old_id {
                    tag_id_map.insert(old, tag.id);
                }
                report.imported += 1;
                continue;
            }
```
`create_tag` is the E1 find-or-create (case-insensitive), so a pre-existing name merges and the
`old_id → local id` mapping is recorded. No generic insert for `tags`.

### `item_tags` — dedicated branch with polymorphic remap + `INSERT OR IGNORE`

After the `tags` branch (item_tags is imported last, so both maps are populated):
```rust
            if *table == "item_tags" {
                let Some(old_tag) = row.get("tag_id").and_then(serde_json::Value::as_i64) else {
                    report.skipped += 1;
                    continue;
                };
                let Some(&new_tag) = tag_id_map.get(&old_tag) else {
                    report.skipped += 1; // tag wasn't imported
                    continue;
                };
                let item_type = row
                    .get("item_type")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let Some(old_item) = row.get("item_id").and_then(serde_json::Value::as_i64) else {
                    report.skipped += 1;
                    continue;
                };
                let new_item = match item_type.as_str() {
                    "bookmark" => match bookmark_id_map.get(&old_item) {
                        Some(&n) => n,
                        None => {
                            report.skipped += 1;
                            continue;
                        }
                    },
                    // notes are keyed by verse_id (stable corpus id — not remapped).
                    "note" => old_item,
                    // range_note / study_item are not yet taggable; when they are, add
                    // their id-maps (study_item_id_map exists; range_note needs a new map).
                    _ => {
                        report.skipped += 1;
                        continue;
                    }
                };
                let affected = conn
                    .execute(
                        "INSERT OR IGNORE INTO item_tags (tag_id, item_type, item_id) VALUES (?, ?, ?)",
                        params![new_tag, item_type, new_item],
                    )
                    .map_err(|e| format!("import item_tags: {e}"))?;
                if affected > 0 {
                    report.imported += 1;
                } else {
                    report.skipped += 1;
                }
                continue;
            }
```
This is strategy-independent (no reliance on `prepare_duplicate_row`, which only runs for
"duplicate"), so links remap correctly under both strategies; `INSERT OR IGNORE` handles the composite
PK + re-imports idempotently.

### Placement notes

- The `tags`/`item_tags` branches go in the per-row loop next to the `app_settings` branch (they
  `continue` past the generic `prepare_duplicate_row`/`normalize_import_row`/`insert_import_row`). The
  `bookmark_id_map` population goes right after `insert_import_row` for `bookmarks` (so it runs for the
  generic bookmark path under both strategies).
- `prepare_duplicate_row` is **not** modified (no `tags`/`item_tags` arm needed — they bypass it).

## Edge cases

- **Old backup (no tags/item_tags arrays):** the table loop's `tables.get(table)` is `None` → skipped;
  no error. (Existing behavior for any absent table.)
- **`item_tags` referencing a tag/bookmark not in the import:** `tag_id_map`/`bookmark_id_map` miss →
  the link is skipped (counted), not an error. (Shouldn't happen in a self-consistent backup.)
- **`note` link whose `verse_id` has no local note:** the link is inserted (item_id=verse_id); if the
  user later writes a note at that verse it's already tagged — acceptable (mirrors E2's "tag the
  verse-note slot"). The note body itself is imported separately via `user_notes`.
- **Duplicate run of the same import:** `create_tag` find-or-create + `INSERT OR IGNORE` → idempotent.
- **`replace_existing`:** tags still merge by name (find-or-create), item_tags `INSERT OR IGNORE`
  (presence only) — consistent, no spurious failures.

## Testing

Add Rust integration tests in the `#[cfg(test)] mod tests` (follow the existing
`duplicate_import_remaps_*` style — construct a JSON payload and call `import_user_data`):

1. **Duplicate-strategy round-trip:** seed a source-shaped JSON with a `bookmarks` row (id 5),
   a `user_notes` row (verse_id 1_001_002), two `tags` (ids 10 "grace", 11), and `item_tags`
   linking tag 10 → bookmark 5 and tag 10 → note (verse_id 1_001_002). Pre-create a local tag named
   "grace" with a different id to exercise **merge-by-name**. Import with `"duplicate"`. Assert:
   - exactly one tag named "grace" exists (merged);
   - `list_tagged_items(local_grace_id)` returns the bookmark (remapped to its new id) and the note
     (verse_id unchanged).
2. **Replace-strategy:** import the same payload with `"replace_existing"`; assert the links resolve
   (tag merged by name; bookmark + note linked).
3. **Export includes the tables:** after tagging a bookmark + note, `export_user_data` JSON contains
   non-empty `tags` and `item_tags` arrays.
4. **Old backup safety:** a payload omitting `tags`/`item_tags` imports without error.

Plus `npm run build` + full `npm run check` (runs the new cargo tests; remember `cargo fmt`) +
`npm run test:e2e:build` (the existing `backup-restore` + key-redaction e2e must still pass —
regression that the added tables didn't break export/import). No new e2e (the remap correctness lives
in the Rust tests; an e2e backup-restore-with-tags adds little over them).

## Risks & mitigations

- **Breaking existing backup/restore** → only additive: two new `USER_TABLES` entries + two dedicated
  import branches + one bookmark-map population step; `prepare_duplicate_row` and all other tables
  untouched. The existing backup/restore + key-redaction e2e are the regression guard.
- **Orphaned `item_tags` from lost id mappings** → solved by natural-key merge for `tags` (by name)
  and `bookmarks` (by `verse_id,end_verse_id`), populating the maps even on conflict-ignore.
- **Future taggable types** (`study_item`/`range_note`) silently skipped today → the `_ =>` arm skips
  them with a comment; revisit when they become taggable (study_item_id_map exists; range_note needs a
  new map).
- **`item_tags` import order** → `item_tags` is last in `USER_TABLES`; `tags`, `bookmarks`,
  `study_items` precede it, so the maps are ready.

## Rollout

Single feature branch `study-tags-backup`. Files:
- **Modify:** `app/src-tauri/src/user_db.rs` (`USER_TABLES` entries; `tag_id_map` + `bookmark_id_map`;
  `tags` + `item_tags` import branches; `resolve_imported_bookmark_id` helper + bookmark-map step;
  integration tests).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`. Closes Theme E.
