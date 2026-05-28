# Extract useGuidedTour hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the guided-tour / onboarding slice (4 state vars, localStorage-init effect, 5 handlers, provider auto-dismiss effect, 2 key constants) out of `App.tsx` into `app/src/features/onboarding/useGuidedTour.ts`, behavior identical. Second `App()`-body hook.

**Architecture:** `useGuidedTour({ selectMode, providerSetupComplete })` returns the 9 values the render/commandItems consume. `selectMode` + `providerSetupComplete` stay in `App()` and are injected.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-extract-use-guided-tour-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (full suite as regression; smoke tour-walkthrough is direct coverage; Theology tests known-flaky → re-run `npm run test:e2e`). No new test.

---

## Task 1: Extract useGuidedTour, rewire App.tsx

**Files:** Create `app/src/features/onboarding/useGuidedTour.ts`; modify `app/src/App.tsx`.

- [ ] **Step 1: Capture verbatim** from `App.tsx`: state (147–150), key consts (84–85), init effect (216–220), handlers `openTour`/`dismissTourPrompt`/`dismissProviderSetupPrompt`/`closeTour`/`goToTourStep` (665–692), `showProviderSetupPrompt` (701), provider auto-dismiss effect (703–707).

- [ ] **Step 2: Create `app/src/features/onboarding/useGuidedTour.ts`** — use the exact code from the spec's Design section. Imports: `useEffect, useState` from "react"; `TOUR_STEPS` from "./GuidedTour"; `safeLocalStorageGet, safeLocalStorageSet` from "../../lib/localStorage"; `type Mode` from "../../lib/mode". The two key consts are module-private. Hook takes `{ selectMode, providerSetupComplete }` and returns `{ tourOpen, tourStepIndex, tourDismissed, openTour, closeTour, goToTourStep, dismissTourPrompt, showProviderSetupPrompt, dismissProviderSetupPrompt }`. Every state/effect/handler body must be byte-identical to the App.tsx originals.

- [ ] **Step 3: Edit `App.tsx`:**
  - Delete: the two key consts (84–85); the 4 tour state vars (147–150); the init effect (216–220); the 5 handlers (665–692); the `showProviderSetupPrompt` line (701) and the provider auto-dismiss effect (703–707).
  - Keep: `selectMode` (659–663), `updateSearchQuery`/`searchActive` (694–699), `const providerSetupComplete = settingsHasConfiguredAi(settings);` (700).
  - Add import near the onboarding import (line 69): `import { useGuidedTour } from "./features/onboarding/useGuidedTour";`.
  - Immediately after `const providerSetupComplete = settingsHasConfiguredAi(settings);`, insert the destructuring call:
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
  - Do NOT change any consumer site (772, 939–963, 972, 993, 1350, 1498–1504).

- [ ] **Step 4: Drop the now-unused localStorage import.** After Step 3, `App.tsx` no longer uses `safeLocalStorageGet`/`safeLocalStorageSet` (the tour was their last consumer — `useTheme` already owns the theme one). Remove the `import { safeLocalStorageGet, safeLocalStorageSet } from "./lib/localStorage";` line entirely. (Confirm by searching App.tsx for `safeLocalStorage` — expect zero remaining references before removing the import.)

- [ ] **Step 5: Unused-symbol check.** No other now-unused imports; `useState`/`useEffect`, `type Mode`, `settingsHasConfiguredAi`, `GuidedTour`/`TOUR_STEPS` all still used in App. `TOUR_STEPS` is still imported in App (used at 1349 for the theology-step lookup) — keep it.

- [ ] **Step 6: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix and re-run until clean.

- [ ] **Step 7: Commit:**
```bash
git add app/src/features/onboarding/useGuidedTour.ts app/src/App.tsx
git commit -m "refactor(app): extract useGuidedTour hook from App.tsx"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the two files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/gt.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/gt.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. If only the known-flaky `smoke.spec.ts` Theology tests fail, re-run `npm run test:e2e` (no rebuild) to confirm green. The tour-walkthrough smoke test is direct coverage — it MUST pass. INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark extract-use-guided-tour spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** tour state + 2 effects + 5 handlers + derived flag + 2 key consts → `useGuidedTour.ts` (Step 2); App removes them, injects `selectMode`/`providerSetupComplete`, consumes the 9 returns (Step 3); drops the dead `safeLocalStorage*` import (Step 4); build + full check + suite regression incl. tour-walkthrough (Tasks 1/2) ✓.
- **Type/name consistency:** hook input `{ selectMode: (mode: Mode) => void; providerSetupComplete: boolean }`; return object's 9 keys match App's destructure and every consumer site; one-directional imports (no cycle); Rules of Hooks preserved (unconditional call after `providerSetupComplete`, no early returns before it; `openTour` available before its `commandItems` use at 739).
- **Behavioral risk:** effect-ordering analyzed safe (no cross-effect dependency on tour state); the smoke tour-walkthrough e2e is the guard.
- **Placeholder scan:** spec Design block is the verbatim source; exact import line, insertion point, and commit command given.
