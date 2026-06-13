# EP-008: Import/restore state refresh — Implementation Plan

> After JSON import / SQLite restore, Settings' Data Sources + modules stayed
> stale until remount. Call refreshModules() in both handlers; guard with e2e.

**Spec:** `docs/superpowers/specs/2026-06-13-ep008-import-restore-refresh-design.md`
**Verification:** `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify the premise (roadmap suspected overstated): `refreshModules()`
  reloads modules + topics + `resourceSources`, but `importBackupJson` and
  `restoreSqliteBackup` only fired `onUserDataChanged?.()` — real stale-state gap.
- [x] RED: new e2e asserts Data Sources refreshes IN PLACE (no navigation) after
  an import; confirmed failing on the pre-fix build.
- [x] GREEN: add `await refreshModules()` to both handlers before
  `onUserDataChanged?.()` (mirrors the three module handlers).
- [x] Verify: `npm run check` green; full `npm run test:e2e:build`.

## Notes

- The older `imports resource JSON` e2e masked the bug by navigating away and
  back (a remount); the new test pins the no-remount requirement.
- Isolated to `SettingsPanel.tsx` — no overlap with the `lib.rs`/`user_db.rs`
  serialization chains; safe as a Wave-0 code slot per the ground-truth roadmap.
