# EP-006: Restore secret cleanup — Implementation Plan

> Restore copied a legacy backup verbatim, leaving plaintext provider secrets in
> the active SQLite file. Run the existing vault migration at restore time and
> guard it so it can't regress.

**Spec:** `docs/superpowers/specs/2026-06-13-ep006-restore-secret-cleanup-design.md`
**Verification:** `cargo test` + full `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify the gap against code: `restore_user_sqlite` (`lib.rs:1972`) had no
  secret migration; cleanup existed only on the startup path (`lib.rs:1007-1011`).
- [x] RED: unit test `restore_migrates_legacy_provider_secret_rows_out_of_active_db`
  asserting the restored DB has no secret rows **and** the key reached the vault;
  watched it fail (function missing).
- [x] GREEN: add `migrate_restored_provider_secrets` (vault-first, then
  `delete_secret_settings`); call it in `restore_user_sqlite` after the restored
  DB opens, rolling back to the safety backup (fail closed) if it errors.
- [x] Verify: `cargo test` 94/94; `cargo clippy --no-deps -- -D warnings` clean
  (the two remaining warnings are pre-existing in `db.rs`/`user_db.rs`);
  `npm run check` green; `npm run test:e2e:build`.

## Notes

- Vault-before-delete preserves the user's keys on a legacy restore; delete-only
  would silently lose them.
- Fail-closed reuses `restore_safety_backup`, so a vault failure never installs an
  unsecured DB.
- Future dedup: `get_app_settings` still has an inline copy of the same migration;
  left untouched to keep this packet to one concern.
