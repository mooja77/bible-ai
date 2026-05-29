# Onboarding & Settings D5 — Extract presentational primitives from SettingsPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Draft (branch `decompose-settings-primitives`)
- **Theme:** D — Onboarding & settings, sub-project 5 (first SettingsPanel decomposition slice)

## Problem

`SettingsPanel.tsx` is ~1,650 lines — the largest single component. The safest first decomposition slice
is the cohesive block of **pure presentational primitives** at the bottom of the file (1431–1647): nine
props-only components with no SettingsPanel state. Extracting them (plus the two shared string-literal
types they need) into `SettingsPrimitives.tsx` removes ~220 lines, verbatim.

## Goals

1. Move the 9 primitives + the `SetupPath`/`DataSourceStatus` types into
   `features/settings/SettingsPrimitives.tsx`, verbatim.
2. `SettingsPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to markup/props — verbatim.
- No extraction of the stateful sections or data helpers (`resourceSourceStatus`, the import parsers,
  `hasSettingValue`) — they stay.

## Boundary analysis (from grounding)

Contiguous block 1431–1647, all props-only, no SettingsPanel state, no inter-dependencies among themselves:
`SetupPathButton`, `SetupPathDetails`, `SetupCheckPill`, `ProviderMiniStatus`, `SourceStatusBadge`,
`ProviderStatusCard`, `InfoBlock`, `DiagnosticRow`, `Field`.

**Type threading:**
- `type SetupPath = "personal" | "local" | "gateway"` (line 91) — used by `SetupPathDetails` (moving) AND
  the main component's `setupPath` state (staying). → move to `SettingsPrimitives.tsx` (export); SettingsPanel
  imports it.
- `type DataSourceStatus = "bundled" | "user-imported" | "deferred"` (line 1387) — used by
  `SourceStatusBadge` (moving) AND `resourceSourceStatus` (staying, line 1389). → move to
  `SettingsPrimitives.tsx` (export); SettingsPanel imports it.

**Stays in SettingsPanel:** `hasSettingValue` (1427), `resourceSourceStatus` (1389), `resourceSourceMetadata`,
the import-parser helpers (`moduleEntryReaderTarget`/`readPositiveInteger`/`readString`/`readRecord`/
`readJsonRecord`), `moduleEntryReaderTarget` — none are primitives.

**New-module imports:** `import type { ReactNode } from "react";` (for `Field`). No `lib/bible` (the
primitives are pure; both types are defined in the module).

## Design

### New `app/src/features/council/.. → features/settings/SettingsPrimitives.tsx`

```tsx
import type { ReactNode } from "react";

export type SetupPath = "personal" | "local" | "gateway";
export type DataSourceStatus = "bundled" | "user-imported" | "deferred";

export function SetupPathButton({ … }) { /* ← verbatim 1431–1462 */ }
export function SetupPathDetails({ path }: { path: SetupPath }) { /* ← verbatim 1464–1512 */ }
export function SetupCheckPill({ … }) { /* ← verbatim */ }
export function ProviderMiniStatus({ … }) { /* ← verbatim */ }
export function SourceStatusBadge({ status }: { status: DataSourceStatus }) { /* ← verbatim */ }
export function ProviderStatusCard({ … }) { /* ← verbatim */ }
export function InfoBlock({ … }) { /* ← verbatim */ }
export function DiagnosticRow({ … }) { /* ← verbatim */ }
export function Field({ label, children }: { label: string; children: ReactNode }) { /* ← verbatim */ }
```

### `app/src/features/settings/SettingsPanel.tsx` (modify)

- **Remove** the `type SetupPath` def (91), the `type DataSourceStatus` def (1387), and the contiguous
  primitives block (1431–1647).
- **Add** `import { SetupPathButton, SetupPathDetails, SetupCheckPill, ProviderMiniStatus,
  SourceStatusBadge, ProviderStatusCard, InfoBlock, DiagnosticRow, Field, type SetupPath, type
  DataSourceStatus } from "./SettingsPrimitives";`.
- **Resolve** the `ReactNode` import: if SettingsPanel no longer uses `ReactNode` after `Field` moves, drop
  it from the react import (tsc arbiter); else keep.
- **Keep** unchanged: all call sites (the primitives are rendered throughout the main component), and
  `resourceSourceStatus` (now using the imported `DataSourceStatus`).

## Data flow / behavior

Unchanged. The primitives render identically from props; the two types are identical string-literal unions
relocated.

## Edge cases

- **No circular import:** `SettingsPanel` → `SettingsPrimitives` → `react` only. One-directional.
- **`ReactNode` in SettingsPanel** — verify post-move; drop if unused.
- **Both types used by staying code** → exported from the new module, imported back; tsc enforces.

## Testing

- **`npm run build`** (tsc) — catches dangling refs / unused imports.
- **Full `npm run check`** green.
- **`npm run test:e2e:build`** — full suite. `release-readiness.spec.ts` renders Provider Status (uses
  `ProviderStatusCard`), the setup-path tabs (`SetupPathButton`/`SetupPathDetails`), data-source badges
  (`SourceStatusBadge`); `settings-validation.spec.ts` + others render `Field`. Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / type-import mistake** → tsc fails.
- **Accidental edit during the move** → extracted verbatim (via `sed`) + full-span diff against the original;
  only the `export` prefixes + the two type-export lines differ.

## Rollout

Single feature branch `decompose-settings-primitives`. Files:
- **New:** `app/src/features/settings/SettingsPrimitives.tsx`.
- **Modify:** `app/src/features/settings/SettingsPanel.tsx` (remove 2 type defs + the block; add the import;
  resolve ReactNode).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
