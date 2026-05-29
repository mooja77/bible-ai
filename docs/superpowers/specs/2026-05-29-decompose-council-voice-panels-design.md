# Decompose God-Components F13 — Extract CouncilVoicePreview + CouncilRunningPanel from CouncilPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-council-voice-panels`)
- **Theme:** F — Decompose god-components, sub-project 13 (sixth CouncilPanel slice)

## Problem

`CouncilPanel.tsx` is ~1,856 lines (after F8–F12). The voice-preview concern — the pre-run/during-run
panels that show which provider voices will/are running — is a fully self-contained contiguous block
(396–516). Extracting it removes ~120 lines.

## Goals

1. Move `getCouncilVoices`, `hasSettingValue`, `CouncilVoicePreview`, `CouncilRunningPanel` into
   `features/council/CouncilVoicePanels.tsx`, verbatim.
2. `CouncilPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props/logic — verbatim.
- No extraction of the voice-*result* concern (`CouncilVoiceMatrix`/`VoicesAuditTrail`/`VoiceRow`) — that
  is the separate F14 (it leans on shared helpers `buildVoiceAgreementMatrix`/`labelsOverlap`/
  `formatPercent`).

## Boundary analysis (from grounding)

Contiguous block 396–516, fully self-contained:
- `getCouncilVoices(settings?: AppSettings)` (396–437) — pure; builds the voice list from provider keys;
  uses `hasSettingValue` + `AppSettings` fields. Returns `{ voices, noProvidersConfigured }`. Used only at
  440 + 486.
- `CouncilVoicePreview({ settings })` (439–483) — pure presentational (`data-testid="council-voice-
  preview"`); rendered at 257.
- `CouncilRunningPanel({ settings, elapsed })` (485–512) — pure presentational (`data-testid="council-
  running-panel"`); rendered at 255.
- `hasSettingValue(value)` (514–516) — pure; used only by `getCouncilVoices` (397–400).

No hooks, no shared council helpers, no other CouncilPanel identifiers. Only external dependency is the
`AppSettings` type from `lib/bible`.

**CouncilPanel imports:** `AppSettings` stays (used widely elsewhere). Nothing to drop. `getCouncilVoices`/
`hasSettingValue` are local (not in any import) and exclusive to the block.

**New-module imports:** `import type { AppSettings } from "../../lib/bible";` only. No `react` import (no
hooks; JSX uses the automatic runtime).

## Design

### New `app/src/features/council/CouncilVoicePanels.tsx`

```tsx
import type { AppSettings } from "../../lib/bible";

function getCouncilVoices(settings?: AppSettings) { /* ← verbatim 396–437 */ }
export function CouncilVoicePreview({ settings }: { settings?: AppSettings }) { /* ← verbatim 439–483 */ }
export function CouncilRunningPanel({ settings, elapsed }: { settings?: AppSettings; elapsed: number }) { /* ← verbatim 485–512 */ }
function hasSettingValue(value: string | null | undefined) { /* ← verbatim 514–516 */ }
```
(`getCouncilVoices` + `hasSettingValue` private; `CouncilVoicePreview` + `CouncilRunningPanel` exported.)

### `app/src/features/council/CouncilPanel.tsx` (modify)

- **Remove** the contiguous block 396–516 (the four functions).
- **Add** `import { CouncilVoicePreview, CouncilRunningPanel } from "./CouncilVoicePanels";`.
- **Keep** unchanged: the call sites `<CouncilRunningPanel settings={settings} elapsed={elapsed} />` (255)
  and `<CouncilVoicePreview settings={settings} />` (257); the `AppSettings` import (used elsewhere).

## Data flow / behavior

Unchanged. The main component still passes `settings`/`elapsed`; the panels render identically.

## Edge cases

- **No circular import:** `CouncilPanel` → `CouncilVoicePanels` → `lib/bible` (type only). One-directional.
- **`AppSettings` retained** in CouncilPanel (many uses) — tsc flags if mistakenly dropped.
- **`getCouncilVoices`/`hasSettingValue` exclusivity** confirmed (only block-internal uses) — they move
  fully; no back-import.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **Full `npm run check`** green (capture the REAL npm exit code via redirect-then-`$?`).
- **`npm run test:e2e:build`** — full suite as regression. `council-mock.spec.ts` renders the council
  flow; the running panel (`council-running-panel`) and preview (`council-voice-preview`) appear during the
  submit/loading path. NOTE: wdio specs run as one grouped session; a contiguous block of unrelated
  failures is the known flaky cascade — re-run `npm run test:e2e` (no rebuild) to confirm before treating
  as real.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference** → tsc fails the build.
- **Accidental edit during the move** → verbatim; diff the moved block against the original.

## Rollout

Single feature branch `decompose-council-voice-panels`. Files:
- **New:** `app/src/features/council/CouncilVoicePanels.tsx`.
- **Modify:** `app/src/features/council/CouncilPanel.tsx` (remove the block; add 1 import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
