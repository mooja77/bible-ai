# EP-007: Restore identity validation — Implementation Plan

> Restore accepted a minimal/wrong SQLite file (only `app_settings`) as a valid
> user DB. Require a body of recognized user tables, and guard it with tests.

**Spec:** `docs/superpowers/specs/2026-06-13-ep007-restore-identity-validation-design.md`
**Verification:** `cargo test` + full `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify the gap: `validate_user_sqlite_source` (`lib.rs`) checked only
  `app_settings` presence + `user_version`; the existing `accepts` test encoded
  the weakness by building an `app_settings`-only DB and asserting acceptance.
- [x] RED: new test asserting an `app_settings`-only DB is rejected; watched it
  fail (`Ok(())` returned).
- [x] GREEN: make `USER_TABLES` `pub`; enumerate source tables and require
  `>= MIN_RECOGNIZED_USER_TABLES` (4) recognized tables; update the `accepts`
  test to build a real backup via `user_db::open`.
- [x] Verify: `cargo test` 95/95; `cargo fmt` (auto-collapsed the query chain);
  `cargo clippy --no-deps -- -D warnings` clean; `npm run check` green;
  `npm run test:e2e:build`.

## Notes

- Threshold 4 chosen to reject minimal/wrong DBs while tolerating **older
  backups** that predate newer tables — validation runs on the raw file before
  migrations, so it must not assume the latest schema.
- Reused `user_db::USER_TABLES` (made public) rather than duplicating table names
  in the validator.
- First packet in the `lib.rs` serialization chain (EP-007 → 010 → 019 → 020) per
  the ground-truth roadmap; sequenced accordingly.
