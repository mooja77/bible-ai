# Settings connection-field validation & feedback Implementation Plan

> **Sub-skill:** focused feature work (executed inline). New advisory behavior — covered by a new e2e.

**Goal:** Add advisory inline validation (gateway/Ollama URL format, gateway-token-needs-URL) + auto-clearing "Saved" to the Settings panel, without changing the save flow, buttons, or aria-labels.

**Spec:** `docs/superpowers/specs/2026-05-29-settings-validation-feedback-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (new `settings-validation.spec.ts` + unchanged release-readiness; flaky-cascade protocol).

---

## Task 1: Implement validation + feedback + e2e

- [ ] **Step 1: `lib/settings.ts`** — add exported `isValidHttpUrl(value: string): boolean` (trim, `new URL()`, protocol http/https, try/catch false) per the spec.
- [ ] **Step 2: `features/settings/SettingsPanel.tsx`:**
  - Import `isValidHttpUrl` from `../../lib/settings` (alongside any existing imports).
  - Add the derived booleans (`gatewayUrlInvalid`, `ollamaHostInvalid`, `gatewayTokenNeedsUrl`) in the component body per the spec.
  - Add advisory `<p>` messages: `data-testid="gateway-url-error"` (under gateway URL Field, ~584), `data-testid="ollama-host-error"` (under Ollama host Field, ~642), `data-testid="gateway-token-warning"` (under gateway token Field, ~594). Use `text-red-300` for errors, `text-amber-300` for the token warning.
  - Add the auto-clear `useEffect` for `saved` (3000ms, with cleanup).
  - Do NOT change inputs/aria-labels/buttons.
- [ ] **Step 3: New `tests/e2e/settings-validation.spec.ts`** — describe/it: click `button=Settings`; `const gw = await $('input[aria-label="Managed gateway URL"]')`; `await gw.setValue("not a url")`; assert `await $('[data-testid="gateway-url-error"]')` is displayed; `await gw.setValue("https://gw.example.test")`; assert the error is no longer existing/displayed; finally `await gw.setValue("")` to leave a clean draft. Mirror the import/style of `release-readiness.spec.ts` (`import { browser, $, expect } from "@wdio/globals"`).
- [ ] **Step 4: Register the spec** — add `"./tests/e2e/settings-validation.spec.ts",` as the LAST entry in the `specs` array in `app/wdio.conf.mts` (after release-readiness).
- [ ] **Step 5: Build.** From `app/`: `npm run build` → tsc + vite clean.
- [ ] **Step 6: Commit:**
```bash
git add app/src/lib/settings.ts app/src/features/settings/SettingsPanel.tsx app/tests/e2e/settings-validation.spec.ts app/wdio.conf.mts
git commit -m "feat(settings): advisory URL validation + auto-clearing save confirmation"
```
(Stage only these files; the unrelated `app/src-tauri/Cargo.toml` stays uncommitted.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/sv.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/sv.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass incl. the new spec. If failures are a contiguous unrelated block, re-run `npm run test:e2e` (no rebuild) to confirm (flaky cascade).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** `isValidHttpUrl` (Step 1); 3 advisory messages + auto-clear (Step 2); new e2e (Step 3) registered (Step 4); build + check + suite (Task 2) ✓.
- **Safety:** advisory only (no save gating); buttons + aria-labels unchanged → existing e2e intact; new spec registered last + clears its field.
- **Behavioral:** derived booleans recompute per render; auto-clear effect cleans up; placeholders (localhost http) validate as valid.
