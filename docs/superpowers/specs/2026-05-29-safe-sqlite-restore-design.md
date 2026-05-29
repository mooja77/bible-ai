# Onboarding & Settings D3 — Confirmation guard for the destructive SQLite restore — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `safe-sqlite-restore`)
- **Theme:** D — Onboarding & settings, sub-project 3

## Problem

In Settings → User Data, **"Restore SQLite"** fires `restoreUserSqlite(path)` immediately on a single
click (`SettingsPanel.tsx:903-910`, `:270-282`). This is a **destructive** operation — it replaces the
entire `user.sqlite` (a safety backup is taken server-side, but the live data is swapped). A single
mis-click (the button is enabled as soon as a path is present) wipes the working dataset. There is no
confirmation step. This sub-project adds a lightweight inline confirmation guard.

## Goals

1. Require an explicit confirm before running the destructive restore.
2. Make the consequence visible (warning text) at the moment of confirming.

## Non-goals (YAGNI)

- No Tauri file-picker (replacing the raw path input) — separate, larger change; the confirm guard is the
  high-value safe piece. (Noted as future work.)
- No change to the restore backend (`restoreUserSqlite`) or the safety-backup behavior.
- No confirm added to non-destructive flows (JSON backup, save).

## Boundary analysis (from grounding)

- `restoreSqliteBackup()` (`:270-282`) calls `restoreUserSqlite(sqliteRestorePath)` then sets
  `backupStatus` (`"Restored SQLite. Safety backup: …"` on success). `backupBusy` guards re-entry.
- UI (`:893-919`): "Backup SQLite" (`btn-secondary`) + "Restore SQLite" (red destructive button, disabled
  when `backupBusy || sqliteRestorePath.trim().length === 0`) + the `aria-label="SQLite restore path"`
  input.
- e2e `backup-restore.spec.ts:45-79` clicks `button=Restore SQLite` then waits for body text
  `"Restored SQLite. Safety backup:"`. → must insert a "Confirm restore" click.

## Design

### `app/src/features/settings/SettingsPanel.tsx`

- Add state: `const [confirmingRestore, setConfirmingRestore] = useState(false);` (near `sqliteRestorePath`,
  `:113`).
- In `restoreSqliteBackup()`, reset the flag (e.g., set `setConfirmingRestore(false)` at the start, after
  `setBackupBusy(true)`), so the controls return to the default state during/after the operation.
- When the path changes, cancel any pending confirm: in the path input's `onChange`, also
  `setConfirmingRestore(false)`.
- Replace the single "Restore SQLite" button with a two-state control:
  - **Default** (`!confirmingRestore`): the existing red "Restore SQLite" button, but `onClick` →
    `setConfirmingRestore(true)` (no longer restores directly); same disabled condition
    (`backupBusy || sqliteRestorePath.trim().length === 0`).
  - **Confirming** (`confirmingRestore`): a warning span
    (`data-testid="restore-confirm-warning"`: "This replaces all current data with the backup. A safety
    backup is saved first.") + a red **"Confirm restore"** button (`onClick={() => void
    restoreSqliteBackup()}`, disabled while `backupBusy`) + a **"Cancel"** ghost button
    (`onClick={() => setConfirmingRestore(false)}`, disabled while `backupBusy`).

The "Backup SQLite" button and the path input are unchanged (aside from the onChange cancel).

## Data flow / behavior

First click arms the confirm (no data touched). "Confirm restore" runs the existing
`restoreSqliteBackup()`. "Cancel" or editing the path disarms it. `backupBusy` still prevents double-fire.

## Edge cases

- **Empty path** → "Restore SQLite" stays disabled (can't arm).
- **Edit path mid-confirm** → confirm disarms (prevents confirming against a changed/typo'd path).
- **In-flight** → both confirm buttons disabled via `backupBusy`.

## Testing

- **Update `backup-restore.spec.ts`** (the SQLite restore test): after clicking `button=Restore SQLite`,
  click `button=Confirm restore` (wait for clickable), then keep the existing wait for
  `"Restored SQLite. Safety backup:"`.
- **`npm run build`** (tsc) green.
- **Full `npm run check`** green.
- **`npm run test:e2e:build`** — full suite; the updated restore test passes via the confirm path.
  Flaky-cascade re-run protocol.

## Risks & mitigations

- **Breaking the restore e2e** → updated in lockstep (one extra click).
- **Confusing two-step** → the warning text + "Confirm restore"/"Cancel" labels make the step explicit;
  Cancel + path-edit both disarm.

## Rollout

Single feature branch `safe-sqlite-restore`. Files:
- **Modify:** `app/src/features/settings/SettingsPanel.tsx` (state + two-state restore control),
  `app/tests/e2e/backup-restore.spec.ts` (insert the confirm click).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
