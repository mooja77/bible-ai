# Layout integrity at maximum text size — Design

- **Date:** 2026-06-02
- **Status:** Implemented
- **Theme:** Accessibility / UX polish. Found by a **programmatic layout audit** of
  the running app at the largest App text size — the dense screens I could not
  safely screenshot on the user's cluttered multi-session desktop.

## Why this matters

Large text is a core need for the non-technical and low-vision readers this app
targets (older Bible readers often run the UI at its biggest size). So "does it
still hold together at max scale" is a real quality bar, not a nicety.

## What the audit found

Driving the app to the largest UI scale (140%) and inspecting the DOM on Reader,
Council, and Settings:

- **Good:** nothing overflowed the viewport and nothing spilled off-screen — the
  layout fundamentally holds at max scale (no overlap, no cut-off panels).
- **Minor real issues:** a few helper captions in narrow grid/flex cells
  overflowed their own cell because their text (or a long unbreakable token like
  `http://localhost:11434`) could not wrap:
  - Council voice-preview cards (`CouncilVoicePanels`) — per-voice detail text.
  - Settings setup pills (`SetupCheckPill`) — label + detail (e.g. "Tested
    providers", "Save after editing credentials.").
  - Settings provider cards (`ProviderStatusCard`) — detail incl. the Ollama URL.
- **False positive (not changed):** the `Max passages` number input reports
  `scrollWidth > clientWidth`, but that is the UA spinner/padding — the 2–3 digit
  value is fully visible and editable. The audit/guard excludes form controls.

## Change

Purely additive Tailwind — no behaviour, text, or testid changes:

- `min-w-0` on the grid/flex cells so they can shrink to their column instead of
  forcing their content to overflow.
- `break-words` on the caption/label/detail text so long words and URLs wrap.
- `shrink-0` on the `ProviderStatusCard` status badge so it is never squeezed.

## Testing

- New `tests/e2e/layout-maxscale.spec.ts` — a permanent regression guard: at the
  largest scale, asserts **no** viewport overflow, **no** element spilling past
  the right edge, and **no** clipped static text on Reader, Council, and Settings
  (allowing intentionally screen-reader-only / truncated elements; excluding form
  controls). Resets scale and returns to Reader to keep the shared session clean.
- `npm run check` 66/66; full `npm run test:e2e:build` 65/65 (clean run; earlier
  failures were the documented wedged-startup flake, confirmed by a clean re-run).
