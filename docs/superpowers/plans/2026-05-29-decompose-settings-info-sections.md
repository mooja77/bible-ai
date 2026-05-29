# Extract static info sections from SettingsPanel.tsx Implementation Plan

> **Sub-skill:** verbatim JSX-section extraction (inline). `sed`-assemble the new module; create→delete-consts→replace-JSX order to keep line numbers valid.

**Goal:** Move the License & Attribution + About & Distribution sections (+ their consts) into `features/settings/SettingsInfoSections.tsx` as no-prop components. Third SettingsPanel slice.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-settings-info-sections-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (release-readiness asserts the two screens; flaky-cascade protocol).

---

## Task 1: Move sections + consts, rewire SettingsPanel

- [ ] **Step 1: Create `app/src/features/settings/SettingsInfoSections.tsx`** via `sed` assembly from the CURRENT SettingsPanel.tsx (before any deletions): `import { InfoBlock } from "./SettingsPrimitives";` + blank + `sed -n '59,60p'` (APP_NAME/APP_VERSION) + blank + `sed -n '75,106p'` (SOURCE_ATTRIBUTIONS) + blank + `export function LicenseAttributionSection() {` + `  return (` + `sed -n '1192,1234p'` + `  );` + `}` + blank + `export function AboutDistributionSection() {` + `  return (` + `sed -n '1236,1264p'` + `  );` + `}`.
- [ ] **Step 2: Delete the consts from SettingsPanel** (by current line number, descending): `sed -i '75,106d'` (SOURCE_ATTRIBUTIONS) then `sed -i '59,60d'` (APP_NAME/APP_VERSION). (Do BEFORE the JSX edits so these line numbers are valid.)
- [ ] **Step 3: Replace the JSX sections** (content-matched Edits, line-number-agnostic): replace the License `<section …data-testid="license-attribution-screen">…</section>` block with `      <LicenseAttributionSection />`; replace the About `<section …data-testid="about-distribution-screen">…</section>` block with `      <AboutDistributionSection />`.
- [ ] **Step 4: Imports** — add `import { LicenseAttributionSection, AboutDistributionSection } from "./SettingsInfoSections";`; drop `InfoBlock` from the `./SettingsPrimitives` import (tsc arbiter — drop only if unused).
- [ ] **Step 5: Build** — `npm run build` clean.
- [ ] **Step 6: Diff-verify** the moved JSX: `git show HEAD:…SettingsPanel.tsx` (1192–1234, 1236–1264) vs the new file's two `return (...)` bodies — confirm the JSX lines are identical (modulo the wrapping `export function`/`return (`/`)`/`}`).
- [ ] **Step 7: Commit:**
```bash
git add app/src/features/settings/SettingsInfoSections.tsx app/src/features/settings/SettingsPanel.tsx
git commit -m "refactor(settings): extract License/About info sections from SettingsPanel"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/si.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/si.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass (release-readiness renders both screens). Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** 2 sections + 3 consts → new file (Step 1); SettingsPanel deletes consts + replaces JSX + drops InfoBlock (Steps 2–4); verbatim JSX; build + check + suite (Tasks 1/2) ✓.
- **Order safety:** new file assembled from pristine source first; const sed-deletes use valid line numbers; JSX replacements are content-matched (line-number-agnostic).
- **Verify:** JSX diff; release-readiness e2e asserts the rendered testids/text.
