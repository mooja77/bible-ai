# UX H1 — Accessibility & legibility baseline — Design

- **Date:** 2026-05-30
- **Status:** Implemented (merged to `main`)
- **Theme:** H — UX for non-technical users, sub-project 1 (foundations). See `2026-05-30-ux-enhancement-plan.md`.

## Problem

For non-technical / older / low-vision users the app has legibility gaps (WCAG/NNG/Apple guidance):
- Text resizing exists **only for Scripture** (Reader A−/A+ → `fontScale` as `em`); the rest of the UI
  (nav, panels, dialogs, Council, Settings) cannot be enlarged.
- The focus ring is `2px solid rgba(245,158,11,0.55)` (App.css) — 55% opacity is faint on dark
  neutrals; WCAG 2.2 SC 2.4.13 wants a clearly visible, ≥3:1 indicator.
- `nav-section-title` is 11px (0.6875rem) — below the comfortable floor for older readers.

## Goal

A behavior-preserving legibility baseline: a **global UI text-size control** (persisted), a
**stronger focus ring**, and a **larger nav section title**. Default render is byte-for-byte the
same as today (scale defaults to 100%); all changes are additive.

## Design

### New `app/src/lib/useUiScale.ts` (mirrors `useTheme`)
- Steps: **100, 112, 125, 140 (%)** — covers Apple/NNG "comfortable body text" growth without
  breaking layout. Default **100** (no change from today).
- Initializes from `safeLocalStorageGet("ui-scale")` (validates against the allowed steps).
- Effect sets `document.documentElement.style.fontSize = "<scale>%"`. Because Tailwind v4 text
  utilities and the app's `rem` values derive from the root font-size, this scales the entire UI.
  The Reader's own `em`-based `fontScale` multiplies on top (so global scale lifts the reading
  baseline too — desirable).
- Effect persists to `safeLocalStorageSet("ui-scale", ...)`.
- Returns `{ uiScale, setUiScale, increaseUiScale, decreaseUiScale, canIncrease, canDecrease }`.

### `app/src/App.tsx` — header control
- In the existing header button cluster (next to theme toggle + ⌘K), add a compact, accessible
  **text-size group**: `−` button, a `{pct}%` readout, `+` button.
- Group has `aria-label="App text size"`; each button an explicit `aria-label`
  ("Decrease/Increase app text size"); buttons disable at the min/max step
  (`disabled:opacity-48` already exists). `data-testid`: `ui-scale-dec` / `ui-scale-inc` /
  `ui-scale-value`.
- Distinct from the Reader A−/A+ (which scales only Scripture) — labels make the difference clear.

### `app/src/App.css` — focus ring + nav title
- `:focus-visible` outline → `2px solid #f59e0b` (amber-500, full opacity; ≥3:1 on both themes) and
  keep `outline-offset: 2px`. (Was 55% opacity.)
- `.nav-section-title` font-size `0.6875rem` → `0.75rem` (12px); keep weight 600.

## Out of scope (later H-items)

Full per-token contrast audit (H1 follow-up), target-size sweep, light-theme contrast deep-dive,
plain-language relabel (H2), empty/error states (H3). H1 ships the highest-value, lowest-risk wins.

## Testing

- `npm run build` + full `npm run check` green.
- New e2e `app/tests/e2e/ui-scale.spec.ts` (registered last): asserts the header control increases
  the document root font-size and the readout updates, then resets it (so it doesn't perturb other
  specs in the shared session). Default (untouched) = 100%, so existing specs are unaffected.
- Full `npm run test:e2e:build` green (flaky-cascade re-run protocol).

## Risks & mitigations

- **Global root font-size could shift layouts** → default stays 100% (no change unless the user
  opts in); steps capped at 140%; verified via build + e2e + desktop-MCP visual smoke.
- **e2e session pollution** → the new spec resets scale to 100% at the end.
- **localStorage unavailable** → `safeLocalStorage*` already swallow errors; scale falls back to 100%.

## Rollout

Branch `ux-h1-legibility`. New: `lib/useUiScale.ts`, `tests/e2e/ui-scale.spec.ts`, spec/plan.
Modify: `App.tsx`, `App.css`, `wdio.conf.mts`. Verify with `npm run check` + `npm run test:e2e:build`,
then ff-merge to `main`.
