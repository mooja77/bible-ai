# Decompose God-Components F14 — Extract CouncilVoiceMatrix from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-voice-matrix`)
- **Theme:** F — Decompose god-components, sub-project 14 (seventh CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~1,735 lines (after F8–F13). The **Voice Agreement Matrix** (`CouncilVoiceMatrix`,
1046–1195) is a self-contained contiguous component. Extracting it removes ~150 lines.

## Goals

1. Move `CouncilVoiceMatrix` into `features/council/CouncilVoiceMatrix.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/logic — verbatim.
- **Defer `VoicesAuditTrail` + `VoiceRow`:** `VoiceRow` embeds `<CouncilResultView … />` (line 1726).
  `CouncilResultView` is still in `CouncilPanel`, so moving `VoiceRow` now would create a circular import
  (`CouncilPanel` → voices module → `CouncilResultView` in `CouncilPanel`). Those two move only after the
  result/process-wrappers cluster (which owns `CouncilResultView`) is extracted.

## Boundary analysis (from grounding)

- `CouncilVoiceMatrix({ response, selectedPositionLabel, onSelectPosition, onJumpToVerse })` (1046–1195) —
  rendered once at 359. Internal `useState` (selected cell), `buildVoiceAgreementMatrix(response)`,
  `labelsOverlap`, `formatPercent`. Uses types `CouncilResponse` + `CouncilPosition` (the `cell.position as
  CouncilPosition` cast at 1130 + the `selected` state shape). No `CouncilResultView` or other CouncilPanel
  component — confirmed self-contained.

**CouncilPanel imports to DROP:** `buildVoiceAgreementMatrix` (used only at 1062, in the matrix).

**CouncilPanel imports to KEEP:** `labelsOverlap` (used at 549), `formatPercent` (many), `CouncilResponse`/
`CouncilPosition` (many).

**New-module imports:** react `useState`; from `lib/bible` types `CouncilPosition`, `CouncilResponse`;
from `./councilTransparency` `buildVoiceAgreementMatrix`, `formatPercent`, `labelsOverlap`.

## Design

### New `app/src/features/council/CouncilVoiceMatrix.tsx`

```tsx
import { useState } from "react";
import type { CouncilPosition, CouncilResponse } from "../../lib/bible";
import { buildVoiceAgreementMatrix, formatPercent, labelsOverlap } from "./councilTransparency";

export function CouncilVoiceMatrix({ … }) { /* ← verbatim 1046–1195 */ }
```

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** `CouncilVoiceMatrix` (1046–1195).
- **Add** `import { CouncilVoiceMatrix } from "./CouncilVoiceMatrix";`.
- **Drop** `buildVoiceAgreementMatrix` from the `councilTransparency` import (keep `labelsOverlap`,
  `formatPercent`, and the rest).
- **Keep** unchanged: the `<CouncilVoiceMatrix … />` call site (359).

## Data flow / behavior

Unchanged. The matrix renders identically from `response` + the selection props.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilVoiceMatrix` → (`react`, `lib/bible`,
  `councilTransparency`); `councilTransparency` → `lib/bible`. One-directional.
- **`buildVoiceAgreementMatrix` exclusivity** confirmed (only 1062) → safe to drop from CouncilPanel.
- **`labelsOverlap`/`formatPercent` retained** in CouncilPanel (used elsewhere) — tsc flags any mistake.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / the import drop.
- **Full `npm run check`** green (capture the REAL npm exit code).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` renders the matrix
  (`data-testid="council-voice-matrix"`) as part of the result view. Flaky-cascade re-run protocol applies.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong drop** → tsc fails.
- **Accidental edit during the move** → the block is extracted verbatim (via `sed`) and diffed against the
  original; only the `export` prefix differs.

## Rollout

Single feature branch `decompose-council-voice-matrix`. Files:
- **New:** `app/src/features/council/CouncilVoiceMatrix.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the function; add 1 import; drop 1 symbol
  from the `councilTransparency` import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
