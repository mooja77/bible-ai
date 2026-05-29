# Decompose God-Components F15 — Extract CouncilPositionComparison from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-position-comparison`)
- **Theme:** F — Decompose god-components, sub-project 15 (eighth CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~1,584 lines (after F8–F14). The **Compare Positions** tool
(`CouncilPositionComparison` + `PositionSelect` + `PositionComparisonCard` + `ComparisonFact`, 702–858) is
a self-contained contiguous block. Extracting it removes ~157 lines.

## Goals

1. Move the four comparison functions into `features/council/CouncilPositionComparison.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/logic — verbatim.
- **NOT** the result-view position sub-components (`PositionCard`, `CouncilWinnerSummary`, `WinnerMetric`,
  `ConfidenceBadge`) — those are rendered by `CouncilResultView` and belong to the result/process-wrappers
  cluster.

## Boundary analysis (from grounding)

Contiguous block 702–858, all four functions exclusive:
- `CouncilPositionComparison({ response, onJumpToVerse })` (702–767) — rendered once at 358. `useState`
  (left/right labels); renders `PositionSelect` + `PositionComparisonCard`. Does NOT render
  `CouncilResultView`/`PositionCard` (verified) → no cycle risk.
- `PositionSelect(...)` (769–796) — pure; used only by `CouncilPositionComparison`.
- `PositionComparisonCard(...)` (798–849) — uses `buildPositionEvidenceGroups`, `countVoiceMentions`,
  `formatPercent`, renders `ComparisonFact`; used only by `CouncilPositionComparison`.
- `ComparisonFact(...)` (851–858) — pure; used only by `PositionComparisonCard`.

**Shared helpers (used elsewhere in CouncilPanel too → KEEP imports, new module imports its own):**
`buildPositionEvidenceGroups` (also 624/944), `countVoiceMentions` (also in `CouncilWinnerSummary`),
`formatPercent` (many). No CouncilPanel import drops expected (tsc confirms; if a helper becomes unused it
is dropped).

**New-module imports:** react `useState`; from `lib/bible` types `CouncilPosition`, `CouncilResponse`,
`CouncilVoice`; from `./councilTransparency` `buildPositionEvidenceGroups`, `countVoiceMentions`,
`formatPercent`.

## Design

### New `app/src/features/council/CouncilPositionComparison.tsx`

```tsx
import { useState } from "react";
import type { CouncilPosition, CouncilResponse, CouncilVoice } from "../../lib/bible";
import { buildPositionEvidenceGroups, countVoiceMentions, formatPercent } from "./councilTransparency";

export function CouncilPositionComparison({ … }) { /* ← verbatim 702–767 */ }
function PositionSelect({ … }) { /* ← verbatim 769–796 */ }
function PositionComparisonCard({ … }) { /* ← verbatim 798–849 */ }
function ComparisonFact({ … }) { /* ← verbatim 851–858 */ }
```

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** the contiguous block 702–858 (the four functions).
- **Add** `import { CouncilPositionComparison } from "./CouncilPositionComparison";`.
- **Keep** the `councilTransparency` import as-is (its members are still used elsewhere) unless tsc reports
  one became unused — then drop only that one.
- **Keep** unchanged: the `<CouncilPositionComparison response={response} onJumpToVerse={onJumpToVerse} />`
  call site (358).

## Data flow / behavior

Unchanged. The tool renders identically from `response` + `onJumpToVerse`.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilPositionComparison` → (`react`, `lib/bible`,
  `councilTransparency`); one-directional. Confirmed the tool does not embed any CouncilPanel component.
- **Shared helpers retained** in CouncilPanel (used elsewhere) — tsc flags any that became unused.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **Full `npm run check`** green (capture the REAL npm exit code).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` renders the comparison
  (`data-testid="council-position-comparison"`) as part of the result view. Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference** → tsc fails.
- **Accidental edit during the move** → extracted verbatim (via `sed`) + diffed against the original; only
  the `export` prefix differs.

## Rollout

Single feature branch `decompose-council-position-comparison`. Files:
- **New:** `app/src/features/council/CouncilPositionComparison.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the block; add 1 import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
