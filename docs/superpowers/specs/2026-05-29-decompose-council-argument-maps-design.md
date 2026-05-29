# Decompose God-Components F10 — Extract CouncilArgumentMaps from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-argument-maps`)
- **Theme:** F — Decompose god-components, sub-project 10 (third CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~2,763 lines (after F8/F9). The next cohesive cluster is **Argument Maps** —
`CouncilArgumentMaps` (a stateful component with its own annotation state/effect/save handler) plus its
exclusive helpers `ArgumentNodeCard`, `buildFallbackArgumentMap`, `slugifyNodeId`. Extracting it removes
~238 lines and isolates the per-node annotation logic into its own module.

## Goals

1. Move `CouncilArgumentMaps` + `ArgumentNodeCard` + `buildFallbackArgumentMap` + `slugifyNodeId` into
   `features/council/CouncilArgumentMaps.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/state/logic — verbatim.
- No extraction of the other clusters.
- No change to `formatPercent` (stays in `councilTransparency`, imported by the new module).

## Boundary analysis (from grounding)

All four functions are **exclusive** to this cluster:
- `CouncilArgumentMaps({ sessionId, response, onAnnotationsChange })` (988–1128) — rendered once by
  `CouncilPanel` at 379–382. Owns `annotations`/`drafts`/`savingNode` state + `activeSessionId` ref, a
  `listArgumentAnnotations` effect, and the `saveAnnotation` handler (`upsertArgumentAnnotation`). Renders
  `ArgumentNodeCard`; computes maps via `buildFallbackArgumentMap`; uses `formatPercent` (1081).
- `ArgumentNodeCard({ node, annotation, disabled, saving, onChange, onSave })` (1130–1180) — pure
  presentational; used only at 1110.
- `buildFallbackArgumentMap(position): ArgumentMap` (1182–1217) — used only at 1063; uses `slugifyNodeId`.
- `slugifyNodeId(value)` (1219–1225) — pure; used only inside `buildFallbackArgumentMap`.

**CouncilPanel imports to DROP after the move** (cluster-only):
- functions `listArgumentAnnotations`, `upsertArgumentAnnotation`;
- types `ArgumentMap`, `ArgumentMapNode`.

**CouncilPanel imports to KEEP:**
- `ArgumentAnnotation` (still used: `argumentAnnotations` state at 95, passed via `onAnnotationsChange=
  {setArgumentAnnotations}` at 382);
- `CouncilPosition`, `CouncilResponse` (widely used);
- `formatPercent` from `councilTransparency` (used at 855, 1671, 1677, 1846, 2145, 2167, 2175 — NOT
  cluster-only).

**New module imports:** react `useEffect`/`useRef`/`useState`; from `lib/bible`:
`listArgumentAnnotations`, `upsertArgumentAnnotation`, and types `ArgumentAnnotation`, `ArgumentMap`,
`ArgumentMapNode`, `CouncilPosition`, `CouncilResponse`; from `./councilTransparency`: `formatPercent`.

No local types, no other CouncilPanel closure dependencies.

## Design

### New `app/src/features/council/CouncilArgumentMaps.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import {
  listArgumentAnnotations,
  upsertArgumentAnnotation,
  type ArgumentAnnotation,
  type ArgumentMap,
  type ArgumentMapNode,
  type CouncilPosition,
  type CouncilResponse,
} from "../../lib/bible";
import { formatPercent } from "./councilTransparency";

export function CouncilArgumentMaps({ … }: { … }) {
  // ← verbatim 988–1128
}

// ← ArgumentNodeCard (1130–1180), buildFallbackArgumentMap (1182–1217),
//   slugifyNodeId (1219–1225) — verbatim, all private
```
(Final import set confirmed by tsc.)

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** all four functions (988–1225).
- **Add** `import { CouncilArgumentMaps } from "./CouncilArgumentMaps";`.
- **Drop** from the `lib/bible` import: `listArgumentAnnotations`, `upsertArgumentAnnotation`,
  `type ArgumentMap`, `type ArgumentMapNode` (now unused in CouncilPanel).
- **Keep** unchanged: the `<CouncilArgumentMaps sessionId={…} response={…}
  onAnnotationsChange={setArgumentAnnotations} />` call site (379–382), the `argumentAnnotations` state,
  and the `formatPercent`/`ArgumentAnnotation`/`CouncilPosition`/`CouncilResponse` imports.

## Data flow / behavior

Unchanged. `CouncilPanel` owns `argumentAnnotations` and passes `setArgumentAnnotations` as the
`onAnnotationsChange` callback; `CouncilArgumentMaps` owns its internal draft/annotation state and calls
the lib functions exactly as before.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilArgumentMaps` → (`lib/bible`, `councilTransparency`);
  `councilTransparency` → `lib/bible` only. One-directional.
- **`ArgumentAnnotation` kept, `ArgumentMap`/`ArgumentMapNode` dropped:** tsc flags any mistake (unused
  kept import, or dropped-but-still-used).
- **`slugifyNodeId`/`buildFallbackArgumentMap` name uniqueness:** these names do not exist in
  `councilTransparency` or elsewhere — no collision (they live privately in the new module).

## Testing

- **`npm run build`** (tsc) — catches dangling refs / wrong import drops.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` renders a full Council
  session including the Argument Maps section (`data-testid="council-argument-maps"`). The persistence
  test exercises annotation save/restore paths. NOTE: wdio specs run as one grouped session; a contiguous
  block of failures unrelated to council is the known flaky cascade — re-run `npm run test:e2e` (no
  rebuild) to confirm before treating as real.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails the build.
- **Accidental edit during the move (esp. the async `saveAnnotation` + `activeSessionId` race-guard
  logic)** → verbatim; reviewers diff the moved code against the original.

## Rollout

Single feature branch `decompose-council-argument-maps`. Files:
- **New:** `app/src/features/council/CouncilArgumentMaps.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove 4 functions; add 1 import; drop 4
  symbols from the `lib/bible` import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
