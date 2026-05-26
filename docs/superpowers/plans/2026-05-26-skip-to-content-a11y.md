# Skip-to-Content Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Skip to main content" link as the first focusable element in the app shell — visually hidden until focused — that moves focus to the main content region, letting keyboard users bypass the sidebar.

**Architecture:** A semantic `<a href="#main-content">` inserted as the first child of `.app-shell`, styled `sr-only focus:not-sr-only`; its `onClick` programmatically focuses `<main id="main-content" tabIndex={-1}>`. Single-file frontend change (`App.tsx`); verified by one deterministic e2e in `smoke.spec.ts`.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, WebdriverIO + tauri-driver e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-skip-to-content-a11y-design.md`

**Verification note:** No frontend unit runner; verified by `npm run build` (types) and an e2e that asserts (1) the link is `.app-shell`'s first element child, (2) its bounding box grows on focus (hidden-until-focused), (3) its label, and (4) activating it focuses `#main-content`. Bounding-box comparison is used instead of `isDisplayed()` because `sr-only` is a 1px element, not `display:none`.

---

## File Structure

- `app/src/App.tsx` — **modify**; add the skip link (first child of `.app-shell`) and make `<main>` a focus target (`id` + `tabIndex` + `outline-none`). *(Task 1)*
- `app/tests/e2e/smoke.spec.ts` — **modify**; add one `it` (already registered in `wdio.conf.mts`). *(Task 2)*

No backend/Rust/sidecar/type change.

---

## Task 1: Skip link + focusable `<main>` in `App.tsx`

**Files:**
- Modify: `app/src/features/...` → `app/src/App.tsx` (shell open ≈line 933–935; `<main>` ≈line 1291).

- [ ] **Step 1: Insert the skip link as the first child of `.app-shell`**

The component returns (≈line 933):

```tsx
  return (
    <div className="app-shell h-full flex">
      <aside className="app-sidebar w-80 border-r border-neutral-800 flex flex-col">
```

Insert the skip link between the `<div className="app-shell h-full flex">` line and the `<aside …>` line, so it reads:

```tsx
  return (
    <div className="app-shell h-full flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-950"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to main content
      </a>
      <aside className="app-sidebar w-80 border-r border-neutral-800 flex flex-col">
```

- [ ] **Step 2: Make `<main>` a focus target**

Find (≈line 1291):

```tsx
      <main className="flex-1 overflow-auto bg-neutral-950/20">
```

Replace that single opening tag with:

```tsx
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-auto bg-neutral-950/20 outline-none"
      >
```

(Only the opening tag changes; the `<main>` body and its closing `</main>` are untouched. There is exactly one `<main>` in `App.tsx`.)

- [ ] **Step 3: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(a11y): skip-to-content link focusing the main region"
```

---

## Task 2: E2E — skip link is first tab stop, reveals on focus, focuses main

**Files:**
- Modify: `app/tests/e2e/smoke.spec.ts` — add the `it` below IMMEDIATELY AFTER the `it("shows both Reader and Council mode buttons", …)` test (which ends at the `});` ≈line 23) and BEFORE the `it("opens the new user guide …")` test. This keeps it in clean post-load state (no guided tour open — the tour is opened explicitly via a "Start guide" button in a later test, not auto-shown).

- [ ] **Step 1: Add the test**

Insert this block (it uses `browser`, `$`, `expect`, all already imported at the top of the file):

```ts
  it("provides a skip-to-content link as the first tab stop", async () => {
    // It is the first focusable element in the shell (first in DOM = first tab stop).
    const isFirstChild = await browser.execute(() => {
      const shell = document.querySelector(".app-shell");
      const first = shell?.firstElementChild as HTMLElement | null;
      return first?.matches('a[href="#main-content"]') ?? false;
    });
    expect(isFirstChild).toBe(true);

    const skip = await $('a[href="#main-content"]');
    await expect(skip).toHaveText("Skip to main content");

    // Hidden until focused: the bounding box grows once focused (sr-only -> not-sr-only).
    const sizes = await browser.execute(() => {
      const el = document.querySelector('a[href="#main-content"]') as HTMLElement;
      el.blur();
      const blurred = el.getBoundingClientRect();
      el.focus();
      const focused = el.getBoundingClientRect();
      return { blurredW: blurred.width, focusedW: focused.width };
    });
    expect(sizes.focusedW).toBeGreaterThan(sizes.blurredW);

    // Activating it (keyboard Enter on the focused link) moves focus to the main region.
    await browser.execute(() => {
      (document.querySelector('a[href="#main-content"]') as HTMLElement).focus();
    });
    await browser.keys("Enter");
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.id ?? null)) === "main-content",
      { timeout: 5_000, timeoutMsg: "skip link did not move focus to #main-content" },
    );

    // Restore a clean state for subsequent tests.
    const reader = await $("button=Reader");
    await reader.click();
  });
```

- [ ] **Step 2: Run the e2e suite**

Run (from `app/`, allow ~10 min; set the command timeout to 600000 ms): `npm run test:e2e:build`
Expected: the new test passes and all pre-existing specs still pass.

Troubleshooting:
- If the **first-child** assertion fails, the link wasn't inserted as the first child of `.app-shell` — fix the JSX, not the test.
- If the **bounding-box** assertion fails (`focusedW` not greater), the `focus:not-sr-only`/`focus:absolute` classes aren't taking effect — confirm the className string exactly matches Task 1 Step 1 and that Tailwind emitted those utilities (a clean `npm run build` should).
- If the **focus-to-main** `waitUntil` fails but the popup/link clearly works, confirm `<main>` got `id="main-content"` + `tabIndex={-1}`. Do not weaken this assertion.
- INFRA failures (driver/build) → report BLOCKED with output.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/smoke.spec.ts
git commit -m "test(a11y): e2e for skip-to-content link"
```

---

## Task 3: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, all `node --check`, sidecar tests — Rust/sidecar unchanged).

- [ ] **Step 2: Update spec status**

In `docs/superpowers/specs/2026-05-26-skip-to-content-a11y-design.md`, change `Status:` from `Draft` to `Implemented`. Commit:

```bash
git add docs/superpowers/specs/2026-05-26-skip-to-content-a11y-design.md
git commit -m "docs(a11y): mark skip-to-content spec implemented"
```

- [ ] **Step 3: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** skip link is first focusable element (Task 1 Step 1 inserts it as `.app-shell`'s first child; Task 2 asserts `firstElementChild`) ✓; hidden until focused (`sr-only focus:not-sr-only`; Task 2 bounding-box check) ✓; activation focuses main (Task 1 `onClick` + `<main id="main-content" tabIndex={-1}>`; Task 2 Enter → `activeElement.id`) ✓; single-file + one e2e (Tasks 1–2) ✓; build + full check + e2e (Tasks 1/3/2) ✓.
- **Type consistency:** the link's `href="#main-content"` and `getElementById("main-content")` match `<main id="main-content">`; `onClick` uses `event: React.MouseEvent` inferred from the `<a>` (no explicit type needed); the e2e selector `a[href="#main-content"]` and `#main-content` id match the JSX.
- **Placeholder scan:** every step has complete code + exact commands; troubleshooting notes are diagnostic guidance, not placeholders.
