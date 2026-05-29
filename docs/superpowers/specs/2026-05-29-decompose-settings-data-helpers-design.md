# Onboarding & Settings D6 — Extract data/import-parsing helpers from SettingsPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-settings-data-helpers`)
- **Theme:** D — Onboarding & settings, sub-project 6 (second SettingsPanel decomposition slice)

## Problem

`SettingsPanel.tsx` is ~1,441 lines (after D5). The next clean leaf is the contiguous block of **pure
data/JSON-parsing helpers** (1360–1436): module-entry reader-target resolution + resource-metadata
parsing. They have no React/state — pure functions over typed inputs. Extracting them into
`features/settings/settingsData.ts` removes ~77 lines, verbatim.

## Goals

1. Move the 7 helpers into `features/settings/settingsData.ts`.
2. `SettingsPanel.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to logic — verbatim.
- `hasSettingValue` (1438) stays (settings-value helper, used widely — different concern).

## Boundary analysis (from grounding)

Contiguous block 1360–1436:
- `moduleEntryReaderTarget(entry: ModuleEntry)` (1360) — used by render (1062) → **export**. Uses
  `readPositiveInteger`/`readString` + `readJsonRecord`(via metadata).
- `readPositiveInteger`/`readString`/`readRecord`/`readJsonRecord` — used only within the cluster → private.
- `resourceSourceStatus(source: ResourceSource): DataSourceStatus` (1400) — used by render (1137) →
  **export**.
- `resourceSourceMetadata(source: ResourceSource)` (1415) — used by render (1131) → **export**.

**Types:** `ModuleEntry`, `ResourceSource` (lib/bible); `DataSourceStatus` (from `./SettingsPrimitives`,
D5). All needed by the new module.

**SettingsPanel imports after the move:** `ModuleEntry` STAYS (used at 132, `useState<ModuleEntry[]>`);
`ResourceSource` STAYS (resourceSources state); `DataSourceStatus` was imported (D5) only for
`resourceSourceStatus`'s return type → now unused → **drop** from the `SettingsPrimitives` import.

**New-module imports:** `import type { ModuleEntry, ResourceSource } from "../../lib/bible";` +
`import type { DataSourceStatus } from "./SettingsPrimitives";`. (`.ts` — no JSX.)

## Design

### New `app/src/features/settings/settingsData.ts`

```ts
import type { ModuleEntry, ResourceSource } from "../../lib/bible";
import type { DataSourceStatus } from "./SettingsPrimitives";

export function moduleEntryReaderTarget(entry: ModuleEntry) { /* ← verbatim */ }
function readPositiveInteger(value: unknown) { /* ← verbatim */ }
function readString(value: unknown) { /* ← verbatim */ }
function readRecord(value: unknown): Record<string, unknown> { /* ← verbatim */ }
function readJsonRecord(value: string | null | undefined) { /* ← verbatim */ }
export function resourceSourceStatus(source: ResourceSource): DataSourceStatus { /* ← verbatim */ }
export function resourceSourceMetadata(source: ResourceSource) { /* ← verbatim */ }
```

### `app/src/features/settings/SettingsPanel.tsx` (modify)

- **Remove** the block 1360–1436.
- **Add** `import { moduleEntryReaderTarget, resourceSourceStatus, resourceSourceMetadata } from "./settingsData";`.
- **Drop** `type DataSourceStatus` from the `./SettingsPrimitives` import (now unused; keep the 9 components
  + `type SetupPath`). tsc is the arbiter.
- **Keep** unchanged: the call sites (1062/1131/1137); `ModuleEntry`/`ResourceSource` imports.

## Edge cases

- **No circular import:** `SettingsPanel` → `settingsData` → (`lib/bible`, `SettingsPrimitives`);
  `SettingsPrimitives` → `react`. One-directional.
- **`DataSourceStatus` drop** → tsc errors if still used (it isn't, after the move).

## Testing

- **`npm run build`** (tsc) + full **`npm run check`** green.
- **`npm run test:e2e:build`** — full suite. `release-readiness.spec.ts` renders the Data Sources screen
  (uses `resourceSourceStatus`/`resourceSourceMetadata` via `SourceStatusBadge`). Flaky-cascade re-run.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails.
- **Accidental edit** → extracted verbatim (via `sed`) + full-span diff against the original.

## Rollout

Single feature branch `decompose-settings-data-helpers`. Files:
- **New:** `app/src/features/settings/settingsData.ts`.
- **Modify:** `app/src/features/settings/SettingsPanel.tsx` (remove the block; add 1 import; drop
  `DataSourceStatus`).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
