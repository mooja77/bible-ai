# Council History — Keyboard-Reveal Delete (Hover-Only Control Fix) — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `council-history-focus-a11y`)
- **Theme:** C — Accessibility & polish, sub-project 5 (final; closes Theme C)
- **Owner:** John Moore

## Problem

An audit of clickable-`<div>` lists and hover-only controls (the earlier Theme-C "keyboard nav for
lists" candidate) found that **almost everything is already keyboard-accessible**: `WorkspacesPanel`
items, reader verse numbers, Strong's word tokens, and the Council `VoiceRow` expander are all
`<button>`s; the positions comparison `<tr onClick>` has a focusable inner `<button>` doing the same
action. The single genuine gap is in **`CouncilHistory`**: each row's delete button is

```
className="opacity-0 group-hover:opacity-100 … transition-opacity"
```

i.e. it appears only when the row is **mouse-hovered**. There is no focus variant, so a keyboard
user tabbing into the row (onto the select button or the delete button itself) sees nothing — the
delete affordance is invisible to keyboard and screen-magnifier users.

## Goals

1. The delete `×` button is revealed when any control in its row receives **keyboard focus** — the
   keyboard mirror of the existing hover reveal.

## Non-goals (YAGNI)

- No change to the already-accessible lists/controls (verified accessible — see Problem).
- No structural change to `CouncilHistory` (the row already has the `group` class and proper
  `<button>`s; the select/delete keyboard *activation* already works — only the *visibility* of the
  delete on focus is missing).
- No always-visible delete (keep the hover/focus reveal so the list stays uncluttered).
- No backend/Rust/sidecar/type change.

## Approach

Add `group-focus-within:opacity-100` to the delete button's className. The row `<li>` already has
`className="group"`, so `group-focus-within` reveals the delete whenever the select button *or* the
delete button is focused — exactly mirroring `group-hover:opacity-100` for keyboard.

## Design (`app/src/features/council/CouncilHistory.tsx`)

The delete button className becomes:

```
"opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-neutral-500 hover:text-red-400 text-sm px-1 transition-opacity"
```

(Only `group-focus-within:opacity-100` is inserted. Everything else is unchanged.)

## Behavior

```
Mouse: hover row → group-hover:opacity-100 → × visible (unchanged)
Keyboard: Tab to the row's select (or delete) button → focus enters the .group <li>
          → group-focus-within:opacity-100 → × visible
Neither focused nor hovered → opacity-0 (hidden, list stays clean)
```

## Testing

Extend the existing `app/tests/e2e/council-mock.spec.ts` test
*"submits, renders, persists, restores, and deletes a Council session"*, which already runs a mock
Council, persists a session to History, and (via mouse `moveTo()`) reveals + clicks the delete
button. Immediately **before** that hover/delete step (after the `deleteButton` locator is defined),
add a keyboard-reveal assertion:

1. Programmatically focus the row's select button (`button[title="<question>"]`) — equivalent to a
   keyboard Tab landing on it.
2. Poll until the sibling delete button's computed `opacity` (`deleteButton.getCSSProperty("opacity")`)
   reaches `"1"` (the `transition-opacity` settles to the `group-focus-within` target).

The existing mouse hover + delete continues afterward (unchanged), so the mouse path is still
covered. Plus `npm run build` + full `npm run check` + `npm run test:e2e:build` green.

## Risks & mitigations

- **`group-focus-within` support (Tailwind v4)** → core variant; build verifies it's emitted.
- **Opacity transition timing in the e2e** → asserted via `waitUntil` polling the computed opacity
  to `"1"`, which tolerates the transition duration.
- **Prior `click()` already focused the row** → harmless; the assertion validates the focus→opacity
  rule regardless of how focus arrived, and the programmatic `focus()` makes the intent explicit.

## Rollout

Single feature branch `council-history-focus-a11y`. Files:
- **Modify:** `app/src/features/council/CouncilHistory.tsx` (one className).
- **Modify:** `app/tests/e2e/council-mock.spec.ts` (keyboard-reveal assertion in the existing test).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`. Closes Theme C.
