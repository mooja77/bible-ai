# Dismissable Overlay Keyboard Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reader's `StrongsPopup` overlay keyboard-accessible — close on Escape, announce as a dialog, move focus into it on open, and return focus to the trigger on close — via a small reusable `useEscapeToClose` hook.

**Architecture:** A new `useEscapeToClose(onClose)` hook (document `keydown` → `onClose` on Escape, attached once via a ref to the latest callback). `StrongsPopup` calls the hook, marks its container `role="dialog"` with an accessible name and `tabIndex={-1}`, and runs a one-shot effect that focuses the container on open and restores the previously-focused element on close. Frontend-only; verified by an extension to the existing reader e2e.

**Tech Stack:** React 19 + TypeScript, WebdriverIO + tauri-driver e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-overlay-keyboard-a11y-design.md`

**Verification note:** No frontend unit runner; the hook + popup behavior is verified by `npm run build` (types) and a deterministic mock-free e2e that opens the popup (WLC tagged word), asserts focus moved into the dialog, presses Escape, and asserts it closed + focus returned.

---

## File Structure

- `app/src/lib/useEscapeToClose.ts` — **new**; the reusable Escape-to-dismiss hook. *(Task 1)*
- `app/src/features/reader/StrongsPopup.tsx` — **modify**; consume the hook, add dialog semantics + focus management. *(Task 2)*
- `app/tests/e2e/reader-interactions.spec.ts` — **modify**; add one `it` for Escape-to-close + focus (already registered in `wdio.conf.mts`). *(Task 3)*

No backend/Rust/sidecar/type change.

---

## Task 1: `useEscapeToClose` hook

**Files:**
- Create: `app/src/lib/useEscapeToClose.ts`

- [ ] **Step 1: Write the hook**

Create `app/src/lib/useEscapeToClose.ts` with exactly:

```ts
import { useEffect, useRef } from "react";

/**
 * Calls `onClose` when the user presses Escape. For non-modal overlays/popups:
 * dismiss-on-Escape without trapping focus. The latest `onClose` is read via a
 * ref so the document listener is attached once (stable across re-renders) and
 * never goes stale — callers commonly pass an inline arrow whose identity
 * changes every render.
 */
export function useEscapeToClose(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
```

- [ ] **Step 2: Type-check**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds (the hook is unused so far — this just confirms it compiles).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/useEscapeToClose.ts
git commit -m "feat(a11y): add useEscapeToClose hook for non-modal overlays"
```

---

## Task 2: Wire `StrongsPopup` — Escape + dialog + focus management

**Files:**
- Modify: `app/src/features/reader/StrongsPopup.tsx` (imports line 1–9; component body from line 20; outer `<div>` at line 61).

- [ ] **Step 1: Update imports**

The file currently starts (line 1):

```tsx
import { useEffect, useState } from "react";
import {
  getStrongs,
```

Change the React import to add `useRef`, and add the hook import after the `bible` import block (the `AddToWorkspaceMenu` import is on line 10):

```tsx
import { useEffect, useRef, useState } from "react";
import {
  getStrongs,
```

and, immediately after `import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";` (line 10):

```tsx
import { useEscapeToClose } from "../../lib/useEscapeToClose";
```

- [ ] **Step 2: Add the hook call, container ref, and focus effect**

The component body begins (line 20–23):

```tsx
export function StrongsPopup({ codes, surface, morph, onJumpToVerse, onClose }: Props) {
  const [entries, setEntries] = useState<StrongsEntry[] | null>(null);
  const [occurrences, setOccurrences] = useState<StrongsOccurrence[]>([]);
  const [moduleEntries, setModuleEntries] = useState<ModuleEntry[]>([]);
```

Insert, immediately after the `moduleEntries` state line (line 23) and before the existing data-fetch `useEffect` (line 25):

```tsx
  const containerRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(onClose);

  // Non-modal dialog focus management: move focus into the popup on open so
  // keyboard/screen-reader users land in it, and return focus to whatever
  // opened it (the verse word) when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    containerRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);
```

(Leave the existing `useEffect` that fetches `getStrongs`/`getStrongsOccurrences`/`listModuleEntriesForStrongs` with its `[codes.join(",")]` dependency unchanged — it follows directly after.)

- [ ] **Step 3: Add dialog semantics to the container**

The outer element is currently (line 61):

```tsx
    <div className="surface-panel fixed bottom-4 right-4 z-50 w-[420px] max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur">
```

Replace it with:

```tsx
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Strong's lookup: ${surface}`}
      tabIndex={-1}
      data-testid="strongs-popup"
      className="surface-panel fixed bottom-4 right-4 z-50 w-[420px] max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur outline-none"
    >
```

(Only the opening tag changes — `outline-none` appended to the existing classes; the `<header>`, entries, occurrences, modules, and the closing `</div>` are untouched. The `tabIndex={-1}` container is only a programmatic focus target, so suppressing its outline is correct; the close button and occurrence buttons keep their own focus styles.)

- [ ] **Step 4: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/reader/StrongsPopup.tsx
git commit -m "feat(a11y): Escape-to-close + focus management for Strong's popup"
```

---

## Task 3: E2E — Escape closes the popup and restores focus

**Files:**
- Modify: `app/tests/e2e/reader-interactions.spec.ts` (add one `it` as the LAST test in the `describe`, i.e. immediately after the existing *"opens Strong's lookup and occurrence navigation for tagged words"* test that ends ≈line 574, before the `describe`'s closing `});`).

Context: the spec is already in `wdio.conf.mts` (it's an existing file), so no registration change. The new test reuses the exact setup from the existing Strong's test: Reader → `Genesis 1:1` → `columns` layout → enable `[data-testid="translation-WLC"]` → click `[data-testid="word-token"]`.

- [ ] **Step 1: Add the test**

Insert this `it` block immediately after the closing `});` of the `"opens Strong's lookup and occurrence navigation for tagged words"` test (and before the `describe`'s final `});`):

```ts
  it("closes the Strong's lookup on Escape and restores focus", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    const layout = await $('select[aria-label="Reader layout"]');
    await layout.selectByAttribute("value", "columns");

    const wlcCheckbox = await $('[data-testid="translation-WLC"]');
    await wlcCheckbox.waitForDisplayed({ timeout: 10_000 });
    if (!(await wlcCheckbox.isSelected())) {
      const wlcLabel = await wlcCheckbox.parentElement();
      await wlcLabel.click();
    }

    const token = await $('[data-testid="word-token"]');
    await token.waitForClickable({ timeout: 10_000 });
    await token.click();

    const popup = await $('[data-testid="strongs-popup"]');
    await popup.waitForDisplayed({ timeout: 10_000 });

    // Focus moves into the dialog on open.
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.activeElement?.getAttribute("data-testid") ?? null,
        )) === "strongs-popup",
      { timeout: 5_000, timeoutMsg: "focus did not move into the Strong's dialog on open" },
    );

    // Escape closes it.
    await browser.keys("Escape");
    await popup.waitForDisplayed({ reverse: true, timeout: 5_000 });

    // Focus returns to the word token that opened it.
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.activeElement?.getAttribute("data-testid") ?? null,
        )) === "word-token",
      { timeout: 5_000, timeoutMsg: "focus did not return to the word token after Escape" },
    );
  });
```

Note on the focus-return assertion: the e2e runs under WebView2 (Chromium) on Windows, where clicking a `<button>` focuses it, so `document.activeElement` at popup-open is the clicked `[data-testid="word-token"]` and is restored on close. If under tauri-driver this proves flaky (focus not on the token), relax the final `waitUntil` to assert focus merely *left* the dialog (`!== "strongs-popup"` and `activeElement` is a real element, not `<body>`) and note the relaxation in the implementation report — the primary guarantees (Escape closes, focus moved in) stay strict.

- [ ] **Step 2: Run the e2e suite**

Run (from `app/`, allow ~10 min; set the command timeout to 600000 ms): `npm run test:e2e:build`
Expected: the new test passes and all pre-existing specs still pass. If it fails for INFRA reasons (driver/build), report BLOCKED with details; if a selector/timing issue, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/reader-interactions.spec.ts
git commit -m "test(a11y): e2e for Strong's popup Escape-to-close + focus"
```

---

## Task 4: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, node `--check`, sidecar tests — Rust/sidecar unchanged, so effectively the TS build + the unchanged suite).

- [ ] **Step 2: Update spec status**

In `docs/superpowers/specs/2026-05-26-overlay-keyboard-a11y-design.md`, change the `Status:` line from `Draft` to `Implemented`. Commit:

```bash
git add docs/superpowers/specs/2026-05-26-overlay-keyboard-a11y-design.md
git commit -m "docs(a11y): mark overlay-keyboard-a11y spec implemented"
```

- [ ] **Step 3: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** Escape-to-close (Task 1 hook + Task 2 Step 2 `useEscapeToClose(onClose)`) ✓; `role="dialog"` + accessible name (Task 2 Step 3) ✓; focus-in on open + focus-return on close (Task 2 Step 2 effect) ✓; reusable hook for Theme C (Task 1, standalone file) ✓; `VersePanel` out of scope (untouched — no task modifies it) ✓; no focus trap / `aria-modal` (none added) ✓; e2e open→focus-in→Escape→closed→focus-return (Task 3) ✓; build + full check (Tasks 2/4) ✓.
- **Type consistency:** `useEscapeToClose(onClose: () => void)` matches `StrongsPopup`'s `onClose: () => void` prop; `containerRef = useRef<HTMLDivElement>(null)` matches the outer `<div ref={containerRef}>`; `data-testid="strongs-popup"` matches the e2e selector; `[data-testid="word-token"]` and `[data-testid="translation-WLC"]` reused verbatim from the existing Strong's test.
- **Placeholder scan:** every step has complete code + exact commands; the only conditional is the documented focus-return fallback (explicit, with a concrete relaxed assertion), not a placeholder.
