# Decompose God-Components F1 — Extract GuidedTour from App.tsx — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `decompose-guided-tour`)
- **Theme:** F — Decompose god-components, sub-project 1
- **Owner:** John Moore

## Problem

`App.tsx` is ~2,392 lines. Much of it is the giant `App()` body (~1,430 lines), but a sizable chunk
is self-contained sibling definitions that don't belong in the app entry file. The largest such
piece is the onboarding **`GuidedTour`** (lines 2182–2392, ~210 lines) plus its content array
`TOUR_STEPS` (~110–201, ~90 lines) and the `TourStep` type. Extracting these into their own module
shrinks `App.tsx` by ~300 lines and gives onboarding a clear home — a low-risk first cut into the
god-component debt (Theme F).

`GuidedTour` is **fully prop-driven** (`steps, currentIndex, onStepChange, onClose, onFinish`; only
internal `isPlaying`/`progress` state), so the move is purely structural — no behavior change.

## Goals

1. Move `GuidedTour`, `TOUR_STEPS`, and `TourStep` out of `App.tsx` into a dedicated module, with
   **zero behavior change**.
2. Keep `App.tsx` compiling and behaving identically (the tour walkthrough e2e is the proof).
3. Establish the pattern + a home for subsequent F extractions.

## Non-goals (YAGNI)

- No refactor of the `App()` body itself (custom hooks for search/council/navigation) — that's a
  later, riskier F sub-project.
- No change to `GuidedTour`'s markup, props, state, or behavior — it moves verbatim.
- No extraction of `CommandPalette`/`NavigationShortcuts`/`InterleavedReader` here (F2+).
- No change to `TOUR_DISMISSED_KEY` or the tour state/handlers in `App()` (they stay).

## Boundary analysis (from grounding)

- `GuidedTour` (component): references only its props + internal state + `TOUR_AUTO_ADVANCE_MS` (a
  module const used **only** by GuidedTour) + the `TourStep` type. Self-contained.
- `TOUR_STEPS` (content array, `TourStep[]`): used by `App()` at several sites (step lookup by id /
  index, `findIndex(id === "theology")`) **and** passed to `<GuidedTour steps={TOUR_STEPS} />`. It is
  tour content → colocate with the tour and export it.
- `TourStep` (type): used by both `GuidedTour` and `App()` (`TOUR_STEPS: TourStep[]`). Export it.
- `TOUR_AUTO_ADVANCE_MS`: used only by `GuidedTour` → private to the new module.
- `TOUR_DISMISSED_KEY`: used only by `App()` (localStorage lifecycle) → **stays in `App.tsx`**.

## Design

### New `app/src/features/onboarding/GuidedTour.tsx`

Contains, moved **verbatim** from `App.tsx`:
- `export type TourStep = { … }` (the type at App.tsx ~96).
- `const TOUR_AUTO_ADVANCE_MS = 6500;` (private; App.tsx ~108).
- `export const TOUR_STEPS: TourStep[] = [ … ];` (the content array, App.tsx ~110–201).
- `export function GuidedTour({ steps, currentIndex, onStepChange, onClose, onFinish }: { … }) { … }`
  (App.tsx ~2182–2392, unchanged).

Imports at the top of the new file: `import { useEffect, useState } from "react";` (the only hooks
`GuidedTour` uses). No other imports (it references no other `App` helpers).

### `app/src/App.tsx`

- **Remove** the moved definitions: the `TourStep` type, `TOUR_AUTO_ADVANCE_MS`, `TOUR_STEPS`, and the
  `GuidedTour` function.
- **Add** an import (next to the other feature imports):
  `import { GuidedTour, TOUR_STEPS, type TourStep } from "./features/onboarding/GuidedTour";`
- **Keep** `TOUR_DISMISSED_KEY`, `tourStepIndex` state, `goToTourStep`, the `findIndex(id === "theology")`
  logic, and the `<GuidedTour steps={TOUR_STEPS} … />` call site — all unchanged.
- Verify no now-unused imports remain in `App.tsx` (e.g., if `useEffect`/`useState` were only used by
  the moved code — they are not; `App()` uses them heavily — so the React import is unchanged).

## Data flow / behavior

Unchanged. `App()` still owns the tour state (`tourStepIndex`), reads `TOUR_STEPS` (now imported),
and renders `<GuidedTour steps={TOUR_STEPS} currentIndex={tourStepIndex} onStepChange={goToTourStep}
… />`. The component behaves identically (same internal auto-advance/keyboard logic).

## Edge cases

- **Type-only import:** `type TourStep` is imported with the `type` modifier (it's only used in type
  positions in `App.tsx`, e.g. `TOUR_STEPS: TourStep[]` — though `TOUR_STEPS` is now imported as a
  value, so `TourStep` may only be needed if `App.tsx` annotates anything with it; import it as a
  type to be safe, and drop it if unused to avoid a lint error).
- **No circular import:** `App.tsx` imports from `GuidedTour.tsx`; `GuidedTour.tsx` imports nothing
  from `App.tsx`. One-directional.
- **`TOUR_STEPS` ordering/content:** moved verbatim — the e2e asserts specific step titles in order,
  so any accidental reordering/edit is caught.

## Testing

- **`npm run build`** (tsc) — catches any dangling reference or unused import from the move.
- **`npm run test:e2e:build`** — the smoke e2e *"opens the new user guide and steps through the main
  workflow"* drives the full tour (Start guide → Pause/Play → Next×N → Rewind → Finish, asserting each
  step's title and that Council/Theology/Resources headings appear) — a thorough behavior-preservation
  check for `GuidedTour` + `TOUR_STEPS`. All other specs must still pass.
- **Full `npm run check`** green (capture the REAL npm exit code, not a piped `tail`).
- No new test (pure structural move; the existing tour e2e is the regression guard).

## Risks & mitigations

- **A missed reference** (App still using a moved symbol) → `tsc` fails the build immediately.
- **Behavior drift from an accidental edit during the move** → the move must be verbatim; the tour
  e2e walkthrough catches content/behavior changes; reviewers diff the moved component against the
  original.
- **Unused-import lint after removal** → check `App.tsx` for now-unused symbols (none expected; the
  React hooks remain used by `App()`).

## Rollout

Single feature branch `decompose-guided-tour`. Files:
- **New:** `app/src/features/onboarding/GuidedTour.tsx`.
- **Modify:** `app/src/App.tsx` (remove the four definitions; add the import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`. First of Theme F.
