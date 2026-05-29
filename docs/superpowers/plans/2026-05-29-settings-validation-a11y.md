# Accessibility for settings validation messages Implementation Plan

> **Sub-skill:** focused a11y feature (inline). Builds on D1.

**Goal:** Wire `aria-invalid` + `aria-describedby` from the gateway-URL/Ollama-host/gateway-token inputs to their D1 validation messages.

**Spec:** `docs/superpowers/specs/2026-05-29-settings-validation-a11y-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (extended settings-validation spec; flaky-cascade protocol).

---

## Task 1: Wire ARIA + extend e2e

- [ ] **Step 1: `SettingsPanel.tsx`** — gateway URL input: add `aria-invalid={gatewayUrlInvalid}` + `aria-describedby={gatewayUrlInvalid ? "gateway-url-error" : undefined}`; add `id="gateway-url-error"` to its `<p>`. Ollama host input: `aria-invalid={ollamaHostInvalid}` + `aria-describedby={ollamaHostInvalid ? "ollama-host-error" : undefined}`; `id="ollama-host-error"` on its `<p>`. Gateway token input: `aria-describedby={gatewayTokenNeedsUrl ? "gateway-token-warning" : undefined}`; `id="gateway-token-warning"` on its `<p>`. (Already applied to the working tree.)
- [ ] **Step 2: `tests/e2e/settings-validation.spec.ts`** — after asserting the gateway-url-error is displayed, assert `await gatewayUrl.getAttribute("aria-invalid")` === `"true"` and `await gatewayUrl.getAttribute("aria-describedby")` === `"gateway-url-error"`; after setting a valid URL + the error clears, assert `aria-invalid` === `"false"`.
- [ ] **Step 3: Build** — `npm run build` clean.
- [ ] **Step 4: Commit:**
```bash
git add app/src/features/settings/SettingsPanel.tsx app/tests/e2e/settings-validation.spec.ts
git commit -m "feat(settings): associate validation messages with inputs via aria-invalid/aria-describedby"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/a11y.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/a11y.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** aria attrs + ids on the 3 messages (Step 1); e2e aria assertions (Step 2); build + check + suite (Task 2) ✓.
- **Safety:** additive ARIA; conditional `aria-describedby` avoids dangling refs; validation logic/copy/data-testids unchanged.
