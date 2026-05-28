# Decompose God-Components F5 — Extract leaf-helper batch from App.tsx — Design

- **Date:** 2026-05-28
- **Status:** Draft (branch `decompose-helper-batch`)
- **Theme:** F — Decompose god-components, sub-project 5
- **Owner:** John Moore

## Problem

`App.tsx` is ~1,619 lines (after F1–F4). The clean self-contained *components* are extracted; what
remains at the top level is a batch of small leaf helpers defined at the bottom of the file
(lines ~1526–1617): two reference-parsing functions, one settings predicate, one nav button, and one
reader placeholder card. Moving them into the right `lib/`/`features/` modules finishes the top-level
cleanup of `App.tsx` and removes ~90 more lines with effectively zero behavior change. The remaining F
work (the `App()` body via custom hooks, `CouncilPanel`) is riskier and separate.

## Goals

1. Move the four leaf helpers out of `App.tsx` into appropriate modules, verbatim where possible.
2. `App.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to any helper's logic/markup/signature — verbatim (the sole exception is the forced
  `EmptyState` rename, see below — its body is unchanged).
- No refactor of the `App()` body, and no consolidation of the renamed placeholder with
  `StateViews.EmptyState` (they are genuinely different components; merging is out of scope).
- No new tests (behavior-preserving moves; existing e2e exercises the call sites).

## Boundary analysis (from grounding)

All five functions are module-private in `App.tsx` (only `App` is default-exported), so moving them out
and importing is purely internal — no external module references them today.

- **`parseReference(input, books: Book[])`** (App.tsx 1526–1568) — parses a reference string into a
  verse-id range + citation. References only `Book` fields + `normalizeReferenceBook`. Used once
  (App.tsx:607). → `lib/verse.ts`, which already imports `Book` and owns verse-id↔citation logic
  (`formatVerseId`). Export it.
- **`normalizeReferenceBook(value)`** (1570–1572) — used **only** inside `parseReference` (1530, 1540).
  → move into `lib/verse.ts` as a **private** (non-exported) helper.
- **`settingsHasConfiguredAi(settings: AppSettings)`** (1574–1581) — pure predicate. Used once
  (App.tsx:715). → new `lib/settings.ts`, importing `AppSettings` from `./bible`. Export it.
- **`ModeButton({active, onClick, label})`** (1583–1606) — pure presentational nav button. Used 7×
  (App.tsx 916–946). No `Mode`/App dependency. → new `features/app-shell/ModeButton.tsx`. Export it.
- **local `EmptyState({title, detail})`** (1608–1617) — a centered `soft-card` placeholder. Used 2×
  (App.tsx 1395, 1397, the reader "select a book"/"select a translation" placeholders).
  **Name collision:** `app/src/components/StateViews.tsx` already exports a *different* `EmptyState`
  (`{message, className}`, an italic `<p>`), imported by `VersePanel`/`StrongsPopup`. → move to new
  `features/reader/ReaderPlaceholder.tsx` **renamed `ReaderPlaceholder`** (body verbatim); update the
  two call sites. This is the only non-verbatim change in the batch.

## Design

### `app/src/lib/verse.ts` (modify)

Append `parseReference` (exported) + `normalizeReferenceBook` (private), moved verbatim. Module already
has `import type { Book } from "./bible";`.

### New `app/src/lib/settings.ts`

```ts
import type { AppSettings } from "./bible";

export function settingsHasConfiguredAi(settings: AppSettings) {
  // ← verbatim body from App.tsx
}
```

### New `app/src/features/app-shell/ModeButton.tsx`

```tsx
export function ModeButton({ active, onClick, label }: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  // ← verbatim body from App.tsx
}
```
(No `react` import — no hooks, JSX only.)

### New `app/src/features/reader/ReaderPlaceholder.tsx`

```tsx
export function ReaderPlaceholder({ title, detail }: { title: string; detail: string }) {
  // ← verbatim body of App.tsx's local EmptyState (renamed only)
}
```

### `app/src/App.tsx` (modify)

- **Remove** all five functions (1526–1617).
- **Add** imports near the existing feature/lib imports:
  ```tsx
  import { ModeButton } from "./features/app-shell/ModeButton";
  import { ReaderPlaceholder } from "./features/reader/ReaderPlaceholder";
  import { formatVerseId, parseReference } from "./lib/verse";   // extend the existing verse import
  import { settingsHasConfiguredAi } from "./lib/settings";
  ```
- **Update** the two placeholder call sites (1395, 1397): `<EmptyState …/>` → `<ReaderPlaceholder …/>`
  (props `title`/`detail` unchanged).
- **Keep** unchanged: the `parseReference(referenceInput, books)` call (607), the
  `settingsHasConfiguredAi(settings)` call (715), and all 7 `<ModeButton …/>` call sites (916–946).

## Data flow / behavior

Unchanged. `App()` still owns all state and call sites; the moved helpers are pure functions/components
invoked identically.

## Edge cases

- **No circular imports:** `App.tsx` → (`lib/verse`, `lib/settings`, `features/app-shell/ModeButton`,
  `features/reader/ReaderPlaceholder`); each imports only `react`/types/`lib/bible`. One-directional.
  `lib/verse.ts` already depends on `lib/bible` (type-only) — unchanged.
- **`Book` still used in App:** the `type Book` import from `lib/bible` stays (App uses `Book` in many
  places); `parseReference` no longer needs it locally but imports it from `lib/verse`'s own dependency.
- **`EmptyState` name:** App no longer references the local `EmptyState`; the `ErrorState` import from
  `StateViews` is untouched. No stray `EmptyState` import is added to App (it uses `ReaderPlaceholder`).

## Testing

- **`npm run build`** (tsc) — catches any dangling reference, unused import, or missed call-site rename.
  For verbatim moves a clean type-check is a strong correctness signal.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. Relevant coverage: the reference-jump flow
  exercises `parseReference`; sidebar mode switching exercises `ModeButton`; the reader placeholders
  ("select a book"/"select a translation") render via existing reader specs.
- No new test (behavior-preserving move/rename).

## Risks & mitigations

- **A missed reference / missed call-site rename** → tsc fails the build (the old `EmptyState` name
  would be undefined).
- **Accidental edit during the move** → must be verbatim; reviewers diff each moved helper against the
  original; tsc + the suite confirm no breakage.
- **Picking the wrong `EmptyState`** → the rename to `ReaderPlaceholder` makes the two unambiguous;
  `StateViews.EmptyState` is untouched.

## Rollout

Single feature branch `decompose-helper-batch`. Files:
- **New:** `app/src/lib/settings.ts`, `app/src/features/app-shell/ModeButton.tsx`,
  `app/src/features/reader/ReaderPlaceholder.tsx`.
- **Modify:** `app/src/lib/verse.ts` (append two functions), `app/src/App.tsx` (remove five functions,
  add four imports, rename two call sites).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
