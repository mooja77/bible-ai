# EP-006: Restore secret cleanup — Design

- **Date:** 2026-06-13
- **Status:** Implemented
- **Gate:** Data trust (Gate 2)
- **Source:** `docs/development-implementation-plan.md` EP-006, verified against code
  before implementing.

## Background

Provider secrets (API keys, managed-gateway token) live in the OS credential
vault, not the user database. Older app versions stored them as plaintext rows
in `app_settings`. On normal startup, `get_app_settings` (`lib.rs`) detects those
legacy rows, copies them into the vault, then calls `delete_secret_settings` to
remove them from the DB.

**The gap:** `restore_user_sqlite` is a raw file copy + reopen. It ran
`validate_user_sqlite_source` and installed the restored DB as active, but it did
**not** run the legacy-secret migration. Restoring a *legacy* backup (one made
before the vault migration) therefore left plaintext provider secrets at rest in
the active SQLite file — cleaned only opportunistically on the next settings read,
or never, if the user did not open Settings.

This was verified true in code review: `restore_user_sqlite` (`lib.rs:1972`) had
no call to `delete_secret_settings`, while the cleanup machinery already existed
(`user_db::delete_secret_settings`, `delete_secret_settings:693`) and was wired
only into the startup path (`lib.rs:1007-1011`).

## Change

Add one helper that mirrors the startup migration exactly, and call it from
restore before the restored connection becomes active:

```rust
fn migrate_restored_provider_secrets(conn: &rusqlite::Connection) -> Result<(), String> {
    let settings = user_db::get_app_settings(conn)?;
    if has_legacy_provider_key_rows(&settings) {
        let legacy_settings = provider_settings_for_legacy_migration(&settings);
        credentials::save_provider_keys(&legacy_settings)?; // vault first — never lose keys
        user_db::delete_secret_settings(conn)?;             // then remove plaintext rows
    }
    Ok(())
}
```

Order matters: migrate into the vault **before** deleting the rows, so a user
restoring a legacy backup keeps their keys (they move to the vault) instead of
losing them.

**Failure handling — fail closed.** If securing the secrets fails (e.g. the vault
is unavailable), restore does not install the unsecured DB; it rolls back to the
safety backup via the existing `restore_safety_backup` path and returns a clear
error. A valid restore on a working vault is unaffected.

**Non-legacy restore is a no-op.** A current backup has no secret rows, so
`has_legacy_provider_key_rows` is false and the helper only performs one extra
settings read — existing restore behavior (and the `backup-restore.spec.ts` e2e
flow) is unchanged.

## Scope

- Added `migrate_restored_provider_secrets` and one call site in
  `restore_user_sqlite`. No schema, command-surface, or frontend changes.
- Left the `get_app_settings` inline migration copy as-is to keep the packet
  minimal; the two share intent and are a future dedup candidate.

## Testing

- New Rust unit test `restore_migrates_legacy_provider_secret_rows_out_of_active_db`
  (`lib.rs`, `sqlite_restore_tests`): seeds a DB with a plaintext
  `anthropic_api_key` row, runs the helper, and asserts (a) the row is gone from
  the active DB and (b) the key was migrated into the vault, not destroyed. The
  test isolates `BIBLE_AI_CREDENTIAL_SERVICE` to a unique value and deletes the
  entry on cleanup, so the real "Bible AI" vault is never touched.
- `cargo test` 94/94; full `npm run check` green (vite build, fmt/check/clippy
  `-D warnings`, 66/66 sidecar tests); full `npm run test:e2e:build`.
