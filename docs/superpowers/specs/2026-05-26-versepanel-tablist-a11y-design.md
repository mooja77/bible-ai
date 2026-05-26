# VersePanel Tabs → ARIA Tablist — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `versepanel-tablist-a11y`)
- **Theme:** C — Accessibility & polish, sub-project 3
- **Owner:** John Moore

## Problem

The reader's verse-detail panel (`app/src/features/reader/VersePanel.tsx`) has three views —
**Cross-refs / Highlight / Note** — switched by `TabButton`s (plain `<button>`s, active state shown
only by an amber `border-b-2`). They are not exposed as a tab group: no `role="tablist"`/`tab`/
`tabpanel`, no `aria-selected`, and no arrow-key navigation. A screen-reader user hears three
unrelated buttons (not "tab 1 of 3, selected"), and a keyboard user must Tab through each tab
individually instead of arrowing between them. The tab `<button>`s also sit in a mixed toolbar row
alongside action controls (Ask the Council, bookmark, explain, Add, theology), so the grouping is
purely visual.

## Goals

1. Expose the three tabs as a proper WAI-ARIA **tablist** (`role="tablist"` / `tab` / `tabpanel`,
   `aria-selected`, `aria-controls`, `aria-labelledby`).
2. **Roving tabindex** — only the active tab is in the Tab order; **Left/Right** (wrapping) and
   **Home/End** move between tabs and activate them (automatic activation).
3. No visual change for mouse users; no change to which panel content mounts (each tab's content
   still mounts only when active).

## Non-goals (YAGNI)

- No manual-activation variant (arrows move focus, Enter activates) — automatic activation fits
  cheap tab switches and is the APG-recommended default here.
- No restyle of the tabs or the surrounding toolbar; the action controls (Ask Council, bookmark,
  explain, Add, theology select) are untouched.
- No change to `CrossRefsTab` / `HighlightTab` / `NoteTab` internals, and no mounting all three at
  once (would trigger redundant fetches) — conditional rendering of the active panel is preserved.
- No backend/Rust/sidecar/type change. Pure frontend, single file.

## Approach

Group the three tabs into a `role="tablist"` with a roving-tabindex keyboard handler; refactor
`TabButton` into a `role="tab"` button carrying the ARIA wiring and a focus `ref`; wrap the
conditionally-rendered active content in a single `role="tabpanel"`.

## Design (`app/src/features/reader/VersePanel.tsx` only)

### Tab metadata constant (module scope)

```tsx
const TABS: { value: Tab; label: string }[] = [
  { value: "refs", label: "Cross-refs" },
  { value: "highlight", label: "Highlight" },
  { value: "note", label: "Note" },
];
```

(`Tab` is the existing `type Tab = "refs" | "highlight" | "note";`.)

### Tablist + roving tabindex (replaces the three `<TabButton>` lines, 182–184)

Inside `VersePanel`, add a ref array and a keyboard handler:

```tsx
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((t) => t.value === tab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].value);
    tabRefs.current[next]?.focus();
  };
```

Replace the three `<TabButton …>` lines (182–184) with a tablist wrapper that maps `TABS`:

```tsx
        <div role="tablist" aria-label="Verse details" className="flex gap-1" onKeyDown={handleTabKeyDown}>
          {TABS.map((t, index) => (
            <TabButton
              key={t.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              label={t.label}
              value={t.value}
              active={tab === t.value}
              onClick={() => setTab(t.value)}
            />
          ))}
        </div>
```

(This wrapper is one flex child of the existing `flex flex-wrap` toolbar, so the tabs stay grouped
first and the action controls follow exactly as before.)

### `TabButton` → `role="tab"` (refactor of the component at ~335)

```tsx
const TabButton = forwardRef<
  HTMLButtonElement,
  { label: string; value: Tab; active: boolean; onClick: () => void }
>(function TabButton({ label, value, active, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`verse-tab-${value}`}
      aria-selected={active}
      aria-controls="verse-details-panel"
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={
        "px-3 py-1.5 text-xs border-b-2 transition-colors " +
        (active
          ? "border-amber-500 text-amber-200"
          : "border-transparent text-neutral-400 hover:text-neutral-200")
      }
    >
      {label}
    </button>
  );
});
```

`forwardRef` is imported from `react`, and the keyboard-event type is imported as an alias —
`VersePanel`'s existing import becomes
`import { forwardRef, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";`
(`React` is not imported as a namespace here, so `React.KeyboardEvent` is unavailable; the alias also
avoids shadowing the global DOM `KeyboardEvent`). The visible styling is unchanged.

### Tabpanel wrapper (around the conditional content, 260–268)

Wrap the existing `{tab === "refs" && …}` / `{tab === "highlight" && …}` / `{tab === "note" && …}`
block in one panel:

```tsx
      <div
        role="tabpanel"
        id="verse-details-panel"
        aria-labelledby={`verse-tab-${tab}`}
        tabIndex={0}
        className="outline-none"
      >
        {tab === "refs" && <CrossRefsTab verseId={verseId} onJumpToVerse={onJumpToVerse} />}
        {tab === "highlight" && (
          <HighlightTab verseId={verseId} current={highlightColor} onChanged={onMutated} />
        )}
        {tab === "note" && <NoteTab verseId={verseId} onChanged={onMutated} />}
      </div>
```

A single swapping panel (all tabs share `aria-controls="verse-details-panel"`) avoids dangling
`aria-controls` references to unmounted per-tab panels; `aria-labelledby` tracks the active tab so
the panel is named by whichever tab is selected. The `id` is unique because at most one `VersePanel`
is mounted at a time (driven by a single `selectedVerse`).

## Data flow / behavior

```
Tab order: only the active tab (tabIndex=0) is reached by Tab; the panel (tabIndex=0) is next.
Arrow/Home/End on a focused tab → handleTabKeyDown → setTab(next) + focus that tab's button
  → React re-renders: new tab aria-selected=true & tabIndex=0, old tab tabIndex=-1
  → the conditional content swaps inside #verse-details-panel (same mount/unmount as a click today)
Mouse click on a tab → onClick → setTab (unchanged behavior)
```

## Edge cases

- **Non-arrow keys** in the tablist: handler returns early (no `preventDefault`), so Tab/Shift+Tab
  and typing elsewhere behave normally.
- **Ref array staleness:** `tabRefs.current[index]` is set via the callback ref each render; the
  array length is fixed (3) so indices are stable.
- **`aria-controls` to a momentarily-absent panel:** avoided — there is always exactly one
  `#verse-details-panel` rendered (the wrapper is unconditional; only its children switch).
- **Verse changes while open:** unrelated to tabs; `tab` state persists across verse changes (same
  as today).

## Testing

Add one test to `app/tests/e2e/reader-interactions.spec.ts` (reuse the existing verse-panel open
sequence: Reader → Genesis 1:1 → click `button[aria-label*="Verse"][aria-label*="actions"]`):

1. Assert a `[role="tablist"]` exists and contains `[role="tab"]`s; the "Cross-refs" tab has
   `aria-selected="true"` (default).
2. Focus the Cross-refs tab (`browser.execute` focus by `#verse-tab-refs`), press `ArrowRight`;
   assert the "Highlight" tab now has `aria-selected="true"`, is `document.activeElement`, and the
   Highlight panel content is shown.
3. Press `Home`; assert "Cross-refs" is reselected and focused.
4. Close the panel.

Plus:
- **`npm run build`** (tsc + vite) clean.
- Full **`npm run check`** green; **`npm run test:e2e:build`** green (new + all pre-existing,
  including the existing verse-panel test which still matches the text-bearing tab `<button>`s).

## Risks & mitigations

- **`forwardRef` typing** → the generic `forwardRef<HTMLButtonElement, Props>` with a named inner
  function keeps the component name in React DevTools and types the `ref`; build verifies.
- **Breaking the existing verse-panel e2e** (`$("button=Cross-refs")` etc.) → tabs remain
  `<button>` elements with the same visible text; selectors still match.
- **Automatic activation surprising a screen-reader user** → it's the APG-recommended pattern for
  inexpensive tab panels; the content swap is immediate and announced via the tabpanel.

## Rollout

Single feature branch `versepanel-tablist-a11y`. Files:
- **Modify:** `app/src/features/reader/VersePanel.tsx` (TABS, tablist wrapper, `TabButton`→`role=tab`
  with `forwardRef`, tabpanel wrapper; add `forwardRef` + `type KeyboardEvent as ReactKeyboardEvent`
  to the react import — `useEffect`/`useRef`/`useState` are already imported).
- **Modify:** `app/tests/e2e/reader-interactions.spec.ts` (one new test).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
