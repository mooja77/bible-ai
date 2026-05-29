# Extract presentational primitives from SettingsPanel.tsx Implementation Plan

> **Sub-skill:** verbatim-sibling move (inline; ~217-line block via `sed`, full-span diff, tsc arbiter for imports).

**Goal:** Move the 9 presentational primitives (1431–1647) + the `SetupPath`/`DataSourceStatus` types into `features/settings/SettingsPrimitives.tsx`, verbatim. First SettingsPanel decomposition slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-settings-primitives-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (release-readiness + settings-validation render the primitives; flaky-cascade protocol).

---

## Task 1: Move primitives + types, rewire SettingsPanel

- [ ] **Step 1: Create `app/src/features/settings/SettingsPrimitives.tsx`** — `import type { ReactNode } from "react";`, then `export type SetupPath = "personal" | "local" | "gateway";` + `export type DataSourceStatus = "bundled" | "user-imported" | "deferred";`, then the verbatim block 1431–1647 with `export` prepended to each `function`. Build via `sed -n '1431,1647p' | sed 's/^function /export function /'`.
- [ ] **Step 2: Edit `SettingsPanel.tsx`** — delete the block 1431–1647, the `type DataSourceStatus` line (1387), and the `type SetupPath` line (91). (Delete lowest-numbered last to keep line numbers stable: 1431–1647 first, then 1387, then 91.) Add `import { SetupPathButton, SetupPathDetails, SetupCheckPill, ProviderMiniStatus, SourceStatusBadge, ProviderStatusCard, InfoBlock, DiagnosticRow, Field, type SetupPath, type DataSourceStatus } from "./SettingsPrimitives";` near the other imports.
- [ ] **Step 3: Build** — `npm run build`. If tsc reports `ReactNode` now-unused in SettingsPanel, drop it from the react import; fix any other unused import per tsc. Re-run until clean.
- [ ] **Step 4: Byte-identity diff** — `git show HEAD:…SettingsPanel.tsx` (1431–1647) vs the new file's component span (export-stripped); confirm FULL_SPAN_IDENTICAL.
- [ ] **Step 5: Commit:**
```bash
git add app/src/features/settings/SettingsPrimitives.tsx app/src/features/settings/SettingsPanel.tsx
git commit -m "refactor(settings): extract presentational primitives from SettingsPanel"
```
(Stage only these two; the unrelated `app/src-tauri/Cargo.toml` stays uncommitted.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/sp.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/sp.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** 9 primitives + 2 types → new file (Step 1); SettingsPanel removes the block + 2 type defs + imports them back (Step 2); verbatim/no-behavior-change; build + check + suite (Tasks 1/2) ✓.
- **Type threading:** `SetupPath`/`DataSourceStatus` exported from the new module (used by both moved components AND staying consumers `setupPath` state / `resourceSourceStatus`); one-directional (no cycle).
- **Verify:** full-span diff (not per-function `/^}$/`); tsc arbiter for the `ReactNode` drop.
