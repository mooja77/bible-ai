# Decompose God-Components F19 — Extract the CouncilResultView chain from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-result-view`)
- **Theme:** F — Decompose god-components, sub-project 19 (twelfth CouncilPanel slice — the result-view chain capstone)

## Problem

`CouncilPanel.tsx` is ~1,063 lines. The largest remaining piece is the **`CouncilResultView` render
chain** — a contiguous, self-contained component subtree (lines 507–895): `SynthesisModeBanner`,
`CouncilResultView`, `ConfidenceBadge`, `CouncilWinnerSummary`, `WinnerMetric`, `PositionCard`,
`CouncilEvidenceTabs`, `EvidenceDisplayItem`. Extracting it removes ~388 lines and leaves CouncilPanel as
mostly the orchestrating component + input controls + a few standalone sections.

## Goals

1. Move the 8-function chain into `features/council/CouncilResultView.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/logic — verbatim.
- `CouncilConfidenceRationale`, `VoicesAuditTrail`, `VoiceRow` stay (they consume the chain via imports).
- No refactor of the main `CouncilPanel` component.

## Boundary analysis (from grounding)

Contiguous span 507–895, 8 functions. **Referenced outside the span (→ EXPORT):**
- `CouncilResultView` — main render (358) + `VoiceRow` (1054, embeds it). EXPORT.
- `ConfidenceBadge` — `CouncilConfidenceRationale` (907, stays) + within-chain (545). EXPORT.

**Used only within the span (→ private):** `SynthesisModeBanner` (547), `CouncilWinnerSummary` (549),
`WinnerMetric` (655–670), `PositionCard` (553), `CouncilEvidenceTabs` (774), `EvidenceDisplayItem` (838).

**Shared-helper usage AFTER the move (grounding — all chain-only except buildConfidenceFactors):**
- `buildConfidenceFactors` → used by `CouncilConfidenceRationale` (897, stays) → **KEEP** in CouncilPanel.
- `buildPositionEvidenceGroups` (632/794), `countVoiceMentions` (634), `formatPercent` (651–670),
  `labelsOverlap` (557), `evidenceStatusClass`/`evidenceStatusLabel`/`evidenceStatusTooltip`/`sourceDisplay`/
  `sourceTooltip` (EvidenceDisplayItem), `type EvidenceDisplayRow` → all used ONLY in the chain now →
  **DROP** from CouncilPanel's `councilTransparency` import.
- `HighlightedText` (762/884), `buildEvidenceTermsByVerse` (722) → only in the chain → the entire
  `councilHighlight` import line is **REMOVED** from CouncilPanel.

**New-module imports** (final set confirmed by tsc):
- react: `useState` (CouncilEvidenceTabs).
- `lib/bible` types: `CouncilResult`, `CouncilResponse`, `CouncilPosition`, `CouncilVoice` (whichever the
  bodies annotate).
- `./councilTransparency`: `buildPositionEvidenceGroups`, `countVoiceMentions`, `formatPercent`,
  `labelsOverlap`, `evidenceStatusClass`, `evidenceStatusLabel`, `evidenceStatusTooltip`, `sourceDisplay`,
  `sourceTooltip`, `type EvidenceDisplayRow`.
- `./councilHighlight`: `HighlightedText`, `buildEvidenceTermsByVerse`.

## Design

### New `app/src/features/council/CouncilResultView.tsx`

```tsx
import { useState } from "react";
import type { CouncilPosition, CouncilResponse, CouncilResult, CouncilVoice } from "../../lib/bible";
import {
  buildPositionEvidenceGroups, countVoiceMentions, formatPercent, labelsOverlap,
  evidenceStatusClass, evidenceStatusLabel, evidenceStatusTooltip, sourceDisplay, sourceTooltip,
  type EvidenceDisplayRow,
} from "./councilTransparency";
import { HighlightedText, buildEvidenceTermsByVerse } from "./councilHighlight";

export function CouncilResultView({ … }) { /* ← verbatim 525–602 */ }
export function ConfidenceBadge({ … }) { /* ← verbatim 603–619 */ }
// private (verbatim): SynthesisModeBanner (507–524), CouncilWinnerSummary (620–691),
//   WinnerMetric (692–709), PositionCard (710–783), CouncilEvidenceTabs (784–849),
//   EvidenceDisplayItem (850–895)
```
(Declaration order can stay as in the source; function declarations hoist. Final import set per tsc.)

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** the contiguous span 507–895 (8 functions).
- **Add** `import { CouncilResultView, ConfidenceBadge } from "./CouncilResultView";`.
- **Remove** the whole `import { HighlightedText, buildEvidenceTermsByVerse } from "./councilHighlight";`
  line.
- **Edit** the `councilTransparency` import: keep `buildConfidenceFactors` (+ any other still-used member);
  drop `buildPositionEvidenceGroups`, `countVoiceMentions`, `formatPercent`, `labelsOverlap`,
  `evidenceStatusClass`, `evidenceStatusLabel`, `evidenceStatusTooltip`, `sourceDisplay`, `sourceTooltip`,
  `type EvidenceDisplayRow`. (tsc is the arbiter — drop exactly what becomes unused.)
- **Keep** unchanged: the call sites — `<CouncilResultView … />` (358) and the one in `VoiceRow` (1054);
  `<ConfidenceBadge … />` in `CouncilConfidenceRationale` (907).

## Data flow / behavior

Unchanged. The chain renders identically; `VoiceRow` and the main render consume `CouncilResultView` via
import; `CouncilConfidenceRationale` consumes `ConfidenceBadge` via import.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilResultView` → (`react`, `lib/bible`,
  `councilTransparency`, `councilHighlight`); none import `CouncilPanel`. One-directional.
- **Many import drops** → tsc enforces; drop exactly the now-unused members. The `councilHighlight` import
  line disappears entirely from CouncilPanel.
- **`ConfidenceBadge` shared** with `CouncilConfidenceRationale` → exported from the new module; CouncilPanel
  imports it.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / wrong import drops (the riskiest part here).
- **Full `npm run check`** green (real exit code).
- **`npm run test:e2e:build`** — full suite. `council-mock.spec.ts` renders the full result view
  (positions, winner summary, evidence tabs, confidence badge) + a voice's independent analysis via
  `VoiceRow` (which embeds `CouncilResultView`). Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** (the main risk given the volume) → tsc fails the build; the
  reviewer diffs each of the 8 functions against the original and re-checks the drop list.
- **Accidental edit during the move** → verbatim; per-function byte-identity diff.

## Rollout

Single feature branch `decompose-council-result-view`. Files:
- **New:** `app/src/features/council/CouncilResultView.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the span; add 1 import; remove the
  `councilHighlight` import; prune the `councilTransparency` import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
