# EP-013: Import budgets — Implementation Plan

> JSON import started a transaction before any size check, so an oversized backup
> could lock the DB and grind a huge transaction before failing. Budget it first.
> Resource quarantine half deferred (needs EP-003).

**Spec:** `docs/superpowers/specs/2026-06-13-ep013-import-budgets-design.md`
**Verification:** `cargo test` + `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify: `import_user_data` (user_db.rs) ran `validate_import_payload` then
  `BEGIN IMMEDIATE` with no size budget between them.
- [x] RED: two tests (oversized text field; over-budget per-table row count);
  confirmed failing (constants/helper missing).
- [x] GREEN: add `MAX_IMPORT_ROWS_PER_TABLE` (50k), `MAX_IMPORT_ROWS_TOTAL`
  (200k), `MAX_IMPORT_TEXT_FIELD_CHARS` (2M); `validate_import_budgets(tables)`
  called before `BEGIN IMMEDIATE`.
- [x] Verify: `cargo test` 103/103; fmt + clippy `-D warnings` clean; `npm run
  check` green; `npm run test:e2e:build` (no regression -- e2e payloads are tiny).

## Notes

- Budgets are generous so legit personal backups never trip them; they only bound
  the abusive/corrupt case. Existing import tests unaffected.
- DEFERRED: resource-entry quarantine (reject unreviewed `resource_entries` from
  backup JSON) needs EP-003 source decision classes; do after EP-003.
- Last in the `user_db.rs` import-path cluster (after EP-014).
