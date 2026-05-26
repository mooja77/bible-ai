# Skip-to-Content Link — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `skip-to-content-a11y`)
- **Theme:** C — Accessibility & polish, sub-project 2
- **Owner:** John Moore

## Problem

The app shell (`app/src/App.tsx`) is a flex row: a fixed `<aside className="app-sidebar w-80 …">`
(the sidebar — app title, theme/command-palette buttons, the full "Main navigation" `<nav>`, and
contextual controls) followed by `<main className="flex-1 …">` (the content). A keyboard or
screen-reader user starting at the top of the page must Tab through *every* sidebar control on every
view before reaching the main content. There is no "skip to content" affordance — the standard
first link on any accessible page.

## Goals

1. A "Skip to main content" link is the **first focusable element** in the document.
2. It is **visually hidden until focused**, then appears (top-left) so sighted keyboard users see it.
3. **Activating it moves focus to the main content region**, bypassing the sidebar.

## Non-goals (YAGNI)

- No multiple skip links (e.g. "skip to navigation") — one "skip to main content" is the
  high-value baseline.
- No landmark/roles overhaul — `<main>`/`<nav>`/`<aside>` already exist as landmarks; this only adds
  the skip link + makes `<main>` a focus target.
- No routing/hash-history change — the link manages focus directly; `href="#main-content"` is
  semantic fallback only.
- No backend/Rust/sidecar/type change. Pure frontend, single file.

## Approach

A semantic anchor skip link as the first child of `.app-shell`, `sr-only` until focused, whose
`onClick` programmatically focuses a now-focusable `<main id="main-content" tabIndex={-1}>`.

## Design (`app/src/App.tsx` only)

### Skip link (first child of `.app-shell`)

The shell opens (≈line 933–935):

```tsx
  return (
    <div className="app-shell h-full flex">
      <aside className="app-sidebar w-80 border-r border-neutral-800 flex flex-col">
```

Insert the link immediately after `<div className="app-shell h-full flex">` and before the
`<aside>`:

```tsx
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
```

Notes:
- `sr-only` is itself `position: absolute; width:1px; height:1px; clip:…` — so the link is out of
  the flex flow even when unfocused; it never shifts the sidebar/main layout.
- `focus:not-sr-only` undoes the clipping on focus; `focus:absolute focus:left-4 focus:top-4
  focus:z-[100]` positions the now-visible pill at top-left above everything. Amber background +
  dark text matches the app's accent and is legible in both themes.
- `onClick` `preventDefault()` + programmatic `focus()` is deterministic across browsers (hash
  navigation alone doesn't reliably move *focus* to a `tabIndex=-1` target); `scrollIntoView()`
  handles the rare case where main is scrolled. Enter on the focused link fires `onClick`.

### Main becomes a focus target

Change (≈line 1291):

```tsx
      <main className="flex-1 overflow-auto bg-neutral-950/20">
```

to:

```tsx
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-auto bg-neutral-950/20 outline-none"
      >
```

`tabIndex={-1}` makes `<main>` programmatically focusable without adding it to the Tab order;
`outline-none` suppresses a jarring full-panel focus ring (it's only ever focused via the skip
link, where the user's intent is already clear). `id="main-content"` matches the link's target.

## Data flow / behavior

```
Page load → skip link is first in DOM (sr-only, invisible)
Tab (first press) → skip link gains focus → focus:not-sr-only reveals the top-left pill
Enter / click → onClick: focus #main-content (tabIndex=-1) → next Tab continues inside main content
(ignored / never focused → link stays invisible; zero visual impact for mouse users)
```

## Edge cases

- **`#main-content` missing** (shouldn't happen — same component): `getElementById` returns null,
  `?.focus()`/`?.scrollIntoView()` are harmless no-ops.
- **A modal/overlay open on load** (command palette, guided tour): those trap/own focus while open;
  the skip link sits behind them in the shell and is reached normally once they close — no conflict.
- **Theme toggle (light/dark):** amber-400 bg + neutral-950 text is legible in both; not theme-
  dependent.
- **Layout impact:** none — `sr-only` keeps the link absolutely positioned/1px until focused, and
  `focus:absolute` keeps it out of flow when visible.

## Testing

A new test in the app-global `app/tests/e2e/smoke.spec.ts` (already registered), asserting
deterministically without relying on initial-focus/Tab-order quirks or any guided-tour state:

1. **First tab stop:** `.app-shell`'s `firstElementChild` is the skip link
   (`a[href="#main-content"]`) — i.e. first in DOM order.
2. **Hidden until focused:** the link's `getBoundingClientRect()` is larger when focused than when
   blurred (sr-only → not-sr-only).
3. **Label:** text is "Skip to main content".
4. **Activation moves focus:** after `click()`, `document.activeElement.id === "main-content"`.

Plus:
- **`npm run build`** (tsc + vite) clean.
- Full **`npm run check`** green; **`npm run test:e2e:build`** green (new + all pre-existing specs)
  before merge.

## Risks & mitigations

- **`sr-only`/`not-sr-only` availability under Tailwind v4** → already in use elsewhere
  (`VersePanel` uses `sr-only`); they are core Tailwind utilities. Build verifies.
- **`isDisplayed()` can't distinguish a 1px sr-only element** → the e2e uses bounding-box size
  comparison (focused vs blurred), not `isDisplayed`, to prove the reveal-on-focus behavior.
- **Suppressing `<main>`'s outline** → it is only ever a programmatic focus target via the skip
  link; the user's navigation intent is explicit, so no visible-focus regression.

## Rollout

Single feature branch `skip-to-content-a11y`. Files:
- **Modify:** `app/src/App.tsx` (skip link + `<main>` focus target).
- **Modify:** `app/tests/e2e/smoke.spec.ts` (one new test).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
