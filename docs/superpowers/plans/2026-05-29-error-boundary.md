# App-wide React ErrorBoundary Implementation Plan

> **Sub-skill:** additive new component + two wrap sites. No behavior change on the happy path; transparency proven by the full e2e suite staying green. First Theme G item.

**Goal:** Add a reusable `ErrorBoundary` (reusing `ErrorState`) and place it top-level (`main.tsx`, reload recovery) + per-content (`App.tsx`, `key={mode}`, mode-switch recovery) so a render throw shows a styled fallback instead of a white screen.

**Spec:** `docs/superpowers/specs/2026-05-29-error-boundary-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (suite stays green → boundaries transparent; flaky-cascade protocol).

---

## Task 1: Create the ErrorBoundary component + wire both sites

- [ ] **Step 1: Create `app/src/components/ErrorBoundary.tsx`** — the class component from the spec: `getDerivedStateFromError` → `{ error }`; `componentDidCatch` → `console.error(...)`; props `{ children, title?, resetLabel?, onReset? }`; renders `ErrorState` (from `./StateViews`) + optional reset `<button class="btn-secondary">` inside a `role="alert"` wrapper with `data-testid="error-boundary-fallback"` / `"error-boundary-reset"`.
- [ ] **Step 2: `main.tsx`** — `import { ErrorBoundary } from "./components/ErrorBoundary";` and wrap `<App/>` inside `<React.StrictMode>` with `<ErrorBoundary title="The app hit an unexpected error" resetLabel="Reload app" onReset={() => window.location.reload()}>`.
- [ ] **Step 3: `App.tsx` import** — add `import { ErrorBoundary } from "./components/ErrorBoundary";` alongside the other `./components`/`./features` imports.
- [ ] **Step 4: `App.tsx` wrap** — inside `<main id="main-content">`, AFTER the `{warning && (…)}` block, wrap the big `{error ? ( … ) : … }` panel-switch ternary in `<ErrorBoundary key={mode} title="This view ran into a problem">` … `</ErrorBoundary>`. Do NOT wrap the warning banner. Verbatim ternary inside.
- [ ] **Step 5: Build** — `npm run build` clean (TS: class component, `ErrorInfo`/`ReactNode` types, JSX balance).
- [ ] **Step 6: Commit:**
```bash
git add app/src/components/ErrorBoundary.tsx app/src/main.tsx app/src/App.tsx
git commit -m "feat(robustness): add app-wide ErrorBoundary (top-level + per-mode)"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/eb.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/eb.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass (every panel still renders → boundaries transparent). Flaky-cascade re-run protocol (re-run `npm run test:e2e` without rebuild if a contiguous unrelated block fails).
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch. (Stage ONLY the listed files — never `git add -A`; the pre-existing modified `app/src-tauri/Cargo.toml` stays uncommitted.)

---

## Self-Review (plan author)

- **Spec coverage:** new reusable boundary (Step 1); top-level reload net (Step 2); per-content keyed-by-mode net (Steps 3–4); diagnostics via `componentDidCatch`; build + check + full suite (Tasks 1/2) ✓.
- **Safety:** purely additive — happy path renders `children` unchanged; the full e2e suite is the transparency proof. No panel's in-band error handling touched. `key={mode}` adds no new unmount/mount beyond today's mode swap.
- **No-new-test rationale:** crash-injection would mean shipping a fault surface (spec non-goal); transparency is what users feel and is covered. `data-testid`s left for a future natural-crash test.
- **Staging discipline:** only the 3 files; Cargo.toml untouched.
