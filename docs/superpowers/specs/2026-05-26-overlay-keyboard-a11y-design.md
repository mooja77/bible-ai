# Dismissable Overlay Keyboard Accessibility — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `overlay-keyboard-a11y`)
- **Theme:** C — Accessibility & polish, sub-project 1
- **Owner:** John Moore

## Problem

`StrongsPopup` (`app/src/features/reader/StrongsPopup.tsx`) is a floating overlay — `fixed bottom-4
right-4 z-50` — opened by clicking a Strong's-tagged word in the reader. It has a focusable close
button (`aria-label="Close Strong's lookup"`), so it is reachable by keyboard, but:

1. **No Escape-to-close.** There is no key handler; a keyboard or screen-reader user cannot dismiss
   the overlay the way every floating panel is expected to. (Confirmed: no `keydown`/Escape handler
   anywhere in the reader overlays.)
2. **No focus management.** When the popup opens, focus stays on the verse word that triggered it
   (behind the popup); the popup's contents are not announced as a dialog, and focus is not returned
   to the trigger when it closes. A keyboard user has to Tab forward, hunting for the overlay's
   controls.

This is a small but real accessibility gap and the first sub-project of Theme C.

## Goals

1. `StrongsPopup` closes on **Escape**.
2. The popup is announced as a **dialog** (`role="dialog"` + an accessible name), and focus moves
   **into** it on open.
3. Focus is **returned to the triggering element** when the popup closes.
4. Provide a small, reusable `useEscapeToClose` hook so the rest of Theme C (menus, future modals)
   can adopt Escape-to-dismiss consistently.

## Non-goals (YAGNI)

- **`VersePanel` is intentionally out of scope.** Grounding showed it is *not* a floating overlay —
  it renders as an inline `<aside className="soft-card … mt-6">` in the reader flow, below the
  selected verse, and its close button is already keyboard-reachable. Adding a *global* Escape
  handler to an inline panel would mean that, when both it and `StrongsPopup` are open, one Escape
  dismisses both (you'd lose your verse panel just to close the popup) — a minor regression. Escape
  on inline panels is better served by a global overlay-precedence stack, deferred below.
- **No focus trap / `aria-modal`.** These overlays are *non-modal* — the reader stays usable behind
  them — so trapping Tab inside would be wrong. Correct non-modal treatment is: Escape-to-close,
  focus-in on open, focus-return on close. No backdrop.
- **No global Escape-precedence / overlay stack.** With a single overlay adopting the hook now,
  a stack is unneeded. Revisit if/when multiple coexisting overlays need "Escape closes the topmost
  first."
- **No backend/Rust/sidecar/type change.** Pure frontend.

## Approach

A tiny shared `useEscapeToClose(onClose)` hook (document `keydown` → `onClose` on Escape), consumed
by `StrongsPopup`; plus dialog semantics and focus management local to `StrongsPopup`.

## Design

### New `app/src/lib/useEscapeToClose.ts`

```ts
import { useEffect, useRef } from "react";

/**
 * Calls `onClose` when the user presses Escape. For non-modal overlays/popups:
 * dismiss-on-Escape without trapping focus. The latest `onClose` is read via a
 * ref so the document listener is attached once (stable across re-renders) and
 * never goes stale.
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

The ref pattern keeps the listener attached once on mount (not re-subscribed every render) while
always invoking the current `onClose` — `StrongsPopup`'s `onClose` is an inline arrow from
`ChapterReader` (`onClose={() => setSelectedVerse(null)}`-style), so it changes identity each
render; a naive `[onClose]` dependency would churn the listener.

### `StrongsPopup` changes (`app/src/features/reader/StrongsPopup.tsx`)

- Import `useRef` (add to the existing `import { useEffect, useState } from "react"`).
- Import the hook: `import { useEscapeToClose } from "../../lib/useEscapeToClose";`
- Call `useEscapeToClose(onClose);` in the component body.
- Add a container ref and a focus-management effect that runs once on open/close:

```tsx
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    containerRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);
```

- On the outer `<div>` (currently
  `className="surface-panel fixed bottom-4 right-4 z-50 w-[420px] max-h-[60vh] overflow-y-auto
  rounded-lg backdrop-blur"`), add:
  - `ref={containerRef}`
  - `role="dialog"`
  - `aria-label={`Strong's lookup: ${surface}`}`
  - `tabIndex={-1}` (programmatically focusable, not in the Tab order)
  - `data-testid="strongs-popup"` (for the e2e focus assertion)
  - append `outline-none` to `className` (the container is only a *programmatic* focus target; the
    visible interactive controls inside — the close button, the occurrence buttons — keep their own
    focus styles, so suppressing the big box's outline is correct and avoids a jarring full-panel
    ring).

No other markup changes; the existing close button, entries, occurrences, and modules render
unchanged.

## Data flow / behavior

```
click Strong's word → StrongsPopup mounts
  → focus effect: capture document.activeElement (the word <button>), focus the dialog container
  → screen reader announces "Strong's lookup: <surface>, dialog"
User presses Escape (anywhere) → useEscapeToClose fires onClose → ChapterReader unmounts the popup
  → focus effect cleanup: previouslyFocused.focus() returns focus to the word token
(close button still works identically; clicking an occurrence calls onJumpToVerse + onClose)
```

## Edge cases

- **`document.activeElement` is `null`/`<body>`** (popup opened without a focused trigger): capture
  is null-guarded (`previouslyFocused?.focus()`) → restore is a harmless no-op.
- **`codes` change while the popup stays mounted** (clicking another tagged word without closing):
  the `[]`-dependency focus effect does not re-run, so focus is not yanked back to the container on
  every selection — intended; the existing data-fetch effect (`[codes.join(",")]`) still refreshes
  content.
- **Rapid open/close:** mount focuses the container, unmount restores the trigger; React runs the
  cleanup before the next mount, so focus tracking stays consistent.
- **Other Escape handlers:** none exist in the reader overlays today, so Escape unambiguously closes
  the popup.

## Testing

Extend `app/tests/e2e/reader-interactions.spec.ts`. The existing test *"opens Strong's lookup and
occurrence navigation for tagged words"* (≈line 545) already: goes to Reader → Genesis 1:1 →
`columns` layout → enables `[data-testid="translation-WLC"]` → clicks `[data-testid="word-token"]`
→ waits for `h3*=Occurrences`. Reuse that exact setup for a new `it(...)` that verifies keyboard
dismissal:

1. Open the popup (same steps); wait for `[data-testid="strongs-popup"]`.
2. **Focus-in:** assert `document.activeElement` is the dialog — via
   `browser.execute(() => document.activeElement?.getAttribute("data-testid"))` equals
   `"strongs-popup"`.
3. Press **Escape** (`browser.keys("Escape")`).
4. **Closed:** assert `[data-testid="strongs-popup"]` is gone (`waitForDisplayed({ reverse: true })`).
5. **Focus-return (best-effort):** assert `document.activeElement` is no longer the dialog and is a
   real element (e.g. the word token / not `<body>`); if exact-token identity proves brittle under
   tauri-driver, relax to "focus left the dialog" and note it in the implementation report.

Also:
- **`npm run build`** (tsc + vite) clean.
- Full **`npm run check`** green; **`npm run test:e2e:build`** green (new + all pre-existing specs)
  before merge.

## Risks & mitigations

- **Suppressing the container outline hides a focus indicator** → the container is `tabIndex={-1}`
  (never reached by Tab, only focused programmatically as the dialog announcement target); the
  actually-tabbable controls inside keep their visible focus styles. Standard dialog pattern.
- **Listener churn / stale `onClose`** → solved by the ref-based hook (attach once; always-fresh
  `onClose`).
- **Single-consumer hook ("why abstract?")** → deliberate: it is the first piece of Theme C's
  overlay/menu keyboard-a11y toolkit (the dropdown menus and any future modal will reuse it), and it
  cleanly isolates the a11y concern from the popup's render. Kept intentionally tiny.
- **Breaking the existing Strong's e2e** → focus-on-open targets the dialog container, which does
  not impede locating/clicking the close button; the existing test is unaffected.

## Rollout

Single feature branch `overlay-keyboard-a11y`. Files:
- **New:** `app/src/lib/useEscapeToClose.ts`
- **Modify:** `app/src/features/reader/StrongsPopup.tsx`
- **Modify:** `app/tests/e2e/reader-interactions.spec.ts` (one new `it`)

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
