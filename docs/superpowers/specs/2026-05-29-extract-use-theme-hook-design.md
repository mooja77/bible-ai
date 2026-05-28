# Decompose God-Components F6 — Extract useTheme hook + localStorage helpers from App.tsx — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `extract-use-theme-hook`)
- **Theme:** F — Decompose god-components, sub-project 6 (first `App()`-body hook)

## Problem

`App.tsx` is ~1,529 lines. The top-level components and leaf helpers are now extracted (F1–F5). The
remaining F work is decomposing the ~1,100-line `App()` body. Rather than a big-bang custom-hook
refactor, this sub-project takes the **smallest, most self-contained state slice — theme — as the first
hook**, establishing the `useXxx` extraction pattern at near-zero risk before tackling the tangled
slices (search/council/navigation/settings).

The theme slice is fully isolated: `theme`/`setTheme` state + an initializer that reads
`document.documentElement`'s `data-theme` + one `useEffect` that writes the attribute and persists to
localStorage. Its only dependency is the module-private `safeLocalStorageSet` helper. Those localStorage
helpers (`safeLocalStorageGet`/`safeLocalStorageSet`) are **also** used by the tour slice (App.tsx
235/237/691/696), so they belong in a shared module regardless.

## Goals

1. Extract `safeLocalStorageGet`/`safeLocalStorageSet` (App.tsx 80–93) into `app/src/lib/localStorage.ts`,
   verbatim. App + the future tour hook import from there.
2. Extract the theme slice (state + initializer + persistence effect) into a `useTheme()` hook in
   `app/src/lib/useTheme.ts`, returning `{ theme, setTheme }`. Behavior identical.
3. `App.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to theme behavior (same default, same `data-theme` attribute, same `bibleai-theme` key, same
  toggle).
- No extraction of the tour/search/council/settings slices — those are separate, riskier sub-projects.
- No new abstraction over localStorage beyond moving the two existing helpers verbatim.

## Boundary analysis (from grounding)

- **`safeLocalStorageGet`/`safeLocalStorageSet`** (App.tsx 80–93): generic try/catch wrappers over
  `window.localStorage`. Used by the theme effect (`Set`, 114) and the tour slice (`Get` 235/237, `Set`
  691/696). → move both to `lib/localStorage.ts`; App keeps importing both (tour still uses them);
  `useTheme` imports only `safeLocalStorageSet`.
- **Theme slice** (App.tsx 109–115): `const [theme, setTheme] = useState<"light"|"dark">(() =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark")` +
  `useEffect(() => { document.documentElement.setAttribute("data-theme", theme);
  safeLocalStorageSet("bibleai-theme", theme); }, [theme])`. Consumed in render only at the theme-toggle
  button (898–902): `setTheme((t) => (t === "dark" ? "light" : "dark"))`, `theme === "dark" ? …`. No other
  state/effect references `theme`/`setTheme`. → encapsulate in `useTheme()` returning `{ theme, setTheme }`
  so the call site is unchanged.

## Design

### New `app/src/lib/localStorage.ts`

```ts
export const safeLocalStorageGet = (key: string) => {
  // ← verbatim from App.tsx 80–86
};

export const safeLocalStorageSet = (key: string, value: string) => {
  // ← verbatim from App.tsx 87–93
};
```

### New `app/src/lib/useTheme.ts`

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

### `app/src/App.tsx` (modify)

- **Remove** the `safeLocalStorageGet`/`safeLocalStorageSet` consts (80–93) and the theme `useState` +
  `useEffect` (109–115).
- **Add** imports near the other lib imports:
  ```tsx
  import { safeLocalStorageGet, safeLocalStorageSet } from "./lib/localStorage";
  import { useTheme } from "./lib/useTheme";
  ```
- **Replace** the removed theme state/effect with: `const { theme, setTheme } = useTheme();` (place it
  where the `theme` state was, so declaration order relative to other hooks is preserved).
- **Keep** unchanged: the toggle button call site (898–902) and the tour's `safeLocalStorageGet`/`Set`
  uses (235/237/691/696).

## Data flow / behavior

Unchanged. `useTheme` owns the same state + effect; `App()` consumes `{ theme, setTheme }` exactly as
before. The `data-theme` attribute and `bibleai-theme` localStorage key are identical.

## Edge cases

- **No circular import:** `App.tsx` → (`lib/localStorage`, `lib/useTheme`); `useTheme` → (`react`,
  `lib/localStorage`). One-directional.
- **`useState`/`useEffect` imports in App** stay (used by many other hooks).
- **Hook ordering / Rules of Hooks:** `useTheme()` is called unconditionally at the top of `App()` where
  the theme state previously sat — ordering preserved, no conditional calls.
- **`safeLocalStorageGet` still used in App** (tour) → imported; tsc flags it if it became unused.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. The app renders under `useTheme` (the
  `data-theme` attribute drives all styling); the smoke suite loads the shell with the theme toggle
  present. NOTE: `smoke.spec.ts` Theology-linking tests are known-flaky (stale-element/search-render
  timing) — re-run `npm run test:e2e` (no rebuild) to confirm before treating as a real failure.
- No new test (behavior-preserving extraction; no theme-specific e2e exists, and adding one is optional).

## Risks & mitigations

- **A missed reference** → tsc fails the build.
- **Subtle behavior drift in the hook** → the state initializer + effect are moved verbatim into the hook;
  reviewers diff against the original; the toggle call site is unchanged.

## Rollout

Single feature branch `extract-use-theme-hook`. Files:
- **New:** `app/src/lib/localStorage.ts`, `app/src/lib/useTheme.ts`.
- **Modify:** `app/src/App.tsx` (remove helpers + theme state/effect; add two imports; one-line hook call).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
