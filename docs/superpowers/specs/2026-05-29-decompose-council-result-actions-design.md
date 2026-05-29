# Decompose God-Components F11 — Extract CopyAsMarkdownButton + AddToTheologyMenu from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-result-actions`)
- **Theme:** F — Decompose god-components, sub-project 11 (fourth CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~2,521 lines (after F8–F10). The Council result toolbar has two action controls —
**Copy-as-Markdown** and **Add-to-Theology** — plus the markdown-rendering helpers behind the former.
These are two distinct concerns sharing a toolbar; extracting them into two single-concern modules removes
~245 lines and isolates the markdown-serialization logic and the theology-linking flow.

## Goals

1. Move `CopyAsMarkdownButton` + its exclusive helpers (`renderResponseAsMarkdown`,
   `appendJudgmentMarkdown`, `formatPositionRating`) into `features/council/CouncilMarkdownExport.tsx`.
2. Move `AddToTheologyMenu` into `features/council/AddToTheologyMenu.tsx`.
3. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/state/logic — verbatim.
- No change to `formatCouncilTransparencyMarkdown` (stays in `councilTransparency`, imported by the new
  markdown module).
- No extraction of the other clusters (judgment, evidence/retrieval, position-comparison, voices).

## Boundary analysis (from grounding)

**Markdown-export concern (all exclusive to this concern):**
- `CopyAsMarkdownButton({ response, question, judgment })` (1087–1116) — rendered at 355. State `copied`;
  calls `renderResponseAsMarkdown` + `navigator.clipboard`.
- `renderResponseAsMarkdown(r, question, judgment)` (1206–1243) — used only at 1098; calls
  `appendJudgmentMarkdown` + `formatCouncilTransparencyMarkdown`.
- `appendJudgmentMarkdown(lines, judgment)` (1245–1283) — used only at 1234; calls `formatPositionRating`.
- `formatPositionRating(value: PositionUserRating)` (969–983) — used **only** at 1270 (despite its name,
  the judgment panel does NOT use it; grep confirms def@969 + use@1270 only).

**Theology-linking concern:**
- `AddToTheologyMenu({ sessionId, question, response })` (1118–1204) — rendered at 350. State
  `open`/`topics`/`topicId`/`status`; calls `listTheologyTopics` + `createTheologyLink`.

**CouncilPanel imports to DROP after the move** (cluster-only):
- functions `createTheologyLink`, `listTheologyTopics`;
- type `TheologyTopic`;
- from `councilTransparency`: `formatCouncilTransparencyMarkdown` (used only at 1235).

**CouncilPanel imports to KEEP:**
- `CouncilJudgment` (state at 91 + judgment cluster 527/532/575/…);
- `PositionUserRating` (still used at 861, `e.target.value as PositionUserRating`, in the judgment panel);
- `CouncilResponse` (widely used).

**New-module imports:**
- `CouncilMarkdownExport.tsx`: react `useState`; from `lib/bible` types `CouncilJudgment`,
  `CouncilResponse`, `PositionUserRating`; from `./councilTransparency` `formatCouncilTransparencyMarkdown`.
- `AddToTheologyMenu.tsx`: react `useState`; from `lib/bible` `createTheologyLink`, `listTheologyTopics`,
  types `CouncilResponse`, `TheologyTopic`.

## Design

### New `app/src/features/council/CouncilMarkdownExport.tsx`

```tsx
import { useState } from "react";
import type { CouncilJudgment, CouncilResponse, PositionUserRating } from "../../lib/bible";
import { formatCouncilTransparencyMarkdown } from "./councilTransparency";

export function CopyAsMarkdownButton({ … }: { … }) { /* ← verbatim 1087–1116 */ }

function renderResponseAsMarkdown(…): string { /* ← verbatim 1206–1243 */ }
function appendJudgmentMarkdown(lines: string[], judgment?: CouncilJudgment | null) { /* ← verbatim 1245–1283 */ }
function formatPositionRating(value: PositionUserRating) { /* ← verbatim 969–983 */ }
```

### New `app/src/features/council/AddToTheologyMenu.tsx`

```tsx
import { useState } from "react";
import { createTheologyLink, listTheologyTopics, type CouncilResponse, type TheologyTopic } from "../../lib/bible";

export function AddToTheologyMenu({ … }: { … }) { /* ← verbatim 1118–1204 */ }
```

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** two regions: `formatPositionRating` (969–983) and the contiguous block 1087–1283
  (`CopyAsMarkdownButton` + `AddToTheologyMenu` + `renderResponseAsMarkdown` + `appendJudgmentMarkdown`).
- **Add** imports: `import { CopyAsMarkdownButton } from "./CouncilMarkdownExport";` and
  `import { AddToTheologyMenu } from "./AddToTheologyMenu";`.
- **Drop** from the `lib/bible` import: `createTheologyLink`, `listTheologyTopics`, `type TheologyTopic`.
- **Drop** from the `councilTransparency` import: `formatCouncilTransparencyMarkdown`.
- **Keep** unchanged: the toolbar call sites — `<AddToTheologyMenu … />` (350) and
  `<CopyAsMarkdownButton response={response} question={question} judgment={judgment} />` (355).

## Data flow / behavior

Unchanged. Both components receive the same props from the result toolbar and behave identically; the
markdown serialization produces byte-identical output (same helper chain).

## Edge cases

- **No circular import:** `CouncilPanel` → (`CouncilMarkdownExport`, `AddToTheologyMenu`); both →
  (`lib/bible` [+ `councilTransparency` for the markdown module]); `councilTransparency` → `lib/bible`.
  One-directional.
- **`formatPositionRating` exclusivity:** confirmed used only at 1270; moves with `appendJudgmentMarkdown`.
  If it stayed in CouncilPanel it would become an unused private function.
- **`PositionUserRating` kept** (used at 861) while `formatPositionRating` moves — both files import the
  type from `lib/bible`; tsc flags any mistake.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / wrong import drops.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` renders the result
  toolbar (the "Copy as markdown" + "Add to Theology" controls); `smoke.spec.ts` links a Council session
  to Theology. NOTE: wdio specs run as one grouped session; a contiguous block of unrelated failures is the
  known flaky cascade — re-run `npm run test:e2e` (no rebuild) to confirm before treating as real.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails the build.
- **Accidental edit during the move (esp. the `renderResponseAsMarkdown` line construction or the
  `AddToTheologyMenu` async `onSave` payload)** → verbatim; reviewers diff against the original.

## Rollout

Single feature branch `decompose-council-result-actions`. Files:
- **New:** `app/src/features/council/CouncilMarkdownExport.tsx`, `app/src/features/council/AddToTheologyMenu.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove 2 regions; add 2 imports; drop 4 symbols
  across 2 import groups).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
