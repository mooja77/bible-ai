# Robustness & Perf G2 — Global async-error notice — Design

- **Date:** 2026-05-30
- **Status:** Draft (branch `global-error-notice`)
- **Theme:** G — Robustness & perf, sub-project 2 (complements G1 ErrorBoundary)

## Problem

G1 added React error boundaries — but boundaries **only catch render-time throws**. They do *not* catch:
- Unhandled promise rejections (e.g. an `invoke(...)` chain in an event handler without a `.catch`).
- Errors thrown inside event handlers / `setTimeout` / async callbacks.

This app is full of `invoke().then(...)` calls; most set local error state, but any that don't (or any
genuinely unexpected async throw) currently **fail silently** — nothing surfaces to the user, and there is
no global diagnostic. That is the real robustness gap left after G1 (the roadmap's "cross-ref N+1" and
"pagination" items were verified to be non-issues: cross-refs are fetched lazily one verse at a time, the
council expansion loop is bounded, `AddToWorkspaceMenu` fetches only when opened, and search is
backend-capped at `limit = 50`).

## Goals

1. Install global `window` listeners for **`unhandledrejection`** and **`error`** that:
   - `console.error` the failure (diagnostics), and
   - surface a **non-blocking, dismissible** toast notice to the user so silent async failures become visible.
2. Filter known-benign noise (e.g. `ResizeObserver loop …`) so the notice stays trustworthy.
3. Auto-dismiss after a comfortable delay; manual **Dismiss** always available.
4. Mount once, globally, surviving even a render-crash fallback (placed as a sibling of the top-level
   `ErrorBoundary`).

## Non-goals (YAGNI)

- No telemetry/remote reporting.
- No queue/history UI — show the **most recent** message (replace on new error); a count is unnecessary.
- No change to any existing in-band `.catch` → local-error-state handling; this is a *last-resort net*.
- No retry/recovery action (async errors have no generic re-run).

## Boundary analysis (from grounding)

- `main.tsx` currently: `<React.StrictMode><ErrorBoundary …><App/></ErrorBoundary></React.StrictMode>`.
- The existing `ErrorState` (`components/StateViews.tsx`) is a *block* card; the global notice wants a
  *fixed-position toast*, so it gets its own compact markup (red palette consistent with `ErrorState`)
  rather than reusing `ErrorState` (different layout role). `role="alert"` for a11y parity.
- No existing global error handler anywhere (grep: no `addEventListener("error"`, no `unhandledrejection`).

## Design

### New `app/src/components/GlobalErrorNotice.tsx`

```tsx
import { useEffect, useState } from "react";

// Benign browser noise that should never alarm the user.
const IGNORED_PATTERNS = ["ResizeObserver loop"];

function describe(value: unknown): string {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === "string") return value;
  if (value == null) return "Unknown error";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function GlobalErrorNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const show = (raw: string) => {
      const text = raw.trim();
      if (!text || IGNORED_PATTERNS.some((p) => text.includes(p))) return;
      setMessage(text);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      show(describe(event.reason));
    };
    const onError = (event: ErrorEvent) => {
      console.error("Uncaught error:", event.error ?? event.message);
      show(describe(event.error ?? event.message));
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  // Auto-dismiss the current message after a comfortable delay.
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="alert"
      data-testid="global-error-notice"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-red-900/60 bg-red-950/90 px-4 py-3 text-sm text-red-200 shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold mb-1">Unexpected error</p>
          <p className="whitespace-pre-wrap break-words">{message}</p>
        </div>
        <button
          type="button"
          data-testid="global-error-dismiss"
          onClick={() => setMessage(null)}
          className="shrink-0 text-xs text-red-100 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

### `app/src/main.tsx` (modify)

Mount the notice as a **sibling of** the top-level `ErrorBoundary` so it persists even while the boundary
shows its fallback:

```tsx
import { GlobalErrorNotice } from "./components/GlobalErrorNotice";
// …
<React.StrictMode>
  <ErrorBoundary title="The app hit an unexpected error" resetLabel="Reload app" onReset={() => window.location.reload()}>
    <App />
  </ErrorBoundary>
  <GlobalErrorNotice />
</React.StrictMode>
```

## Data flow / behavior

- **No error:** renders `null` — zero visual/behavior change (existing suite stays green).
- **Async throw / unhandled rejection:** listener fires → `console.error` + toast with the message;
  auto-dismisses after 10s or on **Dismiss**.
- **Benign noise (ResizeObserver loop):** filtered — no toast.
- **StrictMode double-mount (dev):** `useEffect` cleanup removes listeners on unmount, so no duplicate
  handlers leak; production mounts once.

## Edge cases

- **Non-Error rejection values** (string / object / null) → `describe()` yields a readable string.
- **Rapid repeated errors** → latest replaces previous; the 10s timer resets on each new message.
- **Empty message** → filtered (`if (!text)`).
- **`error` events from cross-origin scripts** are sanitized by the browser to `"Script error."`; that's an
  acceptable (rare) toast — not filtered, since it still signals a real failure.

## Testing

- **`npm run build`** (tsc) + full **`npm run check`** green.
- **New e2e `tests/e2e/global-error-notice.spec.ts`** (registered LAST in `wdio.conf.mts`):
  1. `browser.url("/")`; dispatch a synthetic error via `browser.execute(() => window.dispatchEvent(new
     ErrorEvent("error", { message: "Synthetic test error", error: new Error("Synthetic test error") })))`
     — this exercises the real `window` listener through the test harness **without shipping any product
     fault surface** (unlike G1, which was untestable for that reason).
  2. Assert `[data-testid="global-error-notice"]` is displayed and contains `"Synthetic test error"`.
  3. Click `[data-testid="global-error-dismiss"]`; assert the notice is gone.
- **`npm run test:e2e:build`** — full suite incl. the new spec passes. Flaky-cascade re-run protocol.

## Risks & mitigations

- **Toast covers UI / is intrusive** → bottom-right, `max-w-sm`, auto-dismiss 10s, manual Dismiss; only
  shows on actual errors. Acceptable.
- **Listener leak under StrictMode** → `useEffect` cleanup removes both listeners.
- **False alarms from benign events** → `IGNORED_PATTERNS` filter (extensible in one place).
- **Synthetic-event test doesn't reflect a real rejection** → it dispatches a *standard* `ErrorEvent` that
  the production listener handles identically to a real one; the listener code path is the same.

## Rollout

Single feature branch `global-error-notice`. Files:
- **New:** `app/src/components/GlobalErrorNotice.tsx`, `app/tests/e2e/global-error-notice.spec.ts`.
- **Modify:** `app/src/main.tsx` (mount + import), `app/wdio.conf.mts` (register spec — preserve the file's
  BOM + double-spaced CRLF formatting; edit via PowerShell string-replace since the Edit tool mishandles
  the BOM).

Verify with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
