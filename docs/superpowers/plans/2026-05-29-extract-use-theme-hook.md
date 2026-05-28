# Extract useTheme hook + localStorage helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `safeLocalStorageGet`/`safeLocalStorageSet` to `lib/localStorage.ts` and the theme slice (state + initializer + persistence effect) into a `useTheme()` hook in `lib/useTheme.ts`, verbatim behavior, zero behavior change. First `App()`-body hook extraction.

**Architecture:** Establish the `useXxx` hook pattern with the smallest self-contained slice. `useTheme` returns `{ theme, setTheme }` so the App call site is unchanged.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-extract-use-theme-hook-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (full suite as regression; `smoke.spec.ts` Theology tests are known-flaky — re-run `npm run test:e2e` to confirm). No new test.

---

## Task 1: Extract helpers + useTheme, rewire App.tsx

**Files:** Create `app/src/lib/localStorage.ts`, `app/src/lib/useTheme.ts`; modify `app/src/App.tsx`.

- [ ] **Step 1: Capture verbatim** from `App.tsx`: `safeLocalStorageGet`/`safeLocalStorageSet` (80–93) and the theme `useState` (109–111) + `useEffect` (112–115).

- [ ] **Step 2: Create `app/src/lib/localStorage.ts`** — paste both helpers verbatim, each with `export`:
```ts
export const safeLocalStorageGet = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const safeLocalStorageSet = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable; keep the in-memory state only */
  }
};
```

- [ ] **Step 3: Create `app/src/lib/useTheme.ts`:**
```ts
import { useEffect, useState } from "react";
import { safeLocalStorageSet } from "./localStorage";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    safeLocalStorageSet("bibleai-theme", theme);
  }, [theme]);
  return { theme, setTheme };
}
```

- [ ] **Step 4: Edit `App.tsx`:**
  - Delete the two helper consts (80–93) and the theme `useState`+`useEffect` (109–115).
  - Add near the other lib imports: `import { safeLocalStorageGet, safeLocalStorageSet } from "./lib/localStorage";` and `import { useTheme } from "./lib/useTheme";`.
  - At the spot where the theme state was (top of `App()`, before `searchQuery` state), insert: `const { theme, setTheme } = useTheme();`.
  - Leave unchanged: the toggle button (`setTheme((t) => (t === "dark" ? "light" : "dark"))`, `theme === "dark" ? …`, ~898–902) and the tour's `safeLocalStorageGet`/`Set` uses (~235/237/691/696).

- [ ] **Step 5: Unused-symbol check.** `safeLocalStorageGet` + `safeLocalStorageSet` must still be imported (tour uses both). `useState`/`useEffect` imports stay (used elsewhere). No now-unused imports.

- [ ] **Step 6: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix and re-run until clean.

- [ ] **Step 7: Commit:**
```bash
git add app/src/lib/localStorage.ts app/src/lib/useTheme.ts app/src/App.tsx
git commit -m "refactor(app): extract useTheme hook + localStorage helpers from App.tsx"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the three files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/ut.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/ut.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. If only the known-flaky `smoke.spec.ts` Theology tests fail, re-run `npm run test:e2e` (no rebuild) to confirm green. INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark extract-use-theme-hook spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** helpers → `lib/localStorage.ts` (Step 2); theme slice → `lib/useTheme.ts` returning `{ theme, setTheme }` (Step 3); App removes both + imports + one-line hook call, call sites unchanged (Step 4); build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** `useTheme` returns `{ theme, setTheme }` matching destructure; `safeLocalStorageGet`/`Set` exported and still imported by App (tour); one-directional imports (no cycle); Rules-of-Hooks preserved (unconditional top-level call in declaration order).
- **Placeholder scan:** `← verbatim` markers are explicit copy instructions; exact code + import lines + commit command given.
