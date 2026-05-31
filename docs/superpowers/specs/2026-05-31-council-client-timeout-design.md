# Council client-side timeout — Design

- **Date:** 2026-05-31
- **Status:** Implemented
- **Theme:** Robustness / UX for non-technical users.

## Problem

A Council run has no client-side time limit; it relies on the backend's very
generous per-voice timeout (1800s). If a provider is slow, unreachable, or stuck,
the UI shows a spinner that can run for up to 30 minutes. To a non-technical user
that reads as "the app is broken" with no way out.

## Approach

Add a client-side **backstop** in `CouncilPanel`: race the `askCouncil` request
against a timer. If the timer wins, surface the existing council error UI
(title "The Council could not finish" + a "Try again" button) with a calm,
actionable message. The backstop is deliberately generous (**5 minutes**) — long
enough that legitimate slow runs almost never hit it (and the live elapsed counter
+ stage panel keep the user informed meanwhile), but far short of 30 minutes so a
genuine stall surfaces in reasonable time.

The losing `askCouncil` promise is left to resolve and is ignored (`Promise.race`
consumes it); the existing `requestId` guard already prevents any late result from
overwriting state.

## Testability

- Frontend: the timeout window can be shrunk by tests via
  `window.__BIBLE_AI_COUNCIL_TIMEOUT_MS__` (undefined in production → 5-min default).
- Sidecar: a `__FORCE_COUNCIL_SLOW__` sentinel in the mock-only branch delays the
  mock response by 2s, so a test (with a sub-second window) deterministically
  trips the backstop. Like `__FORCE_COUNCIL_ERROR__`, it is unreachable in a
  production build.

## What the test asserts

`tests/e2e/council-error.spec.ts` (2nd case): with a 600ms window and the slow
sentinel, the spinner ends with the "taking longer than expected" message, a
"Try again" button is offered, and no "Synthesis" appears. The window override is
restored in `finally` so later specs are unaffected.

## Out of scope (possible follow-up)

A softer reassurance line at ~60–90s ("still working — complex questions can take
a few minutes") *before* the hard backstop would further reassure non-technical
users. Not built here to keep the change tight; noted for later.
