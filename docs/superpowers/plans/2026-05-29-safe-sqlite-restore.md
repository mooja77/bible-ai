# Confirmation guard for the destructive SQLite restore Implementation Plan

> **Sub-skill:** focused feature work (inline). Guard a destructive op + update the e2e in lockstep.

**Goal:** Require an explicit "Confirm restore" before running `restoreUserSqlite`, with a visible warning.

**Spec:** `docs/superpowers/specs/2026-05-29-safe-sqlite-restore-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (updated restore test; flaky-cascade protocol).

---

## Task 1: Implement the confirm guard

- [ ] **Step 1: `SettingsPanel.tsx`** — add `const [confirmingRestore, setConfirmingRestore] = useState(false);` near `sqliteRestorePath` state (~113).
- [ ] **Step 2:** In `restoreSqliteBackup()` (~270), add `setConfirmingRestore(false);` right after `setBackupBusy(true);`.
- [ ] **Step 3:** In the SQLite restore path `<input>` `onChange` (~915), also call `setConfirmingRestore(false)` alongside `setSqliteRestorePath(...)`.
- [ ] **Step 4:** Replace the single "Restore SQLite" button (~903-910) with the two-state control from the spec: default red "Restore SQLite" → `setConfirmingRestore(true)` (same disabled condition); when `confirmingRestore`, render the `data-testid="restore-confirm-warning"` span + red "Confirm restore" (`onClick={() => void restoreSqliteBackup()}`, disabled while `backupBusy`) + ghost "Cancel" (`onClick={() => setConfirmingRestore(false)}`, disabled while `backupBusy`).
- [ ] **Step 5: `tests/e2e/backup-restore.spec.ts`** — in the SQLite restore test (~70), after `await restoreButton.click();` insert: `const confirmRestore = await $("button=Confirm restore"); await confirmRestore.waitForClickable({ timeout: 10_000 }); await confirmRestore.click();` Keep the existing wait for `"Restored SQLite. Safety backup:"`.
- [ ] **Step 6: Build** — `npm run build` clean.
- [ ] **Step 7: Commit:**
```bash
git add app/src/features/settings/SettingsPanel.tsx app/tests/e2e/backup-restore.spec.ts
git commit -m "feat(settings): confirmation guard before destructive SQLite restore"
```
(Stage only these two; the unrelated `app/src-tauri/Cargo.toml` stays uncommitted.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/sr.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/sr.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass incl. the updated restore test. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** confirm state (Step 1); reset-on-run (Step 2) + reset-on-path-edit (Step 3); two-state control (Step 4); e2e confirm click (Step 5); build + check + suite (Task 2) ✓.
- **Safety:** only the destructive restore is gated; backup/save untouched; `backupBusy` still guards re-entry; e2e updated in lockstep.
- **Behavior:** arm → confirm → run; Cancel/path-edit disarm; empty path keeps the arm button disabled.
