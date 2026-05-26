# Extract GuidedTour from App.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `GuidedTour` + `TOUR_STEPS` + `TourStep` out of `App.tsx` into `features/onboarding/GuidedTour.tsx`, verbatim, with zero behavior change.

**Architecture:** Pure structural extraction. The new module exports `GuidedTour`, `TOUR_STEPS`, `TourStep`; keeps `TOUR_AUTO_ADVANCE_MS` private. `App.tsx` imports them and removes the local definitions. `TOUR_DISMISSED_KEY` + tour state/handlers stay in `App.tsx`.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-decompose-guided-tour-design.md`

**Verification:** `npm run build` (tsc catches dangling refs) + the full-tour e2e (`smoke.spec.ts` "opens the new user guide…") + full `npm run check` + `npm run test:e2e:build`. No new test (behavior-preserving move).

---

## Task 1: Move GuidedTour into its own module

**Files:** Create `app/src/features/onboarding/GuidedTour.tsx`; modify `app/src/App.tsx`.

- [ ] **Step 1: Read the exact source ranges in `App.tsx`** (to move verbatim):
  - `TourStep` type — around line 96 (`type TourStep = { … }`).
  - `TOUR_AUTO_ADVANCE_MS` — around line 108 (`const TOUR_AUTO_ADVANCE_MS = 6500;`).
  - `TOUR_STEPS` — around lines 110–201 (`const TOUR_STEPS: TourStep[] = [ … ];`).
  - `GuidedTour` — around lines 2182–2392 (`function GuidedTour({ … }) { … }`).
  Note the exact text of each; the move must be byte-identical (no edits to logic/markup/content).

- [ ] **Step 2: Create `app/src/features/onboarding/GuidedTour.tsx`** with:

```tsx
import { useEffect, useState } from "react";

export type TourStep = {
  // ← paste the exact body of the TourStep type from App.tsx
};

const TOUR_AUTO_ADVANCE_MS = 6500;

export const TOUR_STEPS: TourStep[] = [
  // ← paste the exact TOUR_STEPS array contents from App.tsx
];

export function GuidedTour({
  steps,
  currentIndex,
  onStepChange,
  onClose,
  onFinish,
}: {
  steps: TourStep[];
  currentIndex: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  // ← paste the exact GuidedTour body from App.tsx (verbatim)
}
```

(`export type TourStep`, `export const TOUR_STEPS`, `export function GuidedTour`; `TOUR_AUTO_ADVANCE_MS` stays private/non-exported. The only import needed is `useEffect, useState` — confirm `GuidedTour`'s body uses no other identifiers from `App.tsx`; it should not.)

- [ ] **Step 3: Edit `App.tsx`** — remove the four moved definitions (`TourStep` type, `TOUR_AUTO_ADVANCE_MS`, `TOUR_STEPS`, `GuidedTour` function) and add the import near the other feature imports (e.g. by the `TagBrowser` import):

```tsx
import { GuidedTour, TOUR_STEPS, type TourStep } from "./features/onboarding/GuidedTour";
```

Keep everything else unchanged: `TOUR_DISMISSED_KEY` (~line 106), `tourStepIndex` state, `goToTourStep`, the `TOUR_STEPS.findIndex((step) => step.id === "theology")` usage (~1471), and the `<GuidedTour steps={TOUR_STEPS} … />` call site (~1621).

- [ ] **Step 4: Check for unused imports/symbols in `App.tsx`.** After removing the definitions, ensure: `TourStep` is still referenced in `App.tsx` (if it is only used via `TOUR_STEPS` which is now imported as a value, `type TourStep` may be unused → if so, drop it from the import to avoid a lint/tsc error); `useEffect`/`useState` remain used by `App()` (they do); no leftover reference to `TOUR_AUTO_ADVANCE_MS` in `App.tsx` (it was GuidedTour-only).

- [ ] **Step 5: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds. A dangling reference or unused import fails here — fix by adjusting the import (e.g. drop `type TourStep` if unused) or restoring a symbol that App still needs.

- [ ] **Step 6: Commit**

```bash
git add app/src/features/onboarding/GuidedTour.tsx app/src/App.tsx
git commit -m "refactor(app): extract GuidedTour + TOUR_STEPS into features/onboarding"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`, capture the real exit: `npm run check > /tmp/gt.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/gt.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass, especially `smoke.spec.ts` *"opens the new user guide and steps through the main workflow"* (the full tour walkthrough — the behavior-preservation proof). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-guided-tour spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** GuidedTour + TOUR_STEPS + TourStep moved into a new module, TOUR_AUTO_ADVANCE_MS private, TOUR_DISMISSED_KEY + tour state stay in App (Task 1) ✓; verbatim move / no behavior change (Step 1–2 "paste exact") ✓; App import + cleanup (Steps 3–4) ✓; build + tour e2e + full check (Tasks 1/2) ✓.
- **Type/name consistency:** the new module exports match App's import (`{ GuidedTour, TOUR_STEPS, type TourStep }`); GuidedTour's prop shape unchanged; `TOUR_STEPS: TourStep[]` resolves with both imported; one-directional import (no cycle).
- **Placeholder scan:** the `// ← paste …` markers are explicit verbatim-copy instructions (the only honest way to specify a byte-identical move of a 200+-line component), not vague placeholders; every command + exact import line is given.
