# Decompose God-Components F20 — Extract CouncilConfidenceRationale + VoicesAuditTrail/VoiceRow — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `decompose-council-final-leaves`)
- **Theme:** F — Decompose god-components, sub-project 20 (final CouncilPanel leaves)

## Problem

`CouncilPanel.tsx` is ~660 lines (3,159 → 660 across F8–F19). Three extractable leaf sections remain: the
**Confidence Rationale** section and the **Voices audit trail** (`VoicesAuditTrail` + `VoiceRow`). `VoiceRow`
was previously blocked (it embeds `CouncilResultView`), but F19 moved `CouncilResultView` to its own module
— so it's now importable. Extracting these leaves removes ~170 lines, leaving CouncilPanel as essentially
the orchestrator component + `CouncilRetrievalControls`.

## Goals

1. Move `CouncilConfidenceRationale` → `features/council/CouncilConfidenceRationale.tsx`.
2. Move `VoicesAuditTrail` + `VoiceRow` → `features/council/CouncilVoicesAudit.tsx`.
3. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/logic — verbatim.
- No extraction of the main `CouncilPanel` orchestrator or `CouncilRetrievalControls`.

## Boundary analysis (from grounding)

- `CouncilConfidenceRationale({ response })` (493–537) — rendered at 360. Uses `buildConfidenceFactors`
  (councilTransparency) + `ConfidenceBadge` (now in CouncilResultView.tsx) + `CouncilResponse` type. Leaf.
- `VoicesAuditTrail({ voices, manifest, onJumpToVerse })` (539–571) — rendered at 375. Renders `VoiceRow`.
  Types: `CouncilVoice`, `CouncilProviderInfo`.
- `VoiceRow({ manifest, voice, onJumpToVerse })` (573–660) — used only by `VoicesAuditTrail`. `useState`
  (expanded); embeds `<CouncilResultView … />` (651, now importable). Types: `CouncilProviderInfo`,
  `CouncilVoice`.

**CouncilPanel imports after the move:**
- `ConfidenceBadge` — used ONLY by `CouncilConfidenceRationale` (504) → DROP from the `CouncilResultView`
  import (keep `CouncilResultView`, still rendered at 344).
- `buildConfidenceFactors` — used ONLY by `CouncilConfidenceRationale` (494) → its `councilTransparency`
  import becomes empty → REMOVE the line.
- `CouncilVoice`/`CouncilProviderInfo` types — if now unused in CouncilPanel (only the audit used them),
  tsc flags them → drop; else keep. (Resolve by build.)

**New-module imports:**
- `CouncilConfidenceRationale.tsx`: `type CouncilResponse` (lib/bible); `buildConfidenceFactors`
  (councilTransparency); `ConfidenceBadge` (./CouncilResultView).
- `CouncilVoicesAudit.tsx`: `useState` (react); `type { CouncilProviderInfo, CouncilVoice }` (lib/bible);
  `CouncilResultView` (./CouncilResultView).

## Design

### New `app/src/features/council/CouncilConfidenceRationale.tsx`
```tsx
import type { CouncilResponse } from "../../lib/bible";
import { buildConfidenceFactors } from "./councilTransparency";
import { ConfidenceBadge } from "./CouncilResultView";

export function CouncilConfidenceRationale({ response }: { response: CouncilResponse }) { /* ← verbatim 493–537 */ }
```

### New `app/src/features/council/CouncilVoicesAudit.tsx`
```tsx
import { useState } from "react";
import type { CouncilProviderInfo, CouncilVoice } from "../../lib/bible";
import { CouncilResultView } from "./CouncilResultView";

export function VoicesAuditTrail({ … }) { /* ← verbatim 539–571 */ }
function VoiceRow({ … }) { /* ← verbatim 573–660 (private) */ }
```

### `app/src/features/council/CouncilPanel.tsx` (modify)
- **Remove** `CouncilConfidenceRationale` (493–537) and `VoicesAuditTrail` + `VoiceRow` (539–660).
- **Add** `import { CouncilConfidenceRationale } from "./CouncilConfidenceRationale";` and
  `import { VoicesAuditTrail } from "./CouncilVoicesAudit";`.
- **Edit** the `CouncilResultView` import → `import { CouncilResultView } from "./CouncilResultView";`
  (drop `ConfidenceBadge`).
- **Remove** the `import { buildConfidenceFactors } from "./councilTransparency";` line.
- **Resolve** now-unused `CouncilVoice`/`CouncilProviderInfo` lib/bible imports per tsc.
- **Keep** unchanged: the call sites (360 `<CouncilConfidenceRationale … />`, 375 `<VoicesAuditTrail … />`,
  344 `<CouncilResultView … />`).

## Data flow / behavior

Unchanged. Both sections render identically; `VoiceRow` renders the same embedded `CouncilResultView`.

## Edge cases

- **No circular import:** new modules → (`react`/`lib/bible`/`councilTransparency`/`CouncilResultView`);
  `CouncilResultView` does not import them. One-directional.
- **`ConfidenceBadge`/`buildConfidenceFactors` drop** → both become unused in CouncilPanel; tsc enforces.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / the import drops.
- **Full `npm run check`** green (real exit code).
- **`npm run test:e2e:build`** — full suite. `council-mock.spec.ts` renders the confidence rationale
  (`data-testid="council-confidence-rationale"`) + the voices audit (expand → embedded CouncilResultView).
  Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails.
- **Accidental edit** → extracted verbatim (via `sed`) + diffed; only the `export` prefixes differ.

## Rollout

Single feature branch `decompose-council-final-leaves`. Files:
- **New:** `app/src/features/council/CouncilConfidenceRationale.tsx`, `app/src/features/council/CouncilVoicesAudit.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove 2 regions; add 2 imports; drop
  `ConfidenceBadge` + the `buildConfidenceFactors` import line; resolve unused type imports).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
