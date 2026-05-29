# Decompose God-Components F16 — Extract highlight/evidence-text utilities from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `decompose-council-highlight`)
- **Theme:** F — Decompose god-components, sub-project 16 (ninth CouncilPanel slice — leaf of the result-view chain)

## Problem

`CouncilPanel.tsx` is ~1,427 lines. The remaining clusters center on `CouncilResultView`'s subgraph. The
safe **bottom** of that chain is the pure highlight/evidence-text utilities (971–1056): `HighlightedText`
(+ its private regex helpers) and the two evidence-verse Map builders. Extracting them first gives the
later evidence/result clusters a stable leaf module to import.

## Goals

1. Move `HighlightedText`, `splitHighlightedText`, `normalizedHighlightTerms`, `buildEvidenceTermsByVerse`,
   `buildRetrievedCitationByVerse`, `escapeRegExp`, `COMMON_QUERY_WORDS` into
   `features/council/councilHighlight.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/logic — verbatim.
- No extraction of the evidence/result components that USE these (separate later slices).

## Boundary analysis (from grounding)

Contiguous block 971–1056, pure (no other CouncilPanel component referenced):
- `HighlightedText({ text, terms })` (971–984) — renders `<mark>`/`<span>` only; uses
  `splitHighlightedText`. Used by CouncilPanel evidence components at 755, 877, 942 → **EXPORT**.
- `splitHighlightedText` (986–997) — uses `normalizedHighlightTerms`, `escapeRegExp`. Private.
- `normalizedHighlightTerms` (999–1015) — uses `COMMON_QUERY_WORDS`. Private.
- `buildEvidenceTermsByVerse(response)` (1017–1025) — used at 715 → **EXPORT**.
- `buildRetrievedCitationByVerse(response)` (1027–1036) — used at 897 → **EXPORT**.
- `escapeRegExp` (1038–1040) — private.
- `COMMON_QUERY_WORDS` (1042–1056) — `const`; used by `normalizedHighlightTerms`. Private. (Declaration
  order preserved — it's referenced only at call time, so no TDZ concern.)

**Dependencies:** only `CouncilResponse` (lib/bible) for the two Map builders. The highlight functions are
pure string/regex. `HighlightedText` is JSX → file is `.tsx`, no explicit react import (automatic runtime).

**CouncilPanel after move:** no remaining refs to `splitHighlightedText`/`normalizedHighlightTerms`/
`escapeRegExp`/`COMMON_QUERY_WORDS` (all block-internal). Imports the 3 exported names. `CouncilResponse`
stays (used everywhere). No `lib/bible`/`councilTransparency` import changes.

## Design

### New `app/src/features/council/councilHighlight.tsx`

```tsx
import type { CouncilResponse } from "../../lib/bible";

export function HighlightedText({ text, terms }: { text: string; terms: string[] }) { /* ← verbatim 971–984 */ }
function splitHighlightedText(text: string, terms: string[]) { /* ← verbatim 986–997 */ }
function normalizedHighlightTerms(text: string, terms: string[]) { /* ← verbatim 999–1015 */ }
export function buildEvidenceTermsByVerse(response: CouncilResponse) { /* ← verbatim 1017–1025 */ }
export function buildRetrievedCitationByVerse(response: CouncilResponse) { /* ← verbatim 1027–1036 */ }
function escapeRegExp(value: string) { /* ← verbatim 1038–1040 */ }
const COMMON_QUERY_WORDS = new Set([ /* ← verbatim 1042–1056 */ ]);
```

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** the contiguous block 971–1056.
- **Add** `import { HighlightedText, buildEvidenceTermsByVerse, buildRetrievedCitationByVerse } from "./councilHighlight";`.
- **Keep** unchanged: the call sites (715, 755, 877, 897, 942).

## Data flow / behavior

Unchanged. Pure utilities relocated; same outputs.

## Edge cases

- **No circular import:** `CouncilPanel` → `councilHighlight` → `lib/bible` (type only). One-directional.
- **`const` ordering:** `COMMON_QUERY_WORDS` stays last (referenced only at call time) — verbatim order, no TDZ.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **Full `npm run check`** green (real exit code).
- **`npm run test:e2e:build`** — full suite. `council-mock.spec.ts` renders evidence/retrieval views that
  use `HighlightedText`. Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference** → tsc fails.
- **Accidental edit** → extracted verbatim (via `sed`) + diffed; only the `export` prefixes differ.

## Rollout

Single feature branch `decompose-council-highlight`. Files:
- **New:** `app/src/features/council/councilHighlight.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the block; add 1 import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
