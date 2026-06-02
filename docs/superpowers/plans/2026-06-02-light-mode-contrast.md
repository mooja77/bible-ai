# Light-mode contrast (WCAG AA) — Implementation Plan

> Muted secondary/tertiary captions were too light to read in light mode; darken
> the two neutral tokens to clear AA, and guard it so it can't regress.

**Spec:** `docs/superpowers/specs/2026-06-02-light-mode-contrast-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] Static check: confirmed all accent **text** shades used are already
  remapped for light → narrowed the search to neutral greys.
- [x] Runtime audit (became the test): measured WCAG contrast in light mode on
  Reader/Council/Settings/Theology; found `text-neutral-500` (~3.8–4.35:1) and
  `text-neutral-600` (~2.5:1) failing AA.
- [x] Fix: `App.css` `[data-theme="light"]` — `neutral-500 #737373→#5c5c5c`,
  `neutral-600 #a3a3a3→#6b6b6b` (token-level; fixes all screens, keeps the
  500-darker-than-600 emphasis order). Non-text uses (hover borders / divider)
  verified unaffected.
- [x] Guard: `tests/e2e/contrast-light.spec.ts` asserts zero sub-AA text in
  light mode across five screens; registered after `layout-maxscale.spec.ts`.
- [x] Verify: rebuild + audit → all screens clean; `npm run check` 66/66; full
  `npm run test:e2e` 66/66 (clean run).

## Notes
- Token-level fix chosen over per-component edits: 213 `text-neutral-500` + 35
  `text-neutral-600` usages — one CSS change covers them all and any future use.
- No screenshots needed: the contrast computation is objective and stronger than
  eyeballing; dark mode remains the visually-confirmed default.
