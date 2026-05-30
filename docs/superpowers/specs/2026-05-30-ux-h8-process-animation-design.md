# UX H8 — Process visualization & animation (slice 1: Council) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (merged to `main`)
- **Theme:** H — UX for non-technical users, sub-project 8. The user's explicit request: *"animations and
  visualisations of the technical processes which are happening so that the human user knows what's
  going on."* See `2026-05-30-ux-enhancement-plan.md` §3 H8.

## Problem

While the Council runs (often 10–60s), the user saw only "Thinking… {n}s" and a single pulsing dot
plus a static list of voice names. No sense of *what stage* the system is at or *why* it takes time.
This is Nielsen heuristic #1 (visibility of system status) — and the feature the user asked for.

## Architectural reality (shapes the slice)

The Council is a **single blocking `invoke`** (`askCouncil`); the backend emits **no** progress
events (the sidecar logs `[council]` stages only to stderr). So slice 1 ships an **honest,
choreographed** visualization driven by the existing `elapsed` seconds counter. Real per-stage
backend events are a deferred slice (H8b: Tauri `emit` from Rust/sidecar → a `listen` in the panel),
which can upgrade this same UI without redesign.

## Design (`CouncilRunningPanel`, CouncilVoicePanels.tsx)

A redesigned running panel (keeps `data-testid="council-running-panel"`; no e2e couples to it):

1. **Pipeline stepper** — 5 ordered stages with status icons:
   *Understanding your question → Searching Scripture → Consulting the helpers → Comparing the views
   → Writing the summary.* `estimateActiveStage(elapsed)` advances stages 1→2 on a time estimate
   (understand <2s, search <5s) then **holds at "Consulting the helpers"** (the long part). Done
   stages show a green ✓; the active stage shows a gently pulsing ●; upcoming stages are faint.
   **Honesty:** we never mark "Comparing"/"Writing" as done — the panel is replaced by the result the
   instant the run finishes, so no false-completion claim is made. A code comment documents this.
2. **Live per-helper cards** (shown once consulting) — each configured helper (Claude/Gemini/OpenAI/
   Gateway) gets a card with an animated three-dot "thinking…" indicator (staggered delays), making
   "they run in parallel" *visible* rather than only stated.
3. Plain-language copy: "Working on your question", "the helpers" (not "voices"), reassurance line.

## Motion + accessibility (`App.css`)

- New keyframes: `council-stage-pulse` (active stage), `council-thinking` (bouncing dots).
- **`prefers-reduced-motion: reduce`** media query neutralizes ALL app animation/transition
  (pulse/spin/verse-flash/the new ones) to ~0ms and freezes the thinking dots — the UI still conveys
  state via color + icon, just without movement. (First global reduced-motion handling in the app —
  benefits H1/H10 too.)

## Out of scope (later H8 slices)

- H8b: real backend progress events (Tauri emit/listen) for true per-stage + per-voice status
  (queued/done/failed) and a live "passages found" counter.
- Lighter progress UI for semantic search / explanation / import / restore.

## Testing

- `npm run build` + full `npm run check` green.
- Full `npm run test:e2e:build` green — council-mock exercises the loading→running-panel→result path;
  no e2e asserts the panel internals, and the mock resolves fast (stays at the first stage, per-helper
  cards not reached), so the transient panel isn't a flaky assertion target.
- Visual smoke via desktop MCP (preferred) to confirm the stepper + thinking dots render and that
  reduced-motion freezes them.
- No new e2e: the running panel is transient and (with the mock) too fast to assert deterministically;
  H8b's real-events version is the point to add a staged-events e2e.

## Rollout

Branch `ux-h8-process-animation`. Modify: `CouncilVoicePanels.tsx`, `App.css`, spec/plan. Verify with
`npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
