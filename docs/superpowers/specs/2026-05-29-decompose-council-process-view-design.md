# Decompose God-Components F8 — Extract CouncilProcessView from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-process-view`)
- **Theme:** F — Decompose god-components, sub-project 8 (first CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is **3,159 lines** — the single largest file and now the worst god-component (App.tsx
is down to ~1,474). It contains a ~338-line main component plus ~60 helper components/functions in clear
clusters. This sub-project extracts the first cohesive, prop-driven cluster — **the "How the Council
reached this" process view** — using the proven verbatim-sibling pattern (F1–F5), establishing the
CouncilPanel decomposition approach.

## Goals

1. Move `CouncilProcessView` + its exclusive helpers into `features/council/CouncilProcessView.tsx`,
   verbatim.
2. Move the 3 **shared** label/voice helpers (`countVoiceMentions`/`labelsOverlap`/`normalizeLabel`) into
   the existing `features/council/councilTransparency.ts` (no duplication; both CouncilPanel and the new
   module import them).
3. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to any component's markup/props/logic — verbatim.
- No extraction of the other CouncilPanel clusters (judgment, argument-maps, evidence/retrieval,
  position-comparison, voices, markdown-export) — separate future sub-projects.
- No refactor of the main `CouncilPanel` component body.

## Boundary analysis (from grounding)

**Process-view cluster (exclusive — used only by the process view):**
- `CouncilProcessView({ response: CouncilResponse })` (1735–1833) — rendered once by `CouncilPanel` at
  line 365 (`<CouncilProcessView response={response} />`).
- `ProcessMetric` (1835–1851), `ProcessStep` (1853–1873) — pure presentational, props only.
- `ArgumentComparison` (1875–1910) → renders `ArgumentSnapshot` (1912–1937) — pure, `CouncilPosition`.
- `countEvidenceClassifications(evidence, synthesis)` (1939–1960) — used only at 1742.
- `buildComparisonReasons({…})` (1978–2017) — used only at 1748; takes precomputed counts, calls no
  shared helper.

**Shared helpers (used elsewhere in CouncilPanel too → must NOT be trapped in the new module):**
- `countVoiceMentions(voices, label)` (1962–1966) — used by the process view (1746/1747) **and**
  `CouncilWinnerSummary` (2050) + `PositionCard` (2234). Calls `labelsOverlap`.
- `labelsOverlap(a, b)` (1968–1972) — used directly in `CouncilResultView` (1689) + `CouncilVoiceMatrix`
  (2516), and by `countVoiceMentions`. Calls `normalizeLabel`.
- `normalizeLabel(label)` (1974–1976) — used only by `labelsOverlap`.
→ Move all three into `councilTransparency.ts`. `countVoiceMentions` + `labelsOverlap` exported;
`normalizeLabel` private (only `labelsOverlap` uses it). `councilTransparency.ts` already imports
`CouncilVoice` from `lib/bible`, so no new imports are needed there.

**Types used by the new module:** `CouncilResponse`, `CouncilPosition`, `CouncilResult`,
`RetrievedEvidence` (all from `lib/bible`). `CouncilVoice` is only referenced via the imported
`countVoiceMentions` signature, so the module itself need not import it (tsc confirms the exact set).

## Design

### `councilTransparency.ts` (modify — append)

```ts
export function countVoiceMentions(voices: CouncilVoice[], label: string) {
  return voices.filter((voice) =>
    voice.result?.positions.some((position) => labelsOverlap(position.label, label)),
  ).length;
}

export function labelsOverlap(a: string, b: string) {
  const first = normalizeLabel(a);
  const second = normalizeLabel(b);
  return first === second || first.includes(second) || second.includes(first);
}

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
```
(Verbatim from CouncilPanel 1962–1976. `CouncilVoice` already imported at the top of the file.)

### New `features/council/CouncilProcessView.tsx`

```tsx
import type {
  CouncilPosition,
  CouncilResponse,
  CouncilResult,
  RetrievedEvidence,
} from "../../lib/bible";
import { countVoiceMentions } from "./councilTransparency";

export function CouncilProcessView({ response }: { response: CouncilResponse }) {
  // ← verbatim 1735–1833
}

// ← ProcessMetric, ProcessStep, ArgumentComparison, ArgumentSnapshot,
//   countEvidenceClassifications, buildComparisonReasons — all verbatim, private
```
(Exact import set finalized by tsc; the listed types are the expected set.)

### `CouncilPanel.tsx` (modify)

- **Remove** the entire 1735–2017 block (the 5 components + `countEvidenceClassifications` +
  `countVoiceMentions`/`labelsOverlap`/`normalizeLabel` + `buildComparisonReasons`).
- **Add** imports: `import { CouncilProcessView } from "./CouncilProcessView";` and extend/refresh the
  `councilTransparency` import to include `countVoiceMentions, labelsOverlap` (CouncilPanel still uses
  `labelsOverlap` at 1689/2516 and `countVoiceMentions` at 2050/2234).
- **Keep** unchanged: the `<CouncilProcessView response={response} />` call site (365) and all
  `labelsOverlap`/`countVoiceMentions` call sites (1689, 2050, 2234, 2516).

## Data flow / behavior

Unchanged. `CouncilPanel` still passes `response` to `<CouncilProcessView>`; the moved helpers compute
identically. The shared label/voice helpers now live in `councilTransparency` but behave the same.

## Edge cases

- **No circular import:** `CouncilPanel` → (`CouncilProcessView`, `councilTransparency`);
  `CouncilProcessView` → (`lib/bible`, `councilTransparency`); `councilTransparency` → `lib/bible` only.
  One-directional.
- **`labelsOverlap`/`countVoiceMentions` still used in CouncilPanel** → imported from
  `councilTransparency`; tsc flags if the import is wrong/unused.
- **`normalizeLabel` private** in `councilTransparency` (only `labelsOverlap` uses it) — must NOT be
  exported, must NOT remain referenced from CouncilPanel (grounding confirms CouncilPanel never calls
  `normalizeLabel` directly).

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports / wrong import sets.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. Council coverage: `council-mock.spec.ts`
  (submits/renders/persists a Council session — renders the result view incl. the process view) and
  `council-follow-up.spec.ts`. The process view renders with `data-testid="council-process-view"`. NOTE:
  `smoke.spec.ts` Theology-linking tests are known-flaky — re-run `npm run test:e2e` (no rebuild) to
  confirm before treating as a real failure.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / mis-scoped shared helper** → tsc fails the build (e.g. if `countVoiceMentions`
  were trapped in the new module, CouncilPanel's 2050/2234 uses would be undefined).
- **Accidental edit during the move** → verbatim; reviewers diff the moved code against the original.
- **Wrong import set in the new module** → tsc fails (unused/missing type import).

## Rollout

Single feature branch `decompose-council-process-view`. Files:
- **New:** `app/src/features/council/CouncilProcessView.tsx`.
- **Modify:** `app/src/features/council/councilTransparency.ts` (append 3 helpers),
  `app/src/features/council/CouncilPanel.tsx` (remove the block; add 2 imports).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
