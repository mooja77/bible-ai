# Extract DataSourcesSection from SettingsPanel.tsx Implementation Plan

> **Sub-skill:** verbatim JSX-section extraction (inline). First stateful section — 2 props. `sed`-assemble; create→delete-const→replace-JSX order.

**Goal:** Move the Data Sources section (+ `DEFERRED_DATA_SOURCES`) into `features/settings/DataSourcesSection.tsx` as a 2-prop component.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-settings-data-sources-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (release-readiness + backup-restore render it; flaky-cascade protocol).

---

## Task 1: Move the section, rewire SettingsPanel

- [ ] **Step 1: Confirm boundaries** in the CURRENT file: the `DEFERRED_DATA_SOURCES` const range (grep `^const DEFERRED_DATA_SOURCES`, read to its closing `];`) and the Data Sources `<section …data-testid="data-sources-screen">…</section>` range (1065–1159; re-grep to confirm).
- [ ] **Step 2: Create `app/src/features/settings/DataSourcesSection.tsx`** via `sed` assembly: the 3 imports (types `ResourceSource`/`Translation` from lib/bible; `SourceStatusBadge` from ./SettingsPrimitives; `resourceSourceStatus`/`resourceSourceMetadata` from ./settingsData) + blank + the verbatim `DEFERRED_DATA_SOURCES` const + blank + `export function DataSourcesSection({ translations, resourceSources }: { translations: Translation[]; resourceSources: ResourceSource[] }) {` + `  return (` + the verbatim section JSX + `  );` + `}`.
- [ ] **Step 3: Delete the const** from SettingsPanel (`DEFERRED_DATA_SOURCES` range) by current line number.
- [ ] **Step 4: Replace the section JSX** (content-matched / sed range-change) with `      <DataSourcesSection translations={translations} resourceSources={resourceSources} />`.
- [ ] **Step 5: Imports** — add `import { DataSourcesSection } from "./DataSourcesSection";`; drop `SourceStatusBadge` from the `./SettingsPrimitives` import + `resourceSourceStatus`/`resourceSourceMetadata` from the `./settingsData` import (tsc arbiter — drop only if unused).
- [ ] **Step 6: Build** — `npm run build` clean.
- [ ] **Step 7: Diff-verify** the moved JSX vs `git show HEAD:…SettingsPanel.tsx` (the section range) — confirm identical modulo the wrapping.
- [ ] **Step 8: Commit:**
```bash
git add app/src/features/settings/DataSourcesSection.tsx app/src/features/settings/SettingsPanel.tsx
git commit -m "refactor(settings): extract DataSourcesSection from SettingsPanel"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/ds.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/ds.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** section + const → new 2-prop component (Step 2); SettingsPanel removes const + section, renders the component, drops 3 dead imports (Steps 3–5); verbatim JSX; build + check + suite (Tasks 1/2) ✓.
- **Safety:** `resourceSources` state + load effect stay (passed as prop); `translations` still used; one-directional imports; JSX diff verifies verbatim.
