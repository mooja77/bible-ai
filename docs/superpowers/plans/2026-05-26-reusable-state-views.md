# Reusable Loading / Empty / Error State Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce shared `LoadingState` / `EmptyState` / `ErrorState` components and standardize the four inconsistent panel error blocks onto a single `role="alert"` `ErrorState`, while DRY-ing the reader's bare loading/empty text.

**Architecture:** New presentational module `app/src/components/StateViews.tsx`; mechanical swaps in five consuming files. No behavior change (pure presentational + `role="alert"`).

**Tech Stack:** React 19 + TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-26-reusable-state-views-design.md`

**Verification note:** No frontend unit runner; the states aren't deterministically triggerable in e2e, so verification is `npm run build` (types/imports for all six files) + full `npm run check` + the full `test:e2e:build` suite as regression (exercises Council/Workspaces/Reader happy paths) + manual smoke. No new e2e (documented in the spec).

---

## File Structure

- `app/src/components/StateViews.tsx` — **new**; `LoadingState`, `EmptyState`, `ErrorState`. *(Task 1)*
- `app/src/App.tsx` — **modify**; main error block → `ErrorState`. *(Task 1)*
- `app/src/features/council/CouncilPanel.tsx` — **modify**; main error + `saveError` → `ErrorState`. *(Task 1)*
- `app/src/features/workspaces/WorkspacesPanel.tsx` — **modify**; error line → `ErrorState`. *(Task 1)*
- `app/src/features/reader/StrongsPopup.tsx` — **modify**; loading/empty → `LoadingState`/`EmptyState`. *(Task 1)*
- `app/src/features/reader/VersePanel.tsx` — **modify**; `CrossRefsTab` loading/empty → `LoadingState`/`EmptyState`. *(Task 1)*

No backend/Rust/sidecar/type change.

---

## Task 1: Create `StateViews` and apply it

**Files:** all six above. READ each consuming file to locate the snippets by content (line numbers have drifted from earlier edits).

- [ ] **Step 1: Create `app/src/components/StateViews.tsx`**

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

- [ ] **Step 2: `App.tsx` — main error block → `ErrorState`**

Add the import near the other top-of-file imports: `import { ErrorState } from "./components/StateViews";`

Find this block:
```tsx
        {error ? (
          <div className="p-6 text-red-400 text-sm">
            <p className="font-semibold mb-1">Error</p>
            <pre className="whitespace-pre-wrap">{error}</pre>
          </div>
        ) : searchActive ? (
```
Replace the `<div …>…</div>` (the three-line error div) with `<ErrorState message={error} className="m-4" />`, leaving the surrounding `{error ? ( … ) : searchActive ? (` ternary intact:
```tsx
        {error ? (
          <ErrorState message={error} className="m-4" />
        ) : searchActive ? (
```

- [ ] **Step 3: `CouncilPanel.tsx` — main error + `saveError` → `ErrorState`**

Add the import: `import { ErrorState } from "../../components/StateViews";`

Main error — find:
```tsx
      {error && (
        <div className="border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300">
          <p className="font-semibold mb-1">Error</p>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
```
Replace with:
```tsx
      {error && <ErrorState message={error} />}
```

`saveError` — find:
```tsx
      {saveError && (
        <div className="border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300">
          {saveError}
        </div>
      )}
```
Replace with:
```tsx
      {saveError && <ErrorState message={saveError} title={null} />}
```
(The exact surrounding indentation may differ; match the actual `{saveError && (` block in the file.)

- [ ] **Step 4: `WorkspacesPanel.tsx` — error line → `ErrorState`**

Add the import: `import { ErrorState } from "../../components/StateViews";`

Find:
```tsx
        {error && <p className="text-sm text-red-300 mb-3">{error}</p>}
```
Replace with:
```tsx
        {error && <ErrorState message={error} title={null} className="mb-3" />}
```

- [ ] **Step 5: `StrongsPopup.tsx` — loading/empty → `LoadingState`/`EmptyState`**

Add the import: `import { LoadingState, EmptyState } from "../../components/StateViews";`

Find the entries loading/empty block:
```tsx
        {entries === null ? (
          <p className="text-neutral-500 italic text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-neutral-500 italic text-sm">
            No Strong's entries found for codes: {codes.join(", ") || "(none)"}
          </p>
        ) : (
```
Replace the two `<p>`s (keep the ternary structure):
```tsx
        {entries === null ? (
          <LoadingState />
        ) : entries.length === 0 ? (
          <EmptyState message={`No Strong's entries found for codes: ${codes.join(", ") || "(none)"}`} />
        ) : (
```

- [ ] **Step 6: `VersePanel.tsx` — `CrossRefsTab` loading/empty → `LoadingState`/`EmptyState`**

Add `LoadingState`, `EmptyState` to the import from `../../components/StateViews` (one import line: `import { LoadingState, EmptyState } from "../../components/StateViews";`).

In `CrossRefsTab`, find:
```tsx
  if (refs === null) return <p className="text-neutral-500 italic text-sm">Loading…</p>;
```
Replace with:
```tsx
  if (refs === null) return <LoadingState />;
```
And find the no-cross-references return (a `<p className="text-neutral-500 italic text-sm">No cross-references.</p>`), replace its `<p>…</p>` with `<EmptyState message="No cross-references." />` (keep the surrounding `if (…) return …;` / JSX structure exactly).

- [ ] **Step 7: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds. If an import path errors, recheck: `App.tsx` uses `./components/StateViews`; the `features/**` files use `../../components/StateViews`.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/StateViews.tsx app/src/App.tsx app/src/features/council/CouncilPanel.tsx app/src/features/workspaces/WorkspacesPanel.tsx app/src/features/reader/StrongsPopup.tsx app/src/features/reader/VersePanel.tsx
git commit -m "feat(a11y): shared StateViews (role=alert ErrorState + Loading/Empty)"
```

---

## Task 2: Full gate + regression + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0.

- [ ] **Step 2: E2E regression**

Run (from `app/`, allow ~10 min; 600000 ms timeout): `npm run test:e2e:build`
Expected: all specs pass (no new test; this is regression coverage that the refactored Council/Workspaces/Reader panels and the untouched `resource-empty-state` still render). If a spec fails, investigate the refactor in the relevant file.

- [ ] **Step 3: Manual smoke (recommended)**

Force an error (e.g., run the Council with no providers configured, or trigger a save failure) and confirm the `ErrorState` bordered box renders with the message; open the Strong's popup and the Cross-refs tab and confirm the loading/empty text still looks right.

- [ ] **Step 4: Update spec status**

In `docs/superpowers/specs/2026-05-26-reusable-state-views-design.md`, change `Status:` from `Draft` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-reusable-state-views-design.md
git commit -m "docs(a11y): mark reusable-state-views spec implemented"
```

- [ ] **Step 5: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** shared `LoadingState`/`EmptyState`/`ErrorState` (Step 1) ✓; `role="alert"` error block applied to all four inconsistent displays — App (Step 2), Council main + saveError (Step 3), Workspaces (Step 4) ✓; loading/empty DRY in StrongsPopup (Step 5) + VersePanel CrossRefsTab (Step 6) ✓; good custom states + field hints untouched (no task touches skeletons, Resources/Theology empty states, or `referenceError` lines) ✓; build + check + e2e regression + manual (Tasks 1/2) ✓.
- **Type consistency:** `ErrorState` props `{ message: string; title?: string | null; className?: string }` — `title={null}` used for saveError/Workspaces (allowed by `string | null`), default `"Error"` for App/Council main; `LoadingState` takes optional `label`; `EmptyState` takes `message: string`. Import specifiers match exports; paths: `App.tsx` → `./components/StateViews`, all `features/**` → `../../components/StateViews`.
- **Placeholder scan:** every step has complete code + exact commands; "match the actual block" notes are because earlier edits drifted line numbers — the content snippets to find are given verbatim.
