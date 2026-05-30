# UX Visual Refresh — Modern indigo theme — Design

- **Date:** 2026-05-30
- **Status:** Implemented (merged to `main`)
- **Theme:** H — UX. Direct response to user feedback ("the app still looks the same") + chosen
  direction "A visible design refresh" → "Modern indigo (cool)".

## Problem

The prior Theme-H work (H1–H5, H8) was deliberately functional/microcopy/contextual — so at rest the
app looked essentially unchanged (same near-black dark theme + gold accent). The user wanted a
**visible** restyle.

## Direction (user-selected)

Modern indigo: deep slate background, indigo/violet accent replacing the gold/amber identity, softer
radii, a touch more depth.

## Approach — centralized token remap (no per-component edits)

`App.css` drives color through CSS variables and Tailwind color tokens. The ~107 `amber-*` utility
usages across components are re-tinted **by remapping the amber color TOKENS to indigo** (the exact
mechanism light mode already uses to invert neutrals + darken accents), so no component files change.
e2e selects by text/testid (never color), so the suite is unaffected.

Changes, all in `app/src/App.css`:
- **Dark `:root`:** background gradient `#080a0d/#0d1117` → slate `#0c0f1a/#0f1320`; surfaces retinted
  blue-slate; borders → indigo-tinted; `--app-tint`, `--btn-primary-text` (`#ffedd5`→`#e0e7ff`),
  scrollbar → indigo/slate. Added a dark-mode remap of `--color-amber-{100..500}` → indigo
  (`#c7d2fe`→`#6366f1`), which re-tints every amber text/badge/button-fill utility at once.
- **Light `[data-theme]`:** accent remap targets changed amber→indigo (`--color-amber-*` →
  `#3730a3`/`#4338ca`/`#4f46e5`), `--app-tint` + `--btn-primary-text` → indigo.
- **Hardcoded accent values** (focus ring `#f59e0b`→`#6366f1`; `mark`, `::selection`, `.btn-primary`,
  `.settings-input:focus`, `verse-flash`, `.council-thinking` rgba) → indigo.
- **Softer radii:** `.soft-card` 8→10px; buttons + `.settings-input` 6→8px; `mark` 2→3px.

emerald (positive) and red (danger) status colors are intentionally kept.

## Testing

- `npm run build` exit 0; grep-confirmed zero remaining `245,158,11` / `251,191,36` / `#f59e0b`.
- Full `npm run check` green (65/65). Full `npm run test:e2e:build` green (color-only change; no
  selector impact).
- Visual confirmation deferred to the user: the desktop-automation tooling could not reliably isolate
  the app window in a cluttered multi-window desktop, so a screenshot-based confirmation was not
  claimed. Verified by build + token audit + e2e instead.

## Rollout

Branch `ux-visual-refresh`. Modify: `App.css`, spec/plan. Verify with `npm run check` +
`npm run test:e2e:build`, then ff-merge to `main`.
