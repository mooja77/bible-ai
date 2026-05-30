# Global async-error notice Implementation Plan

> **Sub-skill:** additive global component + window listeners + one new e2e. Complements G1 (boundaries miss async/event-handler throws). No happy-path behavior change.

**Goal:** Add `GlobalErrorNotice` (window `unhandledrejection`/`error` listeners → dismissible toast), mount it as a sibling of the top-level `ErrorBoundary` in `main.tsx`, and cover it with a new e2e that dispatches a synthetic error event.

**Spec:** `docs/superpowers/specs/2026-05-30-global-error-notice-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (incl. new spec; flaky-cascade protocol).

---

## Task 1: Component + mount + e2e

- [ ] **Step 1: Create `app/src/components/GlobalErrorNotice.tsx`** — verbatim from the spec: `describe()` helper, `IGNORED_PATTERNS` filter, `useEffect` installing `unhandledrejection` + `error` listeners (console.error + `show`), auto-dismiss `useEffect` (10s), fixed bottom-right `role="alert"` toast with `data-testid="global-error-notice"` + `data-testid="global-error-dismiss"`.
- [ ] **Step 2: `main.tsx`** — `import { GlobalErrorNotice } from "./components/GlobalErrorNotice";` and add `<GlobalErrorNotice />` as a sibling AFTER `</ErrorBoundary>`, still inside `<React.StrictMode>`.
- [ ] **Step 3: Create `app/tests/e2e/global-error-notice.spec.ts`** — `browser.url("/")`; `browser.execute` dispatch `new ErrorEvent("error", { message: "Synthetic test error", error: new Error("Synthetic test error") })`; assert `[data-testid="global-error-notice"]` displayed + contains "Synthetic test error"; click `[data-testid="global-error-dismiss"]`; assert notice gone (`waitForDisplayed({ reverse: true })`). Mirror settings-validation.spec.ts conventions (`@wdio/globals`, mocha, expect-webdriverio, `SELECTOR_TIMEOUT`).
- [ ] **Step 4: Register the spec** in `app/wdio.conf.mts` — append `"./tests/e2e/global-error-notice.spec.ts"` LAST in the `specs` array. **Use PowerShell string-replace** (the file has a UTF-8 BOM + `\r\n\r\n` double-spacing the Edit tool mishandles): replace the `settings-validation.spec.ts",` entry with itself + `\r\n\r\n      "./tests/e2e/global-error-notice.spec.ts",`. Re-read via PowerShell to confirm.
- [ ] **Step 5: Build** — `npm run build` clean.
- [ ] **Step 6: Commit:**
```bash
git add app/src/components/GlobalErrorNotice.tsx app/src/main.tsx app/tests/e2e/global-error-notice.spec.ts app/wdio.conf.mts
git commit -m "feat(robustness): add global async-error notice (unhandledrejection/error)"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `cd app && npm run check > /tmp/gn.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/gn.log` → `NPM_EXIT=0`. (Gate lives in `app/package.json`, NOT repo root.)
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass incl. the new spec. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch. Stage ONLY the listed files — never `git add -A`; `app/src-tauri/Cargo.toml` stays uncommitted.

---

## Self-Review (plan author)

- **Spec coverage:** listeners + filter + toast (Step 1); global mount surviving fallback (Step 2); real e2e via synthetic event without shipping a fault surface (Steps 3–4); build + check + suite (Tasks 1/2) ✓.
- **Safety:** renders `null` on the happy path → suite stays green; `useEffect` cleanup prevents StrictMode listener leak; no existing `.catch` handling touched.
- **Format discipline:** `wdio.conf.mts` edited via PowerShell to preserve BOM + double-spaced CRLF; only the listed files staged; Cargo.toml untouched.
- **Distinct value vs G1:** boundaries catch render throws; this catches async/event-handler throws — the complement, not a duplicate.
