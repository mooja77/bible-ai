# Decompose God-Components F9 — Extract CouncilResearchTrail from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `decompose-council-research-trail`)
- **Theme:** F — Decompose god-components, sub-project 9 (second CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~2,878 lines (after F8). The next cleanest self-contained cluster is the
**Research Trail** — `CouncilResearchTrail` + its exclusive helper `buildResearchTrail`. Unlike F8, this
slice has **no shared helpers** — a pure two-function move with one call site, the simplest possible
CouncilPanel extraction.

## Goals

1. Move `CouncilResearchTrail` + `buildResearchTrail` into `features/council/CouncilResearchTrail.tsx`,
   verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/logic — verbatim.
- No extraction of the other clusters (argument-maps, judgment, evidence/retrieval, etc.).

## Boundary analysis (from grounding)

- `CouncilResearchTrail({ response: CouncilResponse })` (988–1042) — rendered once by `CouncilPanel` at
  line 378 (`<CouncilResearchTrail response={response} />`). Calls `buildResearchTrail(response)`; body
  references only `response`, its `trail` local, and the `ResearchTrailEvent` fields.
- `buildResearchTrail(response)` (1238–1295) — used **only** at 989 (inside `CouncilResearchTrail`).
  Returns `ResearchTrailEvent[]`; builds a fallback trail from `response.synthesis`/`voices`/
  `retrieved_evidence`. No other CouncilPanel function calls it.
- **Types:** `CouncilResponse` + `ResearchTrailEvent` (both from `lib/bible`). `ResearchTrailEvent` is
  imported in CouncilPanel (line 21) and used **only** by `buildResearchTrail` (1241) → after the move it
  becomes unused in CouncilPanel and must be dropped from the `lib/bible` type import.
- **No shared helpers**, no local types, no closure dependencies. Fully self-contained.

## Design

### New `app/src/features/council/CouncilResearchTrail.tsx`

```tsx
import type { CouncilResponse, ResearchTrailEvent } from "../../lib/bible";

export function CouncilResearchTrail({ response }: { response: CouncilResponse }) {
  // ← verbatim 988–1042
}

function buildResearchTrail(response: CouncilResponse) {
  // ← verbatim 1238–1295 (private; only CouncilResearchTrail uses it)
}
```

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** `CouncilResearchTrail` (988–1042) and `buildResearchTrail` (1238–1295).
- **Add** `import { CouncilResearchTrail } from "./CouncilResearchTrail";`.
- **Drop** `type ResearchTrailEvent,` from the `lib/bible` import (line 21) — now unused in CouncilPanel.
- **Keep** unchanged: the `<CouncilResearchTrail response={response} />` call site (378).

## Data flow / behavior

Unchanged. `CouncilPanel` still passes `response`; the component renders identically.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilResearchTrail` → `lib/bible` only. One-directional.
- **`ResearchTrailEvent` drop:** tsc flags it as unused if not dropped (and would error if dropped while
  still used — grounding confirms `buildResearchTrail` was its only CouncilPanel user).

## Testing

- **`npm run build`** (tsc) — catches dangling refs / the unused-import drop.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` renders a full Council
  session (the Research Trail renders with `data-testid="council-research-trail"`). NOTE: wdio specs run
  as one grouped session; a contiguous block of failures unrelated to council is the known flaky cascade
  — re-run `npm run test:e2e` (no rebuild) to confirm before treating as real.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails the build.
- **Accidental edit during the move** → verbatim; reviewers diff against the original.

## Rollout

Single feature branch `decompose-council-research-trail`. Files:
- **New:** `app/src/features/council/CouncilResearchTrail.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove 2 functions; add 1 import; drop 1 type
  import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
