# Clarify the two text-size controls — Design

- **Date:** 2026-05-31
- **Status:** Implemented
- **Theme:** UX. Found by **finally seeing the running app** (windows-mcp screenshot
  of the real `app.exe`) — the source of the user's "font size issues" report.

## Problem

The sidebar shows **two** size controls that, to a non-technical user, look
identical — both render as a small `A− 100% A+` row:

1. **"App text size"** (top, always visible) — scales the *whole UI* via the
   document root font-size (the H1 `useUiScale` control).
2. **"Text"** (Reader only) — scales *only the verse text* (`fontScale`).

They genuinely do different things, but the labels ("App text size" vs bare
"Text") and the visually different styling (top used `meta-pill`; reader used
`btn-secondary w-7 h-7`) made them read as a confusing duplicate rather than a
coherent pair. "Which A+ do I press?" is exactly the kind of friction that reads
as "the font sizing is broken."

## Change

In `app/src/App.tsx`, the Reader's font control:
- relabelled **"Text" → "Reading text"** (says *what* it sizes);
- restyled from `btn-secondary w-7 h-7` to the same `meta-pill px-2` pills + the
  `tabular-nums select-none` readout the global control uses, so the two read as
  one family (global = whole app; reader = just the verses);
- given `role="group"` + `aria-label="Reading text size"` and button `title`s for
  parity with the global control;
- the minus glyph normalised `A-` → `A−` (true minus) to match.

No behaviour change: same `setReaderFontScale` handlers, same `fontScale` state.
The global control (with the `ui-scale-*` testids the e2e relies on) is untouched.

## Testing

- `npm run check` 66/66; `npm run test:e2e:build` 62/62 — incl. the
  `App text size control` spec (proves the global control's testids/labels and
  behaviour are intact).
- Visual: the running app was inspected by screenshot before the change (the two
  near-identical rows were confirmed). A post-change visual confirmation at both
  default and max size is the recommended manual follow-up.

## Note for the manual walkthrough

The empty 4th translation column ("No verses for this chapter" for an NT-only
translation on an OT chapter) still consumes a full column. Logged for the
walkthrough; not fixed here (separate concern from the size controls).
