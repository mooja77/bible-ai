# Decompose God-Components F17 — Extract CouncilRetrievalTrace + lift evidence-status helpers — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-retrieval-trace`)
- **Theme:** F — Decompose god-components, sub-project 17 (tenth CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~1,341 lines. The **Retrieval Trace** (`CouncilRetrievalTrace` + `RetrievalScoreBar`)
is extractable, but it shares the evidence-status helpers (`evidenceStatusLabel`/`evidenceStatusClass`/
`evidenceStatusTooltip`/`sourceDisplay`/`sourceTooltip`) with `EvidenceDisplayItem` and
`CouncilEvidenceAudit` (both staying). So this slice **lifts those 5 shared helpers into
`councilTransparency.ts`** (used by all three consumers), then extracts the retrieval-trace component.

## Goals

1. Move the 5 evidence-status helpers into `councilTransparency.ts` (exported), reroute all consumers.
2. Move `CouncilRetrievalTrace` + `RetrievalScoreBar` into `features/council/CouncilRetrievalTrace.tsx`.
3. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/logic — verbatim.
- No extraction of `EvidenceDisplayItem`/`CouncilEvidenceAudit`/`CouncilEvidenceTabs` (they stay; they
  just import the status helpers from `councilTransparency` now).

## Boundary analysis (from grounding)

**Evidence-status helpers (1216–1252), pure, used by THREE consumers:**
- `EvidenceDisplayItem` (844–889): uses all 5 (sourceTooltip/sourceDisplay/evidenceStatusClass/Tooltip/Label).
- `CouncilRetrievalTrace` (890–955): uses sourceTooltip, evidenceStatusClass, evidenceStatusTooltip.
- `CouncilEvidenceAudit` (1145–1214): uses all 5.
→ Move all 5 to `councilTransparency.ts` (exported). They use the inline union
`"used"|"supporting"|"conflicting"|"ignored"` — keep verbatim (do NOT rewrite to the existing
`EvidenceStatus` type alias). **Check for pre-existing definitions** in `councilTransparency.ts`; if one
already exists byte-identical, reuse it (do not duplicate) — else append.

**Retrieval-trace component (890–970):**
- `CouncilRetrievalTrace({ response, onJumpToVerse })` (890–955) — rendered at 367. Uses
  `buildRetrievalTraceRows` + `buildRetrievedCitationByVerse` + `HighlightedText` + `RetrievalScoreBar` +
  `sourceTooltip`/`evidenceStatusClass`/`evidenceStatusTooltip`.
- `RetrievalScoreBar({ row: EvidenceDisplayRow })` (957–970) — used only by `CouncilRetrievalTrace`.

**CouncilPanel import changes:**
- `buildRetrievalTraceRows`: used only at 897 (CouncilRetrievalTrace) → DROP from `councilTransparency`
  import.
- `buildRetrievedCitationByVerse`: used only at 898 (CouncilRetrievalTrace) → DROP from `councilHighlight`
  import (keep `HighlightedText` [used by EvidenceDisplayItem @877] + `buildEvidenceTermsByVerse` [used by
  CouncilEvidenceTabs @715]).
- ADD the 5 status helpers to CouncilPanel's `councilTransparency` import (EvidenceDisplayItem +
  CouncilEvidenceAudit still use them).
- ADD `CouncilRetrievalTrace` component import.

**New-module (`CouncilRetrievalTrace.tsx`) imports:**
- `lib/bible`: type `CouncilResponse`.
- `./councilTransparency`: `buildRetrievalTraceRows`, `evidenceStatusClass`, `evidenceStatusTooltip`,
  `sourceTooltip`, type `EvidenceDisplayRow`.
- `./councilHighlight`: `HighlightedText`, `buildRetrievedCitationByVerse`.

## Design

### `councilTransparency.ts` (modify — append, exported, verbatim)

`evidenceStatusLabel`, `evidenceStatusClass`, `evidenceStatusTooltip`, `sourceDisplay`, `sourceTooltip`
(1216–1252). (If any already exists there byte-identical, reuse instead of duplicating.)

### New `app/src/features/council/CouncilRetrievalTrace.tsx`

```tsx
import type { CouncilResponse } from "../../lib/bible";
import {
  buildRetrievalTraceRows,
  evidenceStatusClass,
  evidenceStatusTooltip,
  sourceTooltip,
  type EvidenceDisplayRow,
} from "./councilTransparency";
import { HighlightedText, buildRetrievedCitationByVerse } from "./councilHighlight";

export function CouncilRetrievalTrace({ … }) { /* ← verbatim 890–955 */ }
function RetrievalScoreBar({ row }: { row: EvidenceDisplayRow }) { /* ← verbatim 957–970 */ }
```
(Final import set confirmed by tsc.)

### `CouncilPanel.tsx` (modify)

- **Remove** `CouncilRetrievalTrace` + `RetrievalScoreBar` (890–970) and the 5 status helpers (1216–1252).
- **Add** `import { CouncilRetrievalTrace } from "./CouncilRetrievalTrace";`.
- **Add** to the `councilTransparency` import: `evidenceStatusLabel`, `evidenceStatusClass`,
  `evidenceStatusTooltip`, `sourceDisplay`, `sourceTooltip`; **drop** `buildRetrievalTraceRows`.
- **Drop** `buildRetrievedCitationByVerse` from the `councilHighlight` import (keep `HighlightedText`,
  `buildEvidenceTermsByVerse`).
- **Keep** unchanged: the `<CouncilRetrievalTrace … />` call site (367) and `EvidenceDisplayItem`/
  `CouncilEvidenceAudit` bodies (now resolving the status helpers via the import).

## Data flow / behavior

Unchanged. Status helpers are pure relocations; the retrieval-trace component renders identically.

## Edge cases

- **No circular import:** `CouncilPanel` → (`CouncilRetrievalTrace`, `councilTransparency`,
  `councilHighlight`); `CouncilRetrievalTrace` → (`lib/bible`, `councilTransparency`, `councilHighlight`);
  none import `CouncilPanel`. One-directional.
- **Name collisions in `councilTransparency`** → check before appending; reuse byte-identical pre-existing
  defs (as F8 did with `normalizeLabel`).
- **Inline union vs `EvidenceStatus`** → keep verbatim inline union to avoid behavior/signature drift.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / the multiple import adjustments.
- **Full `npm run check`** green (real exit code).
- **`npm run test:e2e:build`** — full suite. `council-mock.spec.ts` renders the retrieval trace
  (`data-testid="council-retrieval-trace"`) + the evidence audit (uses the lifted status helpers). Flaky-
  cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails.
- **Status-helper collision in councilTransparency** → check-and-reuse; tsc errors on duplicate.
- **Accidental edit** → verbatim; reviewer diffs each moved function against the original.

## Rollout

Single feature branch `decompose-council-retrieval-trace`. Files:
- **New:** `app/src/features/council/CouncilRetrievalTrace.tsx`.
- **Modify:** `app/src/features/council/councilTransparency.ts` (append 5 helpers),
  `app/src/features/council/CouncilPanel.tsx` (remove 2 regions; adjust 3 import groups; add 1 import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
