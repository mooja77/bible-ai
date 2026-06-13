# EP-008: Import/restore state refresh — Design

- **Date:** 2026-06-13
- **Status:** Implemented
- **Gate:** Data trust (Gate 2)
- **Source:** `docs/development-implementation-plan.md` EP-008; the roadmap flagged
  the premise as possibly overstated, so it was re-verified against the code.

## Background

The plan claimed import/restore "does not refresh Settings module/source state —
requires a remount." The roadmap noted `onUserDataChanged()` is already wired and
suspected a no-op. Verified against `SettingsPanel.tsx`:

- `refreshModules()` reloads installed modules, module topics, **and
  `resourceSources`** (what the Data Sources section renders) — and is called by
  the three module-management handlers.
- But `importBackupJson` (line ~219) and `restoreSqliteBackup` (line ~247) fired
  only `onUserDataChanged?.()` (an App-level callback) and **never called
  `refreshModules()`**.

So the premise is **real, not a no-op**: after a JSON import or SQLite restore,
Settings' own Data Sources list and installed-modules list stay stale until the
panel remounts (e.g. the user navigates away and back).

The existing e2e `imports resource JSON and makes entries searchable` masked this:
it navigates Settings → Resources → Settings, and that round-trip remounts the
panel, so Data Sources appeared to update.

## Change

Add `await refreshModules()` to both `importBackupJson` and `restoreSqliteBackup`
before `onUserDataChanged?.()`, matching the established pattern in the three
module handlers. Two lines; the refresh is request-guarded (`moduleRefreshRequestId`)
so concurrent refreshes are already safe.

## Testing

- **New e2e** `refreshes Settings Data Sources after import without leaving
  Settings` (`backup-restore.spec.ts`): imports a resource source and asserts the
  Data Sources section reflects it **without navigating away** — which is exactly
  what the older test could not prove. Confirmed RED on the pre-fix build ("Data
  Sources did not refresh in place after import"), GREEN after.
- `npm run check` green; full `npm run test:e2e:build`.
