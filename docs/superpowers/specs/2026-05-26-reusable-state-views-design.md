# Reusable Loading / Empty / Error State Components — Design

- **Date:** 2026-05-26
- **Status:** Draft (branch `reusable-state-views`)
- **Theme:** C — Accessibility & polish, sub-project 4
- **Owner:** John Moore

## Problem

Panels render their loading / empty / error states ad hoc and inconsistently. The clearest offender
is **error blocks** — the same kind of failure looks different in each panel:

- `App.tsx` main error: `<div className="p-6 text-red-400 text-sm"><p className="font-semibold mb-1">Error</p><pre className="whitespace-pre-wrap">{error}</pre></div>` (no border, `text-red-400`).
- `CouncilPanel` main error: `<div className="border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300"><p className="font-semibold mb-1">Error</p><pre className="whitespace-pre-wrap">{error}</pre></div>` (bordered box).
- `CouncilPanel` `saveError`: the same bordered box but plain text, no "Error" heading.
- `WorkspacesPanel` error: `<p className="text-sm text-red-300 mb-3">{error}</p>` (bare line).

None use `role="alert"`, so errors aren't announced to screen readers. Loading/empty text is also
duplicated as bare `<p className="text-neutral-500 italic text-sm">…</p>` in `StrongsPopup` and
`VersePanel`.

## Goals

1. One consistent, **`role="alert"`** error block used by the panel-level error displays.
2. Reusable `LoadingState` / `EmptyState` primitives that DRY the bare loading/empty text (no visual
   regression).
3. No change to the *good* custom states or to inline field-validation hints (see non-goals).

## Non-goals (YAGNI)

- **Don't touch the rich/intentional states:** the `ChapterReader`/`App` skeleton loaders
  (`aria-label="Loading chapter"`), the `resource-empty-state`, the `theology-empty-state`. These
  are deliberately richer and stay as-is.
- **Don't touch inline field-validation hints:** the bare `referenceError` red lines
  (`App.tsx`, `<p className="text-xs text-red-300">`), `CouncilPanel`'s "Could not attach this
  session." — these are contextual field hints, not panel error blocks.
- **No retry affordance** on `ErrorState` — none of the current error blocks have one.
- **No icons / spinners / animation redesign** — keep the existing visual vocabulary.
- No backend/Rust/sidecar/type change.

## Approach

A small presentational module `app/src/components/StateViews.tsx` (new `components/` dir — these are
cross-cutting shared UI, not feature- or util-specific) exporting three components; apply
`ErrorState` to the four inconsistent error displays and `LoadingState`/`EmptyState` to the reader's
bare loading/empty text.

## Design

### `app/src/components/StateViews.tsx` (new)

```tsx
export function LoadingState({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return <p className={`text-neutral-500 italic text-sm ${className}`}>{label}</p>;
}

export function EmptyState({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return <p className={`text-neutral-500 italic text-sm ${className}`}>{message}</p>;
}

export function ErrorState({
  message,
  title = "Error",
  className = "",
}: {
  message: string;
  title?: string | null;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300 ${className}`}
    >
      {title ? <p className="font-semibold mb-1">{title}</p> : null}
      <pre className="whitespace-pre-wrap">{message}</pre>
    </div>
  );
}
```

`LoadingState`/`EmptyState` reproduce the existing `text-neutral-500 italic text-sm` line exactly
(pure DRY). `ErrorState` standardizes on `CouncilPanel`'s bordered box (the nicest existing
treatment) and adds `role="alert"`. The trailing-space-in-template className is harmless (Tailwind
ignores extra whitespace).

### Applications

**Error blocks → `ErrorState`:**

- `App.tsx` main error (currently `<div className="p-6 text-red-400 text-sm">…</div>`):
  `<ErrorState message={error} className="m-4" />` (the `m-4` keeps it spaced in the `<main>` area,
  matching the warning banner above it).
- `CouncilPanel` main error block: `<ErrorState message={error} />`.
- `CouncilPanel` `saveError` block: `<ErrorState message={saveError} title={null} />` (contextual —
  no heading, matching today).
- `WorkspacesPanel` error: `<ErrorState message={error} title={null} className="mb-3" />` (keeps the
  `mb-3` spacing; upgrades the bare line to the consistent box).

**Loading/empty → `LoadingState`/`EmptyState`:**

- `StrongsPopup`: the `Loading…` `<p>` → `<LoadingState />`; the "No Strong's entries found for
  codes: …" `<p>` → `<EmptyState message={`No Strong's entries found for codes: ${codes.join(", ") || "(none)"}`} />`.
- `VersePanel` `CrossRefsTab`: `if (refs === null) return <LoadingState />;` and the
  `No cross-references.` `<p>` → `return <EmptyState message="No cross-references." />;`.

Each consuming file imports from the new module, e.g.
`import { ErrorState } from "../../components/StateViews";` (path depth depends on the file:
`App.tsx` → `./components/StateViews`; `features/**` → `../../components/StateViews`).

## Data flow / behavior

No behavior change — these are presentational swaps. The only runtime difference is the four error
displays now share one bordered `role="alert"` box (so the App main error becomes a bordered box
with `m-4` spacing instead of a borderless `p-6` block; `saveError` and the Workspaces error become
the bordered box). Loading/empty visuals are byte-identical to before.

## Edge cases

- **Multi-line / long error text:** preserved by `<pre className="whitespace-pre-wrap">` (same as
  the prior App/Council blocks).
- **`title={null}`:** renders the message only (saveError / Workspaces) — no empty heading element.
- **`role="alert"` announcing on mount:** correct — these blocks render only when an error exists
  (conditional), so the alert fires when the error appears.

## Testing

These states can't be triggered deterministically in e2e (would require inducing real failures), and
this is a pure presentational/DRY refactor plus `role="alert"`. Verification (mirroring the
council-run-progress sub-project's build+manual approach):

- **`npm run build`** (tsc + vite) clean — catches prop/type/import errors in all six files.
- Full **`npm run check`** green.
- **`npm run test:e2e:build`** green as **regression coverage** — the suite exercises Council,
  Workspaces, and Reader happy paths, proving the refactored panels still render correctly (and the
  untouched `resource-empty-state` test still passes).
- **Manual smoke:** force an error (e.g., a Council run with no providers, or a save failure) and
  confirm the `ErrorState` box renders with the message; confirm the Strong's popup loading/empty
  and the Cross-refs empty still look right.
- **No new e2e** — documented rationale above.

## Risks & mitigations

- **Import path depth wrong** in a consuming file → `npm run build` fails fast; each path is
  specified per file (App.tsx is one level above `components/`; `features/**` is two).
- **App main error layout shift** (borderless `p-6` → bordered `m-4` box) → intended consistency
  change; the bordered box is the better, clearer treatment and matches the other panels.
- **Over-reach into good custom states** → explicitly out of scope (skeletons, Resources/Theology
  empty states, inline field hints listed in non-goals).
- **Weaker verification (no new e2e)** → acceptable for a presentational refactor; the full e2e
  suite as regression + types + manual smoke cover it; `role="alert"` is standard and low-risk.

## Rollout

Single feature branch `reusable-state-views`. Files:
- **New:** `app/src/components/StateViews.tsx`.
- **Modify:** `app/src/App.tsx`, `app/src/features/council/CouncilPanel.tsx`,
  `app/src/features/workspaces/WorkspacesPanel.tsx`, `app/src/features/reader/StrongsPopup.tsx`,
  `app/src/features/reader/VersePanel.tsx`.

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
