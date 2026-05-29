# Onboarding & Settings D4 — Accessibility for the settings validation messages — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `settings-validation-a11y`)
- **Theme:** D — Onboarding & settings, sub-project 4 (closes the loop on D1)

## Problem

D1 added advisory inline validation messages (gateway URL / Ollama host errors, gateway-token warning),
but they are visual-only — not programmatically associated with their inputs. Screen-reader users get no
indication that a field is invalid or why. This sub-project wires the messages to their inputs via
`aria-invalid` + `aria-describedby` so assistive tech announces them.

## Goals

1. Mark the gateway URL / Ollama host inputs `aria-invalid` when their value is malformed.
2. Associate each input with its message via `aria-describedby` (errors + the token warning).

## Non-goals (YAGNI)

- No change to the validation logic, copy, or the (advisory, non-blocking) behavior.
- No broader settings-form a11y rework (the `Field` component's implicit label-wrap association is valid).

## Boundary analysis (from grounding)

Post-D1 fields (`SettingsPanel.tsx`): gateway URL input (~592) + `gateway-url-error` `<p>` (~600); gateway
token input (~607) + `gateway-token-warning` `<p>`; Ollama host input + `ollama-host-error` `<p>`. The
derived flags `gatewayUrlInvalid` / `ollamaHostInvalid` / `gatewayTokenNeedsUrl` already exist. The error
`<p>`s have `data-testid` but no `id`.

## Design

For each validation message, add a matching `id` (= the existing `data-testid`) to the `<p>`, and on the
input:
- **Gateway URL:** `aria-invalid={gatewayUrlInvalid}`, `aria-describedby={gatewayUrlInvalid ?
  "gateway-url-error" : undefined}`.
- **Ollama host:** `aria-invalid={ollamaHostInvalid}`, `aria-describedby={ollamaHostInvalid ?
  "ollama-host-error" : undefined}`.
- **Gateway token:** `aria-describedby={gatewayTokenNeedsUrl ? "gateway-token-warning" : undefined}` (no
  `aria-invalid` — a missing-URL dependency is a warning, not an invalid value).

`aria-describedby` is conditionally `undefined` so it only references an element that is actually rendered
(the message renders only when the flag is true) — avoiding a dangling reference.

## Edge cases

- **Message hidden** (flag false) → `aria-describedby` is `undefined` and `aria-invalid` is `false`; no
  dangling id reference.
- **`aria-invalid={false}`** renders as `aria-invalid="false"` — correct/valid ARIA.

## Testing

- **Extend `tests/e2e/settings-validation.spec.ts`**: after typing the malformed gateway URL and asserting
  the error is displayed, assert the input's `aria-invalid` is `"true"` and its `aria-describedby` is
  `"gateway-url-error"`; after setting a valid URL, assert `aria-invalid` is `"false"`.
- **`npm run build`** (tsc) green.
- **Full `npm run check`** green.
- **`npm run test:e2e:build`** — full suite. Flaky-cascade re-run protocol.

## Risks & mitigations

- **Dangling `aria-describedby`** → guarded by the conditional `undefined`.
- **Breaking the existing validation e2e** → additive attributes; the error `data-testid`s are unchanged.

## Rollout

Single feature branch `settings-validation-a11y`. Files:
- **Modify:** `app/src/features/settings/SettingsPanel.tsx` (aria attrs + ids on the 3 messages),
  `app/tests/e2e/settings-validation.spec.ts` (aria assertions).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
