# Clarify the two text-size controls — Implementation Plan

> Disambiguate the sidebar's two near-identical `A− 100% A+` rows so a
> non-technical user can tell the whole-app scale from the reader-text scale.

**Spec:** `docs/superpowers/specs/2026-05-31-clarify-size-controls-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] `src/features/...` — n/a (control lives in `App.tsx`).
- [x] `src/App.tsx` — relabel the Reader font control "Text" → "Reading text";
  restyle to the global control's `meta-pill` pills + `tabular-nums select-none`
  readout; add `role="group"` + `aria-label="Reading text size"` + button titles;
  normalise `A-` → `A−`. Leave the global "App text size" control (and its
  `ui-scale-*` testids) untouched.
- [x] `npm run check` 66/66; `npm run test:e2e:build` 62/62 (incl. ui-scale spec).
- [x] Docs; ff-merge to main.

## Self-review
- Pure presentational/labelling change; handlers and state unchanged → no
  behaviour risk, e2e unaffected (confirmed green).
- The two controls now share a visual family, so the distinction (whole app vs
  verses) is legible instead of looking like an accidental duplicate.
- Discovered by actually viewing the running app — closing the long-standing gap
  where visual issues couldn't be confirmed. Empty-NT-column issue logged for the
  manual walkthrough, deliberately out of scope here.
