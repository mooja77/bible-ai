# Decompose God-Components F12 — Extract CouncilJudgmentPanel from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `decompose-council-judgment-panel`)
- **Theme:** F — Decompose god-components, sub-project 12 (fifth CouncilPanel slice — largest cluster)

## Problem

`CouncilPanel.tsx` is ~2,305 lines (after F8–F11). The largest remaining cluster is the **personal
judgment panel** — `CouncilJudgmentPanel` (~330-line stateful component) plus its helpers
(`normalizeJudgment`, `buildCouncilFollowUpQuestions`, `LabeledTextarea`), the shared judgment factories
(`readPayloadJudgment`, `createEmptyJudgment` — also used by the main component), and a local
`FollowUpQuestion` interface. Extracting it removes ~440 lines.

## Goals

1. Move the judgment cluster into `features/council/CouncilJudgmentPanel.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/state/logic — verbatim.
- No change to `formatPercent` (stays in `councilTransparency`, imported by the new module).
- No change to `onAskFollowUp` (defined in the main component at 188, passed as a prop — stays).

## Boundary analysis (from grounding)

Contiguous cluster block **525–965** (plus the local interface at 59–62):
- `readPayloadJudgment(response)` (525–528) — pure; used by the **main** component at 124
  (`setJudgment(readPayloadJudgment(restoredResult.response))`) and nowhere else.
- `createEmptyJudgment(sessionId, response)` (530–548) — pure; used by the **main** component at 173 and
  by `normalizeJudgment` (555).
- `normalizeJudgment(sessionId, response, loaded)` (550–571) — uses `createEmptyJudgment`; used only by
  the panel (600/606).
- `CouncilJudgmentPanel({ sessionId, response, judgment, onJudgmentChange, onAskFollowUp })` (573–901) —
  rendered once at 379–384. State `draft`/`saveState`/`saveError`; a `getCouncilJudgment` effect; uses
  `upsertCouncilJudgment` (693), `normalizeJudgment`, `LabeledTextarea`, `buildCouncilFollowUpQuestions`
  (via `useMemo` at 683), `formatPercent` (850), and `PositionJudgment`/`PositionUserRating` types.
- `buildCouncilFollowUpQuestions(response): FollowUpQuestion[]` (902–941) — used only at 684 (inside the
  panel's `useMemo`).
- `LabeledTextarea(...)` (943–965) — used only inside the panel (8 call sites).
- `interface FollowUpQuestion` (59–62) — local type; used only by `buildCouncilFollowUpQuestions`.

**Circular-import avoidance:** `readPayloadJudgment` + `createEmptyJudgment` are used by the main
component, so they must be **exported from the new module** and imported by `CouncilPanel` — NOT left in
`CouncilPanel` and imported back by the new module (that would be a cycle, since the new module's
`normalizeJudgment` needs `createEmptyJudgment`). One-directional: `CouncilPanel` → new module → lib/bible.

**CouncilPanel imports to DROP** (cluster-only after the move):
- function `getCouncilJudgment` (used only at 597, panel);
- type `PositionJudgment` (used only at 627, panel);
- type `PositionUserRating` (used only at 861, panel — `formatPositionRating` already left in F11).

**CouncilPanel imports to KEEP:**
- function `upsertCouncilJudgment` (used by the main component at 176, AND the panel at 693 — both files
  import it);
- type `CouncilJudgment` (state at 91 + main usages 124/173/178/379);
- `formatPercent` from `councilTransparency` (used in 8 non-cluster places, e.g. 1213/1219/1388/…).

**New-module imports:** react `useEffect`/`useMemo`/`useState`; from `lib/bible` `getCouncilJudgment`,
`upsertCouncilJudgment`, types `CouncilJudgment`, `CouncilResponse`, `PositionJudgment`,
`PositionUserRating`; from `./councilTransparency` `formatPercent`. (Final set confirmed by tsc.)

## Design

### New `app/src/features/council/CouncilJudgmentPanel.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  getCouncilJudgment,
  upsertCouncilJudgment,
  type CouncilJudgment,
  type CouncilResponse,
  type PositionJudgment,
  type PositionUserRating,
} from "../../lib/bible";
import { formatPercent } from "./councilTransparency";

interface FollowUpQuestion { /* ← verbatim 59–62 */ }

export function readPayloadJudgment(...) { /* ← verbatim 525–528 */ }
export function createEmptyJudgment(...) { /* ← verbatim 530–548 */ }
function normalizeJudgment(...) { /* ← verbatim 550–571 */ }
export function CouncilJudgmentPanel({ ... }) { /* ← verbatim 573–901 */ }
function buildCouncilFollowUpQuestions(response: CouncilResponse): FollowUpQuestion[] { /* ← verbatim 902–941 */ }
function LabeledTextarea({ ... }) { /* ← verbatim 943–965 */ }
```

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** the `FollowUpQuestion` interface (59–62) and the contiguous block 525–965 (the six
  functions). Keep clean single-blank spacing where each region is removed.
- **Add** `import { CouncilJudgmentPanel, readPayloadJudgment, createEmptyJudgment } from "./CouncilJudgmentPanel";`.
- **Drop** from the `lib/bible` import: `getCouncilJudgment`, `type PositionJudgment`,
  `type PositionUserRating`.
- **Keep**: `upsertCouncilJudgment` (used at 176), `type CouncilJudgment`, and the `formatPercent` import
  from `councilTransparency`.
- **Keep** unchanged: the `<CouncilJudgmentPanel … onAskFollowUp={onAskFollowUp} />` call site (379–384),
  the `judgment` state (91), the `readPayloadJudgment(...)` use (124), the `createEmptyJudgment(...)` use
  (173), and `upsertCouncilJudgment(...)` (176).

## Data flow / behavior

Unchanged. The main component still owns the `judgment` state and the session/follow-up flow, calling the
imported `readPayloadJudgment`/`createEmptyJudgment` and passing `judgment`/`onJudgmentChange`/
`onAskFollowUp` to `<CouncilJudgmentPanel>`, which owns its own draft/save state exactly as before.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilJudgmentPanel` (+ readPayloadJudgment/createEmptyJudgment)
  → (`lib/bible`, `councilTransparency`); `councilTransparency` → `lib/bible`. One-directional. The
  main→helper dependency is satisfied by importing FROM the new module (not the reverse).
- **`upsertCouncilJudgment` shared:** both files import it (main @176, panel @693) — kept in both.
- **`FollowUpQuestion` is local (not from lib/bible):** moves into the new module as a private interface;
  CouncilPanel must have no remaining reference to it (grounding: only `buildCouncilFollowUpQuestions`
  used it).
- **Two non-adjacent removal regions** (interface @59–62, block @525–965): delete the lower block first to
  keep line numbers stable for the interface removal.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / wrong import drops / a missed `FollowUpQuestion`.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` submits/persists/restores
  a session (exercises `readPayloadJudgment` on restore, `createEmptyJudgment` on the starting-view path,
  and the judgment panel's save/load); `council-follow-up.spec.ts` clicks a follow-up question (exercises
  `buildCouncilFollowUpQuestions` + `onAskFollowUp`). NOTE: wdio specs run as one grouped session; a
  contiguous block of unrelated failures is the known flaky cascade — re-run `npm run test:e2e` (no
  rebuild) to confirm before treating as real.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop / a cycle** → tsc fails the build.
- **Accidental edit during the move** (esp. the panel's `getCouncilJudgment` effect, the async save
  handler with `upsertCouncilJudgment`, `normalizeJudgment`'s by-label merge, and
  `buildCouncilFollowUpQuestions`' question-assembly) → verbatim; reviewers diff each moved function
  against the original.
- **Large move (~440 lines)** → a dedicated review subagent diffs every function and verifies the
  exported/private split + import drops.

## Rollout

Single feature branch `decompose-council-judgment-panel`. Files:
- **New:** `app/src/features/council/CouncilJudgmentPanel.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the interface + the block; add 1 import;
  drop 3 symbols from the `lib/bible` import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
