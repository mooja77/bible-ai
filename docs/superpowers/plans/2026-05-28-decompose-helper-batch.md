# Extract leaf-helper batch from App.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move four leaf helpers out of `App.tsx` into the right modules, verbatim (the sole exception is the forced `EmptyState`→`ReaderPlaceholder` rename), zero behavior change.

**Architecture:** Same verbatim-move pattern as F1–F4. `parseReference`/`normalizeReferenceBook` join `lib/verse.ts`; `settingsHasConfiguredAi` → new `lib/settings.ts`; `ModeButton` → new `features/app-shell/ModeButton.tsx`; the local `EmptyState` card → new `features/reader/ReaderPlaceholder.tsx` (renamed to avoid colliding with `StateViews.EmptyState`).

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-28-decompose-helper-batch-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (full suite as regression). No new test.

---

## Task 1: Move the four helpers + rewire App.tsx

**Files:** Modify `app/src/lib/verse.ts`; create `app/src/lib/settings.ts`, `app/src/features/app-shell/ModeButton.tsx`, `app/src/features/reader/ReaderPlaceholder.tsx`; modify `app/src/App.tsx`.

- [ ] **Step 1: Read & capture verbatim** from `App.tsx`: `parseReference` (1526–1568), `normalizeReferenceBook` (1570–1572), `settingsHasConfiguredAi` (1574–1581), `ModeButton` (1583–1606), and the local `EmptyState` (1608–1617). Confirm each references only its params/props + (for parseReference) `normalizeReferenceBook` + `Book` fields + (settingsHasConfiguredAi) `AppSettings`. If any references another `App.tsx` identifier, STOP and report.

- [ ] **Step 2: `lib/verse.ts`** — append `parseReference` (add `export`) and `normalizeReferenceBook` (NO export — private helper) verbatim below `formatVerseId`. The existing `import type { Book } from "./bible";` already covers `parseReference`'s needs.

- [ ] **Step 3: Create `app/src/lib/settings.ts`:**
```ts
import type { AppSettings } from "./bible";

export function settingsHasConfiguredAi(settings: AppSettings) {
  // ← verbatim body from App.tsx
}
```

- [ ] **Step 4: Create `app/src/features/app-shell/ModeButton.tsx`** — paste the exact `ModeButton` function with `export` added. No `react` import (JSX only, no hooks).

- [ ] **Step 5: Create `app/src/features/reader/ReaderPlaceholder.tsx`** — paste the exact body of the local `EmptyState`, renamed to `ReaderPlaceholder`, with `export`:
```tsx
export function ReaderPlaceholder({ title, detail }: { title: string; detail: string }) {
  // ← verbatim body (markup unchanged)
}
```

- [ ] **Step 6: Edit `App.tsx`:** delete all five functions (1526–1617). Add imports near the other feature/lib imports, and extend the existing `lib/verse` import:
```tsx
import { ModeButton } from "./features/app-shell/ModeButton";
import { ReaderPlaceholder } from "./features/reader/ReaderPlaceholder";
import { settingsHasConfiguredAi } from "./lib/settings";
```
Change `import { formatVerseId } from "./lib/verse";` → `import { formatVerseId, parseReference } from "./lib/verse";`. Rename the two placeholder call sites (1395, 1397): `<EmptyState …/>` → `<ReaderPlaceholder …/>` (props unchanged). Keep unchanged: the `parseReference(referenceInput, books)` call (607), `settingsHasConfiguredAi(settings)` (715), and all 7 `<ModeButton …/>` sites (916–946).

- [ ] **Step 7: Unused-symbol check.** Ensure no now-unused imports remain in `App.tsx` (e.g. it must NOT import `EmptyState` from `StateViews`; the `ErrorState` import stays). `Book` type import stays (used elsewhere in App).

- [ ] **Step 8: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix and re-run until clean.

- [ ] **Step 9: Commit:**
```bash
git add app/src/lib/verse.ts app/src/lib/settings.ts app/src/features/app-shell/ModeButton.tsx app/src/features/reader/ReaderPlaceholder.tsx app/src/App.tsx
git commit -m "refactor(app): extract leaf-helper batch (parseReference/settingsHasConfiguredAi/ModeButton/ReaderPlaceholder) from App.tsx"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`, capture the real exit: `npm run check > /tmp/hb.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/hb.log` → expect `NPM_EXIT=0`. (cargo fmt/clippy unaffected — frontend-only change, but the gate runs the whole suite.)
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass (full-suite regression). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-helper-batch spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** `parseReference`+`normalizeReferenceBook` → `lib/verse.ts` (Step 2); `settingsHasConfiguredAi` → `lib/settings.ts` (Step 3); `ModeButton` → `features/app-shell/ModeButton.tsx` (Step 4); local `EmptyState` → `features/reader/ReaderPlaceholder.tsx` renamed (Step 5); App removes all five + imports + renames call sites (Step 6); verbatim/no-behavior-change; build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** new modules export `{ parseReference }`/`{ settingsHasConfiguredAi }`/`{ ModeButton }`/`{ ReaderPlaceholder }` matching App's imports; `normalizeReferenceBook` stays private (only `parseReference` uses it); one-directional imports (no cycle); `ReaderPlaceholder` rename resolves the `StateViews.EmptyState` collision.
- **Placeholder scan:** `← verbatim body` markers are explicit verbatim-copy instructions; exact import lines + commit commands given.
