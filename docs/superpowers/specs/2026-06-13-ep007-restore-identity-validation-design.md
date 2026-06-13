# EP-007: Restore identity validation — Design

- **Date:** 2026-06-13
- **Status:** Implemented
- **Gate:** Data trust (Gate 2)
- **Source:** `docs/development-implementation-plan.md` EP-007, ground-truthed in
  `docs/reviews/2026-06-13-ep-roadmap-ground-truth.md`.

## Background

`restore_user_sqlite` replaces the active `user.sqlite` with a user-chosen file.
Before doing so it calls `validate_user_sqlite_source` (`lib.rs`). The pre-existing
checks were:

1. `PRAGMA quick_check` integrity.
2. `app_settings` table exists.
3. `user_version <= USER_SCHEMA_VERSION` (reject newer-than-app schemas).

**The gap (verified):** a SQLite file containing *only* an `app_settings` table
with a plausible `user_version` passed all three checks — so a wrong, empty, or
hand-crafted minimal DB could silently become the active user database on restore.
The existing test `validate_user_sqlite_source_accepts_bible_ai_backup` even built
exactly that one-table DB and asserted it was accepted, encoding the weakness.

## Change

Strengthen the identity check: a genuine Bible AI DB has `app_settings` **plus a
body of the recognized user tables**. The validator now enumerates the source's
tables and requires at least `MIN_RECOGNIZED_USER_TABLES` (4) of the canonical
`USER_TABLES` to be present (in addition to `app_settings`).

- `USER_TABLES` (the 26-table canonical list in `user_db.rs`) was made `pub` so
  the validator can reuse the single source of truth instead of duplicating names.
- Threshold of 4 is deliberately well below the full count: it rejects the
  minimal/wrong-DB case decisively (1 table) while staying tolerant of **older
  backups** that predate some of the newer tables (validation runs on the raw
  file *before* migrations, so it must not assume the latest schema). The table
  names are distinctive enough (`user_range_notes`, `council_sessions`,
  `theology_topics`, …) that matching 4 by accident is implausible.

The `quick_check` and `user_version` checks are unchanged.

## Scope

- Tightened `validate_user_sqlite_source`; added `MIN_RECOGNIZED_USER_TABLES`;
  made `USER_TABLES` public. No schema, command-surface, or frontend changes.

## Testing

- **New** `validate_user_sqlite_source_rejects_minimal_app_settings_only_db`:
  builds an `app_settings`-only DB and asserts it is rejected (the EP-007 core).
- **Updated** `validate_user_sqlite_source_accepts_bible_ai_backup`: now builds a
  realistic backup via `user_db::open` (full schema) instead of the minimal DB,
  and asserts it is accepted.
- `validate_user_sqlite_source_rejects_non_user_database` (unrelated schema) still
  passes.
- `cargo test` 95/95; full `npm run check` green; `npm run test:e2e:build`.
