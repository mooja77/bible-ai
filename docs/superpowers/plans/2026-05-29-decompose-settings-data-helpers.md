# Extract data/import-parsing helpers from SettingsPanel.tsx Implementation Plan

> **Sub-skill:** verbatim-sibling move (inline; `sed` extraction + full-span diff + tsc arbiter).

**Goal:** Move the 7 pure data/JSON-parsing helpers (1360–1436) into `features/settings/settingsData.ts`, verbatim. Second SettingsPanel decomposition slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-settings-data-helpers-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (release-readiness renders Data Sources; flaky-cascade protocol).

---

## Task 1: Move helpers, rewire SettingsPanel

- [ ] **Step 1: Create `app/src/features/settings/settingsData.ts`** — imports (`type { ModuleEntry, ResourceSource }` from "../../lib/bible"; `type { DataSourceStatus }` from "./SettingsPrimitives"), blank, then the verbatim block 1360–1436 with `export` prepended to ONLY `moduleEntryReaderTarget`, `resourceSourceStatus`, `resourceSourceMetadata` (the read* helpers stay private). Build via `sed -n '1360,1436p' | sed -e 's/^function moduleEntryReaderTarget/export function moduleEntryReaderTarget/' -e 's/^function resourceSourceStatus/export function resourceSourceStatus/' -e 's/^function resourceSourceMetadata/export function resourceSourceMetadata/'`.
- [ ] **Step 2: Edit `SettingsPanel.tsx`** — delete the block 1360–1436 (+ trailing blank); add `import { moduleEntryReaderTarget, resourceSourceStatus, resourceSourceMetadata } from "./settingsData";`; drop `type DataSourceStatus` from the `./SettingsPrimitives` import line.
- [ ] **Step 3: Build** — `npm run build`. Fix any remaining unused import per tsc. Re-run until clean.
- [ ] **Step 4: Byte-identity diff** — `git show HEAD:…SettingsPanel.tsx` (1360–1436) vs the new file's helper span (export-stripped on the 3 public fns); confirm FULL_SPAN_IDENTICAL.
- [ ] **Step 5: Commit:**
```bash
git add app/src/features/settings/settingsData.ts app/src/features/settings/SettingsPanel.tsx
git commit -m "refactor(settings): extract data/import-parsing helpers from SettingsPanel"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/sd.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/sd.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** 7 helpers → new file w/ correct export/private split (Step 1); SettingsPanel removes the block + imports the 3 + drops dead `DataSourceStatus` (Step 2); verbatim; build + check + suite (Tasks 1/2) ✓.
- **Safety:** pure functions; `ModuleEntry`/`ResourceSource` kept (still used); one-directional imports; full-span diff verifies verbatim.
