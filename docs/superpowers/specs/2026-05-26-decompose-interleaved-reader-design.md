# Decompose God-Components F3 — Extract InterleavedReader from App.tsx — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `decompose-interleaved-reader`)
- **Theme:** F — Decompose god-components, sub-project 3
- **Owner:** John Moore

## Problem

`App.tsx` is ~1,848 lines (after F1/F2). The next self-contained sibling is **`InterleavedReader`**
(lines ~1531–~1661, ~130 lines) — the parallel/interleaved reader layout. It's prop-driven, so
extracting it (plus the shared reader-layout types it needs) into `features/reader/` shrinks `App.tsx`
by ~130 lines with zero behavior change. Continues the F pattern (F1 GuidedTour, F2 NavigationShortcuts).

## Goals

1. Move `InterleavedReader` out of `App.tsx` into `features/reader/InterleavedReader.tsx`, verbatim.
2. Move the `ReaderLayout` + `ReaderDensity` types (App-only today) into a shared
   `features/reader/types.ts`, imported by both `App()` and the component — no duplication.
3. `App.tsx` compiles and behaves identically (the interleaved-layout e2e is the proof).

## Non-goals (YAGNI)

- No change to `InterleavedReader`'s markup/props/behavior — verbatim.
- No extraction of `ChapterReader` (the columns layout, already its own file) or other siblings here.
- No refactor of the `App()` body.

## Boundary analysis (from grounding)

- `InterleavedReader` props: `bookName, chapter, translations (Translation[]), chapterData
  (Record<string, Verse[]>), loading, fontScale (number), density (ReaderDensity), onJumpToVerse`.
  Body references only its props + `Translation`/`Verse` fields (no App helpers/components). The only
  non-`bible.ts` dependency is the `ReaderDensity` type.
- `ReaderLayout` (`"columns" | "interleaved"`) and `ReaderDensity` (`"comfortable" | "compact"`) are
  defined at `App.tsx` lines 90–91 and used **only in `App.tsx`** (settings state/handlers + the
  `density` prop). `ChapterReader` does not use these type names. → move the pair to a shared module.

## Design

### New `app/src/features/reader/types.ts`

```ts
export type ReaderLayout = "columns" | "interleaved";
export type ReaderDensity = "comfortable" | "compact";
```

### New `app/src/features/reader/InterleavedReader.tsx`

Moved verbatim, with imports:
```tsx
import type { Translation, Verse } from "../../lib/bible";
import type { ReaderDensity } from "./types";

export function InterleavedReader({ … }: { … }) {
  // ← moved verbatim from App.tsx (signature + body unchanged)
}
```
(No `react` import needed unless the body uses hooks — it does not; it's a pure presentational
function. Confirm: it uses no `useState`/`useEffect`. Import only the types it references.)

### `app/src/App.tsx`

- **Remove** the `ReaderLayout` + `ReaderDensity` type defs (lines 90–91) and the `InterleavedReader`
  function (~1531–~1661).
- **Add** imports near the other feature imports:
  ```tsx
  import { InterleavedReader } from "./features/reader/InterleavedReader";
  import type { ReaderLayout, ReaderDensity } from "./features/reader/types";
  ```
- **Keep** unchanged: the `<InterleavedReader … />` call site (~line 1429), and all `ReaderLayout`/
  `ReaderDensity` uses in `App()` (settings state `readerLayout`/`readerDensity`, the
  `setReaderLayoutSetting`/`setReaderDensitySetting` handlers, the `as ReaderLayout`/`as ReaderDensity`
  casts, the load defaults).

## Data flow / behavior

Unchanged. `App()` owns the reader layout/density state and passes `density`/`fontScale`/`translations`/
`chapterData` to `<InterleavedReader />`, which renders identically.

## Edge cases

- **No circular import:** `App.tsx` → `InterleavedReader.tsx` → (`lib/bible`, `./types`); none import
  `App.tsx`. One-directional.
- **`ReaderLayout` used only by App, `ReaderDensity` by both:** App imports both from `./features/
  reader/types`; `InterleavedReader` imports only `ReaderDensity`. tsc flags any unused import.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **`npm run test:e2e:build`** — the smoke e2e *"switches to interleaved compact layout for parallel
  translations"* enables ASV, switches layout=interleaved + density=compact, waits for
  `[data-testid="interleaved-reader"]`, and asserts both KJV + ASV render — a direct behavior-
  preservation check for `InterleavedReader`. All specs must pass.
- **Full `npm run check`** green (capture the REAL npm exit code).
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference** → tsc fails the build.
- **Accidental edit during the move** → must be verbatim; the interleaved-layout e2e renders the
  component with both translations, catching drift; reviewers diff the moved code.

## Rollout

Single feature branch `decompose-interleaved-reader`. Files:
- **New:** `app/src/features/reader/types.ts`, `app/src/features/reader/InterleavedReader.tsx`.
- **Modify:** `app/src/App.tsx` (remove the two type defs + the function; add two imports).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
