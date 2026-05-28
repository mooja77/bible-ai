# Decompose God-Components F7 — Extract useGuidedTour hook from App.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `extract-use-guided-tour`)
- **Theme:** F — Decompose god-components, sub-project 7 (second `App()`-body hook)

## Problem

`App.tsx` is ~1,511 lines. F6 proved the hook-extraction pattern with the trivial `theme` slice. The next
cohesive `App()`-body slice is **the guided-tour / onboarding state**: 4 state vars, a localStorage-init
effect, 5 handlers, a provider-setup auto-dismiss effect, and 2 localStorage-key constants. It pairs with
the already-extracted `GuidedTour` component + `TOUR_STEPS` (F1). Extracting it into a
`useGuidedTour()` hook removes ~50 lines of scattered onboarding logic from `App()` and colocates it with
the component it drives.

## Goals

1. Extract the tour/onboarding slice into `app/src/features/onboarding/useGuidedTour.ts`, behavior
   identical.
2. `App.tsx` compiles and behaves identically (the smoke e2e *"opens the new user guide and steps through
   the main workflow"* + the provider-setup prompt are the proof).

## Non-goals (YAGNI)

- No change to tour behavior, step order, localStorage keys, or the provider-prompt logic.
- No change to `selectMode` (stays in `App()` — it's used app-wide, not just by the tour) or to
  `GuidedTour`/`TOUR_STEPS`.
- No extraction of the other body slices (search/settings/reference-jump) — separate sub-projects.

## Boundary analysis (from grounding)

**State (App.tsx 147–150):** `tourOpen`, `tourStepIndex`, `tourDismissed`, `providerSetupDismissed`.

**Constants (84–85):** `TOUR_DISMISSED_KEY`, `PROVIDER_SETUP_DISMISSED_KEY` — used **only** by this slice
(217/219/673/678). Move into the hook module.

**Effects:**
- Init (216–220): reads both localStorage keys on mount → sets `tourDismissed`/`providerSetupDismissed`.
- Provider auto-dismiss (703–707): `if (providerSetupComplete && !providerSetupDismissed)
  dismissProviderSetupPrompt()`, deps `[providerSetupComplete, providerSetupDismissed]`.

**Handlers (665–692):** `openTour(stepIndex=0)` (uses `TOUR_STEPS` + `selectMode(step.mode)`),
`dismissTourPrompt`, `dismissProviderSetupPrompt`, `closeTour(dismiss=false)`,
`goToTourStep(nextIndex)` (uses `TOUR_STEPS` + `selectMode`).

**Derived (701):** `showProviderSetupPrompt = !providerSetupComplete && !providerSetupDismissed`.

**External seams (hook inputs):**
- `selectMode: (mode: Mode) => void` — `openTour`/`goToTourStep` call it; `selectMode` stays in `App()`
  (drives `mode`/`searchQuery`/`referenceJumpRequestId`).
- `providerSetupComplete: boolean` (= `settingsHasConfiguredAi(settings)`, App.tsx 700) — used by
  `showProviderSetupPrompt` + the auto-dismiss effect. Only used by this slice, but computing it in `App()`
  keeps the hook decoupled from the settings shape → pass it in as a plain boolean.

**Render/consumer surface (hook return):** `tourOpen` (1498), `tourStepIndex` (1501), `tourDismissed`
(939/942/956/958/960), `openTour` (772 commandItems, 955, 1350), `dismissTourPrompt` (963), `closeTour`
(1503/1504), `goToTourStep` (1502), `showProviderSetupPrompt` (972), `dismissProviderSetupPrompt` (993).

**Rules-of-Hooks / ordering checks:**
- App's only `return (` is the single JSX return at 856 — no early returns before the hook-call site, so
  calling `useGuidedTour()` after `providerSetupComplete` (~700) is legal.
- Moving the state + two effects into the hook (called ~700) changes their absolute position among App's
  effects, but **no other effect reads tour state**, and the two tour effects keep their relative order
  (init defined before auto-dismiss) inside the hook → behavior unchanged.
- `openTour` is referenced in `commandItems` (`useMemo`, 739); the hook (called ~700) returns it before
  739. ✓

## Design

### New `app/src/features/onboarding/useGuidedTour.ts`

```ts
import { useEffect, useState } from "react";
import { TOUR_STEPS } from "./GuidedTour";
import { safeLocalStorageGet, safeLocalStorageSet } from "../../lib/localStorage";
import type { Mode } from "../../lib/mode";

const TOUR_DISMISSED_KEY = "bible-ai-tour-dismissed-v1";
const PROVIDER_SETUP_DISMISSED_KEY = "bible-ai-provider-setup-dismissed-v1";

export function useGuidedTour({
  selectMode,
  providerSetupComplete,
}: {
  selectMode: (mode: Mode) => void;
  providerSetupComplete: boolean;
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourDismissed, setTourDismissed] = useState(true);
  const [providerSetupDismissed, setProviderSetupDismissed] = useState(true);

  useEffect(() => {
    const dismissed = safeLocalStorageGet(TOUR_DISMISSED_KEY) === "1";
    setTourDismissed(dismissed);
    setProviderSetupDismissed(safeLocalStorageGet(PROVIDER_SETUP_DISMISSED_KEY) === "1");
  }, []);

  const openTour = (stepIndex = 0) => {
    const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
    setTourStepIndex(stepIndex);
    setTourOpen(true);
    selectMode(step.mode);
  };

  const dismissTourPrompt = () => {
    safeLocalStorageSet(TOUR_DISMISSED_KEY, "1");
    setTourDismissed(true);
  };

  const dismissProviderSetupPrompt = () => {
    safeLocalStorageSet(PROVIDER_SETUP_DISMISSED_KEY, "1");
    setProviderSetupDismissed(true);
  };

  const closeTour = (dismiss = false) => {
    setTourOpen(false);
    if (dismiss) dismissTourPrompt();
  };

  const goToTourStep = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, nextIndex));
    const step = TOUR_STEPS[clamped];
    setTourStepIndex(clamped);
    selectMode(step.mode);
  };

  const showProviderSetupPrompt = !providerSetupComplete && !providerSetupDismissed;

  useEffect(() => {
    if (providerSetupComplete && !providerSetupDismissed) {
      dismissProviderSetupPrompt();
    }
  }, [providerSetupComplete, providerSetupDismissed]);

  return {
    tourOpen,
    tourStepIndex,
    tourDismissed,
    openTour,
    closeTour,
    goToTourStep,
    dismissTourPrompt,
    showProviderSetupPrompt,
    dismissProviderSetupPrompt,
  };
}
```

(All bodies are verbatim relocations of the App.tsx originals.)

### `app/src/App.tsx` (modify)

- **Remove:** the two key consts (84–85); the 4 state vars (147–150); the init effect (216–220); the 5
  handlers (665–692); the `showProviderSetupPrompt` derive (701) and the provider auto-dismiss effect
  (703–707).
- **Keep:** `selectMode` (659–663), `updateSearchQuery`/`searchActive` (694–699), and
  `const providerSetupComplete = settingsHasConfiguredAi(settings);` (700).
- **Add** import near the onboarding import: `import { useGuidedTour } from "./features/onboarding/useGuidedTour";`.
- **Insert** right after line 700 (`const providerSetupComplete = …`):
  ```tsx
  const {
    tourOpen,
    tourStepIndex,
    tourDismissed,
    openTour,
    closeTour,
    goToTourStep,
    dismissTourPrompt,
    showProviderSetupPrompt,
    dismissProviderSetupPrompt,
  } = useGuidedTour({ selectMode, providerSetupComplete });
  ```
- **Keep unchanged:** all consumer sites (772, 939–963, 972, 993, 1350, 1498–1504).

## Data flow / behavior

Unchanged. `useGuidedTour` owns the tour/onboarding state, effects, and handlers; `App()` injects
`selectMode` + `providerSetupComplete` and consumes the returned values exactly as before.

## Edge cases

- **No circular import:** `App.tsx` → `useGuidedTour`; `useGuidedTour` → (`react`, `./GuidedTour`,
  `lib/localStorage`, `lib/mode`). `GuidedTour` does not import `useGuidedTour`. One-directional.
- **`safeLocalStorageGet`/`Set` in App:** after this change App no longer uses `safeLocalStorageGet`
  (only the tour did) — its import must be dropped if unused; `safeLocalStorageSet` likewise. tsc flags
  unused imports → remove whichever become unused. (Verify: after F7, search App.tsx for remaining
  `safeLocalStorage*` uses; if none, drop the import entirely.)
- **`Mode` type import** stays in App (used widely); the hook imports its own `Mode`.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports (notably the now-possibly-unused
  `safeLocalStorage*` import in App).
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. Direct coverage: smoke *"opens the new user
  guide and steps through the main workflow"* exercises `openTour`/`goToTourStep`/`closeTour`/
  `tourStepIndex`; the Settings/release-readiness specs and provider-prompt render exercise
  `showProviderSetupPrompt`/`dismissProviderSetupPrompt`. NOTE: `smoke.spec.ts` Theology-linking tests are
  known-flaky — re-run `npm run test:e2e` (no rebuild) to confirm before treating as a real failure.
- No new test (behavior-preserving extraction).

## Risks & mitigations

- **A missed reference / dangling `safeLocalStorage*` import** → tsc fails the build.
- **Effect-ordering drift** → analyzed safe (no cross-effect dependency on tour state; relative order of
  the two tour effects preserved). The tour-walkthrough e2e is the behavioral guard.
- **Accidental logic edit during the move** → all handler/effect bodies are verbatim; reviewers diff the
  hook against the App.tsx originals.

## Rollout

Single feature branch `extract-use-guided-tour`. Files:
- **New:** `app/src/features/onboarding/useGuidedTour.ts`.
- **Modify:** `app/src/App.tsx` (remove state/consts/effects/handlers; add import + one destructuring hook
  call; drop any now-unused `safeLocalStorage*` import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
