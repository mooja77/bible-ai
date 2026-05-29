# Wire guided-tour actionLabel into an "Open {mode}" CTA Implementation Plan

> **Sub-skill:** focused feature work (inline). Additive UI + one e2e assertion.

**Goal:** Render the dead `actionLabel` as an "Open {mode}" footer CTA that navigates + dismisses + closes the tour.

**Spec:** `docs/superpowers/specs/2026-05-29-tour-action-cta-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (smoke tour test extended with one assertion; flaky-cascade protocol).

---

## Task 1: Implement the CTA

- [ ] **Step 1: `GuidedTour.tsx`** — add `onAction: (mode: Mode) => void` to the destructured props + the props type. In the footer right-hand group, immediately before the "Do not show prompt" button, render the `{step.actionLabel && (<button … data-testid="tour-action" onClick={() => onAction(step.mode)} className="btn-secondary px-3 py-1.5 text-sm">{step.actionLabel}</button>)}` block.
- [ ] **Step 2: `App.tsx`** — add `onAction={(mode) => { selectMode(mode); closeTour(true); }}` to the `<GuidedTour … />` props (alongside onStepChange/onClose/onFinish).
- [ ] **Step 3: `tests/e2e/smoke.spec.ts`** — in the tour test, after the assertion that the reader step ("Read, compare, and navigate Scripture") is shown (~line 77), add `await expect(await tour.$("button=Open Reader")).toBeDisplayed();`. Do NOT click it.
- [ ] **Step 4: Build** — `npm run build` clean.
- [ ] **Step 5: Commit:**
```bash
git add app/src/features/onboarding/GuidedTour.tsx app/src/App.tsx app/tests/e2e/smoke.spec.ts
git commit -m "feat(onboarding): surface tour actionLabel as an Open-{mode} CTA"
```
(Stage only these three; the unrelated `app/src-tauri/Cargo.toml` stays uncommitted.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1:** `npm run check > /tmp/ta.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/ta.log` → `NPM_EXIT=0`.
- [ ] **Step 2:** `npm run test:e2e:build` (600000 ms) → all pass incl. the extended smoke tour test. Flaky-cascade re-run protocol.
- [ ] **Step 3:** spec status → Implemented; commit.
- [ ] **Step 4:** ff-merge to main, push, delete branch.

---

## Self-Review (plan author)

- **Spec coverage:** `onAction` prop + actionLabel button (Step 1); App wiring (Step 2); e2e assertion (Step 3); build + check + suite (Task 2) ✓.
- **Safety:** additive button (new `data-testid`/label); existing tour controls + labels unchanged → smoke flow intact; only a display assertion added.
- **Behavior:** clicking navigates (mode already active) + persists dismissal + closes; steps without actionLabel render no button.
