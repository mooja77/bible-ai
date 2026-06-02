# Light-mode text contrast (WCAG AA) — Design

- **Date:** 2026-06-02
- **Status:** Implemented
- **Theme:** Accessibility. Found by a **runtime contrast audit** of light mode
  (the theme I had never verified — only dark was visually confirmed).

## Background

The theme system (`App.css`) builds light mode by mirroring the Tailwind
`neutral` scale and remapping accent tokens (amber→indigo, emerald, red, sky,
blue) to darker shades so accents don't wash out on white. A static check
confirmed every accent **text** shade used in components is remapped — so the
obvious "pale accent on white" bug class was already handled.

## What the audit found

Computing WCAG contrast for every visible text element in light mode across
Reader, Council, Settings, and Theology:

- **Reader: clean** — the actual reading experience already passes.
- **Two failing neutral greys**, used pervasively for secondary/tertiary text:
  - `text-neutral-500` (`#737373`) → ~3.8–4.35:1 — below AA (4.5) for small text,
    worst on the grey status pills (`bg-neutral-800 text-neutral-500`).
  - `text-neutral-600` (`#a3a3a3`) → ~2.5:1 — fails badly; used for tertiary
    captions everywhere (counts like "3 prompts", metadata, even the
    "Restore SQLite" button label).

Root cause: the scale-mirror maps "more muted" to "lighter", but lighter = lower
contrast on a light background, so muted captions fall under AA.

## Change

One token-level edit in the `[data-theme="light"]` block of `App.css` — fixes
every screen at once, no per-component churn:

- `--color-neutral-500: #737373 → #5c5c5c`
- `--color-neutral-600: #a3a3a3 → #6b6b6b`

500 stays darker than 600, preserving the "lower number = more emphasis"
hierarchy, and both now clear AA on the surfaces they appear on (verified
~5.3:1 on the grey pills, higher on cards). The handful of non-text uses of
these tokens are hover borders / a divider — unaffected or slightly improved.

## Testing

- New `tests/e2e/contrast-light.spec.ts` — permanent guard: in light mode,
  asserts **zero** text elements below AA (4.5 normal / 3.0 large) across Reader,
  Council, Settings, Theology, Resources (composites translucent surfaces over
  the light app background). Restores dark mode + Reader for the shared session.
- Before the fix the audit reported the failures above; after, all screens
  report none.
- `npm run check` 66/66; full `npm run test:e2e:build` 66/66.
