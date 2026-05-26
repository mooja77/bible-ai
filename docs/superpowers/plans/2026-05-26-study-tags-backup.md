# Tag Backup/Export Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `tags` + `item_tags` round-trip through JSON backup/export-import, with id-remapping correct under both "duplicate" and "replace_existing" strategies.

**Architecture:** Add the two tables to `USER_TABLES` (export becomes automatic; import iterates them), and give `tags` + `item_tags` dedicated, strategy-independent import branches in `import_user_data_inner` that merge by natural key (tag name; bookmark verse) and remap `item_tags`' polymorphic `item_id`. All changes are in `user_db.rs`.

**Tech Stack:** Rust (rusqlite) + Tauri 2.

**Spec:** `docs/superpowers/specs/2026-05-26-study-tags-backup-design.md`

**Verification:** Rust integration tests (`cargo test`, part of `npm run check`) + full `npm run check` + `npm run test:e2e:build` (existing backup-restore + key-redaction e2e as regression). Capture the REAL `npm` exit code (redirect-then-`$?`, not piped `tail`).

---

## Task 1: Wire tags/item_tags into export/import (`user_db.rs`)

READ `import_user_data_inner` first (the id-map declarations ~line 7293; the per-row loop with the `app_settings` special-case ~7319 and `let old_id` ~7332; `insert_import_row` ~7355; the duplicate id-map capture block ~7373; `prepare_duplicate_row` ~7918). Then:

- [ ] **Step 1: `USER_TABLES`.** Append after `"saved_searches",` (the last entry, ~line 42):
```rust
    "tags",
    "item_tags",
```
(Comment optional: `// tags before item_tags; item_tags references tags + bookmarks + study_items, so it is imported last.`)

- [ ] **Step 2: New id-maps.** Next to the existing `let mut workspace_id_map …` block (~7293), add:
```rust
    let mut tag_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut bookmark_id_map = std::collections::HashMap::<i64, i64>::new();
```

- [ ] **Step 3: `tags` + `item_tags` import branches.** In the per-row loop, immediately AFTER the `app_settings` special-case `if` block (the one ending `… continue; } }` ~line 7331) and BEFORE `let old_id = row.get("id")…` (~7332), insert:
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
            if *table == "item_tags" {
                let Some(old_tag) = row.get("tag_id").and_then(serde_json::Value::as_i64) else {
                    report.skipped += 1;
                    continue;
                };
                let Some(&new_tag) = tag_id_map.get(&old_tag) else {
                    report.skipped += 1;
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
                    // range_note / study_item are not yet taggable; when they are, add their
                    // id-maps here (study_item_id_map exists; range_note needs a new map).
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
(Note: these reference `row` as the `&serde_json::Map` from `row_value.as_object()` — they run before the `let mut row = row.clone();` line, matching the `app_settings` branch which also uses the borrowed `row`.)

- [ ] **Step 4: Populate `bookmark_id_map`.** Immediately AFTER the `insert_import_row(...)` call + its `report` accounting (after the `if affected == 0 { … } else … }` block ~7371, and it can sit just before or after the existing `if conflict_strategy == "duplicate" && affected > 0 { … }` capture block), add:
```rust
            if *table == "bookmarks" {
                if let Some(old_id) = old_id {
                    if let Some(resolved) =
                        resolve_imported_bookmark_id(conn, &row).map_err(|e| e.to_string())?
                    {
                        bookmark_id_map.insert(old_id, resolved);
                    }
                }
            }
```
(`old_id` here is the loop's `let old_id` from ~7332; `row` is the cloned `serde_json::Map`. This runs for both strategies, regardless of `affected`.)

- [ ] **Step 5: `resolve_imported_bookmark_id` helper.** Add near the other import helpers (e.g. after `prepare_duplicate_row` or near `row_exists_by_primary_key`):
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
(`.optional()` requires `OptionalExtension`, already imported at the top of the file.)

- [ ] **Step 6: Build/check.** From `app/`: `cargo check --manifest-path ./src-tauri/Cargo.toml` (clean), then `cargo fmt --manifest-path ./src-tauri/Cargo.toml`.

- [ ] **Step 7: Commit** `app/src-tauri/src/user_db.rs`: `git commit -m "feat(tags): tag backup/export with merge-by-key import + polymorphic remap"`

---

## Task 2: Rust integration tests

READ two existing import tests to copy the **exact payload shape** and the `import_user_data(...)` call signature/wrapper (e.g. `duplicate_import_remaps_doctrine_relation_targets` ~line 5594 and `duplicate_import_remaps_workspace_item_theology_link_payload` ~5845). Mirror their structure (top-level wrapper with `user_schema_version` + the per-table arrays, `let conn = test_conn();`, call `import_user_data(&conn, payload, "duplicate")`, then assert via the query fns).

- [ ] **Step 1: Add tests** in `#[cfg(test)] mod tests`:

1. `duplicate_import_remaps_tags_and_item_tags` — pre-create a LOCAL tag named "grace" (different id) via `create_tag`. Build a payload (same wrapper shape as the model tests) whose tables include: a `bookmarks` row (e.g. id 5, verse_id 1_001_001, label "imported bm"), a `user_notes` row (verse_id 1_001_002, body "imported note"), a `tags` row (id 10, name "grace"), and `item_tags` rows linking tag 10 → bookmark 5 (`item_type "bookmark"`, `item_id 5`) and tag 10 → note (`item_type "note"`, `item_id 1_001_002`). Import with `"duplicate"`. Assert:
   - `list_tags(&conn)` contains exactly one "grace" (merged — count of name "grace" == 1);
   - the resolved grace tag id's `list_tagged_items(grace_id)` returns 2 items: a `bookmark` whose `verse_id` is 1_001_001 (id remapped — the imported bookmark exists), and a `note` with `verse_id` 1_001_002.

2. `replace_import_links_tags_and_items` — same payload, fresh `test_conn`, import with `"replace_existing"`; assert `list_tagged_items` for the imported "grace" tag returns the bookmark + note links.

3. `export_includes_tags_and_item_tags` — in a `test_conn`, create a tag, a bookmark, a note, and tag both; call `export_user_data(&conn)` and assert the returned JSON has non-empty `tags` and `item_tags` arrays (navigate the same wrapper shape the export produces — confirm the key path by reading `export_user_data`).

4. `import_without_tags_tables_is_ok` — a payload omitting `tags`/`item_tags` imports with `"duplicate"` without error (no panic / `Ok`).

If the exact wrapper/key path is unclear, READ `export_user_data` + `import_user_data` to confirm it (do not guess), and keep assertions focused on the query fns (`list_tags`, `list_tagged_items`, `list_item_tags`).

- [ ] **Step 2:** `cargo test --manifest-path ./src-tauri/Cargo.toml` (from `app/`) → all pass. `cargo fmt …`.
- [ ] **Step 3: Commit** `app/src-tauri/src/user_db.rs`: `git commit -m "test(tags): backup/export round-trip + merge-by-name + export-includes tests"`

---

## Task 3: Full gate + e2e regression + finish

- [ ] **Step 1: Full check gate.** From `app/`, capture the real exit: `npm run check > /tmp/tagbk.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/tagbk.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E regression.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass (especially `backup-restore.spec.ts` + the key-redaction test, proving the added tables didn't break export/import). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(tags): mark study-tags-backup spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** tags/item_tags in `USER_TABLES` (Task 1 Step 1 — export automatic); `tag_id_map`/`bookmark_id_map` (Step 2); tags find-or-create-by-name branch + item_tags polymorphic-remap branch, strategy-independent (Step 3); bookmark natural-key map population both strategies (Steps 4–5); merge-by-name + round-trip + export-includes + old-backup-safe tests (Task 2); regression via existing backup/key-redaction e2e (Task 3) ✓.
- **Type/name consistency:** `create_tag(conn, name) -> Tag` reused; `resolve_imported_bookmark_id` returns `Option<i64>` via `.optional()`; `params![new_tag, item_type, new_item]`; `report.imported`/`report.skipped` are the existing fields; `item_tags` columns `(tag_id, item_type, item_id)` match the schema; the branches use the borrowed `row` (pre-clone) like `app_settings`, and the bookmark step uses the cloned `row` + loop `old_id`.
- **Placeholder scan:** full code for all Task 1 steps; Task 2 intentionally instructs mirroring the exact payload wrapper from two named existing tests (the honest way to match the real import format) with concrete assertions — not vague.
