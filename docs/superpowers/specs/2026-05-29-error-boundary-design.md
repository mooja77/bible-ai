# Robustness & Perf G1 — App-wide React ErrorBoundary — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `error-boundary`)
- **Theme:** G — Robustness & perf, sub-project 1 (first Theme G item)

## Problem

The app has **no React error boundary anywhere**. `main.tsx` renders `<App/>` raw inside
`<React.StrictMode>`. Any uncaught render-time throw in *any* panel (a malformed council payload,
an unexpected `null` in a verse list, a bad settings shape) unwinds the whole React tree to a blank
white window with **no message and no recovery path** — the user must hard-restart the app.

There is already a clean presentational `ErrorState` component (`components/StateViews.tsx`,
`role="alert"`, red card, title + `whitespace-pre-wrap` message) that the fallback can reuse.

## Goals

1. Add a reusable `ErrorBoundary` class component that catches render-time throws and shows a graceful,
   styled fallback (reusing `ErrorState`) with a recovery action instead of a white screen.
2. Place it so that:
   - **Top-level** (`main.tsx`, wrapping `<App/>`) catches shell/global crashes → offers **Reload app**.
   - **Per-content** (`App.tsx`, wrapping the `<main>` panel switch, **`key={mode}`**) catches a single
     panel's crash while leaving the sidebar `<nav>` alive — switching modes remounts the boundary and
     auto-recovers, so one bad panel never traps the user.
3. Log the error + component stack to the console (`componentDidCatch`) for diagnostics.

## Non-goals (YAGNI)

- No external error-reporting/telemetry integration (no Sentry, no backend log).
- No retry-with-state-preservation; recovery is remount (mode switch) or full reload.
- No change to any panel's own in-band error handling (the `error`/`warning` states in `App.tsx`,
  `ErrorState` usages inside panels) — those stay; the boundary is the *last-resort* net for throws
  those paths don't catch.
- No contrived crash-injection UI/test surface shipped in the product.

## Boundary analysis (from grounding)

- `main.tsx` (1–9): `createRoot(...).render(<React.StrictMode><App/></React.StrictMode>)`.
- `App.tsx`: `<aside class="app-sidebar">` nav (833) is a **sibling** of `<main id="main-content">`
  (1200). `<main>` renders a `warning` banner then a big `mode`-switch ternary (1217–end of main) that
  mounts every panel (Settings/Workspaces/Theology/Resources/Tags/Council/Reader).
- `ErrorState` (`components/StateViews.tsx`) — `{ message, title?, className? }`, `role="alert"`.
- No existing boundary, no `componentDidCatch`, no `getDerivedStateFromError` anywhere (grep clean).

## Design

### New `app/src/components/ErrorBoundary.tsx`

A small class component (boundaries must be classes — no hook equivalent):

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./StateViews";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Heading for the fallback card. */
  title?: string;
  /** Label for the recovery button. Omit to hide the button. */
  resetLabel?: string;
  /** Called when the recovery button is clicked (after clearing the caught error). */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnostics only — no telemetry. Surfaces in the WebView console.
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (error) {
      const { title = "Something went wrong", resetLabel } = this.props;
      const message = error.message || String(error);
      return (
        <div className="p-4" role="alert" data-testid="error-boundary-fallback">
          <ErrorState title={title} message={message} />
          {resetLabel ? (
            <button
              type="button"
              className="btn-secondary mt-3 px-3 py-1.5 text-sm"
              data-testid="error-boundary-reset"
              onClick={this.handleReset}
            >
              {resetLabel}
            </button>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
```

Notes:
- `data-testid="error-boundary-fallback"` / `"error-boundary-reset"` for any future e2e (not asserted now).
- `btn-secondary` is the app's existing button class (used by the tour CTA etc.).
- `ErrorState` already wraps with `role="alert"`; the outer wrapper also sets it — harmless, and keeps the
  fallback announced if `ErrorState` styling ever changes. (Acceptable double; revisit only if a11y audit flags.)

### `app/src/main.tsx` (modify)

Wrap `<App/>` with a top-level boundary whose recovery is a full reload:

```tsx
import { ErrorBoundary } from "./components/ErrorBoundary";
// …
<React.StrictMode>
  <ErrorBoundary
    title="The app hit an unexpected error"
    resetLabel="Reload app"
    onReset={() => window.location.reload()}
  >
    <App />
  </ErrorBoundary>
</React.StrictMode>
```

### `app/src/App.tsx` (modify)

Wrap the `<main>` panel-switch content in a per-content boundary keyed by `mode` so navigation recovers:

- Add `import { ErrorBoundary } from "./components/ErrorBoundary";` (path: `App.tsx` is in `src/`, so
  `"./components/ErrorBoundary"`).
- Inside `<main id="main-content">`, **after** the `warning` banner, wrap the existing big ternary
  (`{error ? … : … }`) in:
  ```tsx
  <ErrorBoundary key={mode} title="This view ran into a problem">
    {/* existing ternary, verbatim */}
  </ErrorBoundary>
  ```
  No `resetLabel` here — recovery is **switching modes** in the still-alive sidebar (the `key={mode}`
  remounts the boundary fresh on every mode change), so a dedicated button would be redundant.

## Data flow / behavior

- **Happy path (no throw):** boundary renders `children` transparently — *zero* behavior change. The
  existing e2e suite exercises every panel and must stay green, proving transparency.
- **Panel throw:** the per-content boundary shows the fallback inside `<main>`; the sidebar nav stays
  interactive; clicking another mode changes `mode` → `key` changes → boundary remounts → recovered.
- **Shell throw (outside `<main>`, e.g. sidebar/layout):** the top-level boundary shows the reload card.

## Edge cases

- **`error.message` empty** → fall back to `String(error)`.
- **StrictMode double-invoke** (dev only) — boundaries are unaffected; `getDerivedStateFromError` is pure.
- **Throw during the fallback render itself** → would bubble to the top-level boundary (per-content is
  inside it). Fallback is trivial (ErrorState + button) so this is effectively impossible.
- **`key={mode}` remount cost** — modes already fully swap their subtree on change today; adding a keyed
  boundary wrapper does not change what unmounts/mounts. No perf regression.

## Testing

- **`npm run build`** (tsc) + full **`npm run check`** green (the class component + `ErrorInfo`/`ReactNode`
  types must compile; `console.error` is allowed).
- **`npm run test:e2e:build`** — the entire suite must pass unchanged, proving the boundaries are
  transparent on the happy path (every panel still renders/behaves identically). Flaky-cascade re-run
  protocol applies.
- **No new e2e** — triggering a real render crash would require shipping a fault-injection control into the
  product (rejected as non-goal). The boundary's catch path is standard React; its *transparency* is what
  matters for users and is fully covered by the existing suite. The `data-testid`s are left in place for a
  future opt-in test if a natural crash surface ever appears.

## Risks & mitigations

- **Accidentally wrapping too much/too little of the `<main>` ternary** → tsc + the visual structure
  (wrap starts at `{error ? …` and ends at the ternary's final `)`) ; verified by build + full e2e (every
  panel must still render → boundary is correctly transparent and correctly scoped).
- **JSX nesting mistake** (unbalanced tags) → tsc fails immediately.
- **Import path wrong** → tsc fails.

## Rollout

Single feature branch `error-boundary`. Files:
- **New:** `app/src/components/ErrorBoundary.tsx`.
- **Modify:** `app/src/main.tsx` (top-level wrap), `app/src/App.tsx` (per-content keyed wrap + import).

Verify with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
