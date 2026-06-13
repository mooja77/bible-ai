# EP-013: Import budgets — Design

- **Date:** 2026-06-13
- **Status:** Implemented (budgets scope); resource quarantine deferred (see Scope).
- **Gate:** Data trust / content trust (Gate 2)
- **Source:** `docs/development-implementation-plan.md` EP-013; ground-truthed in
  `docs/reviews/2026-06-13-ep-roadmap-ground-truth.md`.

## Background

`import_user_data` (`user_db.rs`) ran `validate_import_payload` (export/schema
version + tables-is-object) and then immediately `BEGIN IMMEDIATE`, processing
the whole payload inside the transaction. There was **no size budget**: an
oversized or malformed backup (millions of rows, or a multi-megabyte text field)
would lock the DB and grind through a huge transaction before failing. The
roadmap confirmed `BEGIN IMMEDIATE` runs before any size check.

## Change

Add `validate_import_budgets(tables)`, called after `validate_import_payload` and
**before** `BEGIN IMMEDIATE`. It rejects, with a clear message and no
transaction:

- a table with more than `MAX_IMPORT_ROWS_PER_TABLE` (50,000) rows,
- more than `MAX_IMPORT_ROWS_TOTAL` (200,000) rows across all tables,
- any string field longer than `MAX_IMPORT_TEXT_FIELD_CHARS` (2,000,000) chars.

Budgets are deliberately generous -- a personal study corpus is far smaller --
so they only bound the pathological/abusive case, not real backups. The existing
import tests (small payloads) are unaffected.

## Scope

- This packet covers the **size budgets** half of EP-013. The **resource
  quarantine** half (rejecting `resource_entries` from backup JSON that lack
  accepted source-review metadata, or quarantining them) is **deferred**: it
  depends on EP-003 (content BOM / source decision classes), which does not exist
  yet. Tracked for after EP-003.

## Testing

- **New** `import_rejects_oversized_text_field_before_transaction`: a single
  note body over the field limit is rejected with a budget error.
- **New** `import_rejects_too_many_rows_in_a_table_before_transaction`: a
  bookmarks table over the per-table limit is rejected, naming the table.
- Both confirmed RED before the helper existed. All existing import tests
  (valid + invalid-transactional) still pass.
- `cargo test` 103/103; full `npm run check` green; `npm run test:e2e:build`.
