# UX Visual Refresh — Modern indigo theme — Implementation Plan

> Visible restyle (user asked for one). Deep slate base + indigo accent replacing gold, softer radii. Done centrally via CSS token remap in App.css — no per-component edits, e2e-safe (selectors are text/testid, not color).

**Spec:** `docs/superpowers/specs/2026-05-30-ux-visual-refresh-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] Dark `:root`: slate background + indigo-tinted surfaces/borders/tint/btn-text/scrollbar;
  remap `--color-amber-{100..500}` → indigo (re-tints all ~107 amber utilities at once).
- [x] Light `[data-theme]`: accent remap amber→dark-indigo + `--app-tint` + btn-primary text.
- [x] Hardcoded accent rgba/hex (focus ring, mark, selection, btn-primary, input focus, verse-flash,
  council-thinking) → indigo.
- [x] Soften radii: soft-card 8→10, buttons/inputs 6→8, mark 2→3.
- [x] grep-confirm zero remaining amber literals; `npm run build` exit 0; `npm run check` 65/65.
- [x] `npm run test:e2e:build` green; spec/plan committed; ff-merge to main.

## Self-review
- Token-remap mechanism mirrors the existing light-mode approach → minimal, centralized, reversible.
- emerald/red kept for status semantics. Visual confirmation left to the user (desktop tooling
  couldn't isolate the app window); verified by build + token audit + e2e.
