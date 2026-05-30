# UX H8 — Process visualization & animation (slice 1: Council) — Implementation Plan

> The user's explicit ask. Slice 1 = honest choreographed Council pipeline stepper + per-helper "thinking" cards, driven by the existing elapsed counter (no backend change). Real per-stage events deferred to H8b. All motion honors prefers-reduced-motion.

**Spec:** `docs/superpowers/specs/2026-05-30-ux-h8-process-animation-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build` + desktop-MCP visual smoke.

## Tasks (as executed)
- [x] Redesign `CouncilRunningPanel`: 5-stage pipeline stepper (estimateActiveStage from elapsed;
  done ✓ / active pulsing ● / upcoming faint; holds at "Consulting the helpers", never false-completes
  later stages) + live per-helper "thinking…" cards (staggered three-dot animation). Plain-language
  copy ("the helpers"). Keeps data-testid.
- [x] App.css: `council-stage-pulse` + `council-thinking` keyframes; global
  `@media (prefers-reduced-motion: reduce)` neutralizing app animation/transition.
- [x] `npm run build` exit 0; confirm no e2e couples to the running panel.
- [x] `npm run check` exit 0; `npm run test:e2e:build` green.
- [x] desktop-MCP visual smoke (stepper + dots render; reduced-motion freezes).
- [x] spec/plan committed; ff-merge to main.

## Self-review
- Honest-by-design: time-estimated stages, no false completion; documents the backend-eventing upgrade
  path (H8b). Reduced-motion handled globally (also helps H1/H10). Sequential single calls; build the
  arbiter; no fragile e2e on a transient fast-mock panel.
