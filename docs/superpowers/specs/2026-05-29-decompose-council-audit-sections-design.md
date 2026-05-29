# Decompose God-Components F18 — Extract CouncilSourceDrawer + CouncilEvidenceAudit — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `decompose-council-audit-sections`)
- **Theme:** F — Decompose god-components, sub-project 18 (eleventh CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~1,226 lines. Two standalone result sections rendered directly by the main
component — the **Source Data** drawer (`CouncilSourceDrawer`) and the **Retrieved Evidence** audit
(`CouncilEvidenceAudit`) — are clean leaves (no result-view-chain sub-components; the status helpers they
use already live in `councilTransparency`). Extracting both removes ~196 lines.

## Goals

1. Move `CouncilSourceDrawer` → `features/council/CouncilSourceDrawer.tsx` and `CouncilEvidenceAudit` →
   `features/council/CouncilEvidenceAudit.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/logic — verbatim.
- NOT `CouncilConfidenceRationale` (couples to the shared `ConfidenceBadge`, still in the result-view
  chain) — deferred.

## Boundary analysis (from grounding)

- `CouncilSourceDrawer({ response })` (941–1066) — rendered at 387. `useState` (open/active/copied) +
  `JSON.stringify` + `navigator.clipboard`. Only dep: `CouncilResponse` type. No sub-components.
- `CouncilEvidenceAudit({ evidence, synthesis, onJumpToVerse })` (1068–1137) — rendered at 393. Uses
  `RetrievedEvidence`/`CouncilResult` types + the status helpers (`sourceTooltip`/`sourceDisplay`/
  `evidenceStatusClass`/`evidenceStatusTooltip`/`evidenceStatusLabel`, all now in `councilTransparency`).
  No sub-components.

Both used only at their single call sites.

**CouncilPanel imports after the move:**
- Status helpers (`source*`/`evidenceStatus*`) — STILL used by `EvidenceDisplayItem` (863–871) → KEEP.
- `buildConfidenceFactors` — used by `CouncilConfidenceRationale` (stays) → KEEP.
- `RetrievedEvidence`/`CouncilResult` types — if they become unused in CouncilPanel after the move, tsc
  flags them and they are dropped; if still used elsewhere, kept. (Resolve by build.)

**New-module imports:**
- `CouncilSourceDrawer.tsx`: react `useState`; `type CouncilResponse` from lib/bible.
- `CouncilEvidenceAudit.tsx`: `type { CouncilResult, RetrievedEvidence }` from lib/bible; `{
  evidenceStatusClass, evidenceStatusLabel, evidenceStatusTooltip, sourceDisplay, sourceTooltip }` from
  `./councilTransparency`.

## Design

### New `app/src/features/council/CouncilSourceDrawer.tsx`
```tsx
import { useState } from "react";
import type { CouncilResponse } from "../../lib/bible";

export function CouncilSourceDrawer({ response }: { response: CouncilResponse }) { /* ← verbatim 941–1066 */ }
```

### New `app/src/features/council/CouncilEvidenceAudit.tsx`
```tsx
import type { CouncilResult, RetrievedEvidence } from "../../lib/bible";
import {
  evidenceStatusClass,
  evidenceStatusLabel,
  evidenceStatusTooltip,
  sourceDisplay,
  sourceTooltip,
} from "./councilTransparency";

export function CouncilEvidenceAudit({ … }) { /* ← verbatim 1068–1137 */ }
```

### `app/src/features/council/CouncilPanel.tsx` (modify)
- **Remove** both functions (the contiguous block 941–1137).
- **Add** `import { CouncilSourceDrawer } from "./CouncilSourceDrawer";` and
  `import { CouncilEvidenceAudit } from "./CouncilEvidenceAudit";`.
- **Resolve** any now-unused `lib/bible` type imports (`RetrievedEvidence`/`CouncilResult`) per tsc — drop
  if unused, keep if still referenced.
- **Keep** unchanged: the call sites (387, 393); the status-helper imports (EvidenceDisplayItem still uses
  them); `buildConfidenceFactors`.

## Data flow / behavior

Unchanged. Both sections render identically from their props.

## Edge cases

- **No circular import:** both new modules → (`react`/`lib/bible`/`councilTransparency`); one-directional.
- **Status helpers retained** in CouncilPanel (EvidenceDisplayItem) — tsc flags any mistake.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused type imports.
- **Full `npm run check`** green (real exit code).
- **`npm run test:e2e:build`** — full suite. `council-mock.spec.ts` renders the source drawer
  (`data-testid="council-source-drawer"`) + the evidence audit. Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / unused-type drop** → tsc fails.
- **Accidental edit** → extracted verbatim (via `sed`) + diffed; only the `export` prefix differs.

## Rollout

Single feature branch `decompose-council-audit-sections`. Files:
- **New:** `app/src/features/council/CouncilSourceDrawer.tsx`, `app/src/features/council/CouncilEvidenceAudit.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the block; add 2 imports; resolve unused
  type imports).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
