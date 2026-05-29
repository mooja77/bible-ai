# Onboarding & Settings D2 — Wire the guided-tour actionLabel into an "Open {mode}" CTA — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `tour-action-cta`)
- **Theme:** D — Onboarding & settings, sub-project 2

## Problem

Each `TOUR_STEPS` entry defines an `actionLabel` ("Open Reader", "Open Council", …) on 6 of 7 steps
(`GuidedTour.tsx:11,28,53,66,79,92,105`) but it is **never rendered** — dead data. A user reading the
tour step about a feature has no explicit "take me there" affordance; they must find the small "Close"
button or press Esc. This sub-project surfaces `actionLabel` as a purposeful primary-style CTA that drops
the user into that feature and ends the tour.

## Goals

1. Render `step.actionLabel` (when present) as a button in the tour footer.
2. Clicking it navigates to `step.mode`, dismisses the tour prompt, and closes the tour.

## Non-goals (YAGNI)

- No change to the existing Next/Previous/Finish/Rewind/Play-Pause/"Do not show prompt"/Close controls
  (the smoke tour-walkthrough e2e clicks "Next"/"Finish"/"Pause"/"Play" by exact label — they must stay).
- No change to the Esc/backdrop close behavior.
- No auto-launch changes.

## Boundary analysis (from grounding)

- `GuidedTour` is presentational, props `{ steps, currentIndex, onStepChange, onClose, onFinish }`
  (`GuidedTour.tsx:109-121`). It already imports `type Mode` (`:2`).
- Invariant: the app mode always equals the current step's mode — `openTour`/`goToTourStep`
  (`useGuidedTour.ts`) call `selectMode(step.mode)` on open and on every step change. So "navigate to
  `step.mode`" is largely a no-op visually, but calling it keeps the CTA's contract explicit/robust.
- App renders `<GuidedTour … onClose={() => closeTour(false)} onFinish={() => closeTour(true)} />`
  (`App.tsx:1462-1468`); `selectMode` + `closeTour` are in scope there.
- Smoke e2e (`smoke.spec.ts:64-118`) opens via "Start guide", steps via `clickTourButton("Next")`, ends
  with "Finish"; it clicks buttons by exact label, so an added "Open {mode}" button is non-colliding.

## Design

### `app/src/features/onboarding/GuidedTour.tsx`

- Add `onAction: (mode: Mode) => void` to the props type.
- In the footer right-hand group, before the "Do not show prompt" button, render (only when the step has
  an `actionLabel`):
  ```tsx
  {step.actionLabel && (
    <button
      type="button"
      onClick={() => onAction(step.mode)}
      className="btn-secondary px-3 py-1.5 text-sm"
      data-testid="tour-action"
    >
      {step.actionLabel}
    </button>
  )}
  ```

### `app/src/App.tsx`

- Pass `onAction={(mode) => { selectMode(mode); closeTour(true); }}` to `<GuidedTour>` (navigate +
  persist-dismiss + close — "take me there, I'm set").

## Data flow / behavior

Clicking "Open {mode}" calls `selectMode(mode)` (app is already in that mode; explicit + harmless) then
`closeTour(true)` (persists dismissal via `dismissTourPrompt`, closes the modal). The user lands in the
feature they were reading about, and the sidebar prompt collapses to the "Guide" pill (re-openable).

## Edge cases

- **Step without `actionLabel`** (the "search" step) → no button rendered.
- **Auto-play**: the actionLabel button is static; clicking it during autoplay still closes/navigates
  (the autoplay interval is torn down on unmount).
- **No new exit-path divergence**: Close/Esc/backdrop still `closeTour(false)` (unchanged).

## Testing

- **Extend `smoke.spec.ts`** tour test: after the reader step renders (~line 77), assert
  `await expect(await tour.$("button=Open Reader")).toBeDisplayed();` (assertion only — no click, so the
  existing Next/Finish flow is undisturbed).
- **`npm run build`** (tsc) green.
- **Full `npm run check`** green.
- **`npm run test:e2e:build`** — full suite; the tour walkthrough still passes. Flaky-cascade re-run
  protocol.

## Risks & mitigations

- **Breaking the smoke tour flow** → the new button is additive; existing buttons/labels unchanged; only a
  display assertion is added.
- **Confusing redundancy with Close** → the CTA is contextual ("Open Council") + primary intent, distinct
  from the generic Close; it also persists dismissal, unlike Close.

## Rollout

Single feature branch `tour-action-cta`. Files:
- **Modify:** `app/src/features/onboarding/GuidedTour.tsx` (prop + button), `app/src/App.tsx` (wire
  `onAction`), `app/tests/e2e/smoke.spec.ts` (one assertion).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
