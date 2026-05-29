# Onboarding & Settings D8 — Extract DataSourcesSection from SettingsPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-settings-data-sources`)
- **Theme:** D — Onboarding & settings, sub-project 8 (fourth SettingsPanel slice — first stateful section)

## Problem

`SettingsPanel.tsx` is ~1,266 lines. The first stateful section to extract is **Data Sources**
(`data-testid="data-sources-screen"`, 1065–1159) — and it's the cleanest: it reads only the `translations`
prop + `resourceSources` state, with no handlers, and all its helpers are already extracted (D5/D6).
Extracting it (passing those two as props) removes ~95 lines.

## Goals

1. Move the Data Sources section into `features/settings/DataSourcesSection.tsx` as a 2-prop component.
2. `SettingsPanel.tsx` compiles and behaves identically (the `data-sources-screen` testid renders).

## Non-goals (YAGNI)

- No change to markup — verbatim JSX.
- `resourceSources` state + its load effect STAY in SettingsPanel (passed as a prop); no other stateful
  section is touched.

## Boundary analysis (from grounding)

The section (1065–1159) reads:
- `translations` (a SettingsPanel prop) — the bundled-translations list.
- `resourceSources` (state, `useState<ResourceSource[]>`) — the Open Resource Library list.
- `DEFERRED_DATA_SOURCES` (const, 63–73) — used ONLY here → move with the component.
- `resourceSourceMetadata` / `resourceSourceStatus` (from `./settingsData`) — used ONLY here.
- `SourceStatusBadge` (from `./SettingsPrimitives`) — used ONLY here (1085/1110/1150).
No handlers, no `onJumpToVerse`, no other state.

**SettingsPanel imports after the move:** `translations` prop stays (also used by the Retrieval-translation
select); `resourceSources` state + its load effect stay (passed as prop). `SourceStatusBadge` →
**drop** from the `./SettingsPrimitives` import; `resourceSourceStatus` + `resourceSourceMetadata` →
**drop** from the `./settingsData` import (all now section-only). tsc is the arbiter.

**New-module imports:** `import type { ResourceSource, Translation } from "../../lib/bible";` +
`import { SourceStatusBadge } from "./SettingsPrimitives";` + `import { resourceSourceStatus,
resourceSourceMetadata } from "./settingsData";`.

## Design

### New `app/src/features/settings/DataSourcesSection.tsx`

```tsx
import type { ResourceSource, Translation } from "../../lib/bible";
import { SourceStatusBadge } from "./SettingsPrimitives";
import { resourceSourceStatus, resourceSourceMetadata } from "./settingsData";

const DEFERRED_DATA_SOURCES = [ /* ← verbatim 63–73 */ ];

export function DataSourcesSection({
  translations,
  resourceSources,
}: {
  translations: Translation[];
  resourceSources: ResourceSource[];
}) {
  return (
    /* ← verbatim <section data-testid="data-sources-screen"> JSX 1065–1159 */
  );
}
```

### `app/src/features/settings/SettingsPanel.tsx` (modify)

- **Remove** the `DEFERRED_DATA_SOURCES` const (63–73) and the Data Sources `<section>` (1065–1159).
- **Replace** the section with `<DataSourcesSection translations={translations} resourceSources={resourceSources} />`.
- **Add** `import { DataSourcesSection } from "./DataSourcesSection";`.
- **Drop** `SourceStatusBadge` from the `./SettingsPrimitives` import and `resourceSourceStatus` +
  `resourceSourceMetadata` from the `./settingsData` import (now unused; tsc arbiter).
- **Keep** `translations`/`resourceSources` + the resource-load effect unchanged.

## Data flow / behavior

Unchanged — the section renders identically from `translations` + `resourceSources`.

## Edge cases

- **No circular import:** `SettingsPanel` → `DataSourcesSection` → (`lib/bible`, `SettingsPrimitives`,
  `settingsData`). One-directional.
- **Import drops** → tsc errors if any dropped symbol is still used (none are, after the move).

## Testing

- **`npm run build`** (tsc) + full **`npm run check`** green.
- **`npm run test:e2e:build`** — `release-readiness.spec.ts` asserts `data-sources-screen` + text ("KJV",
  "World English Bible", "Bundled", "Deferred", "Phase 13"); `backup-restore.spec.ts` "imports resource
  JSON and makes entries searchable" renders the Open Resource Library list. Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / wrong import drop** → tsc fails.
- **Accidental JSX edit** → section sed-extracted verbatim + JSX diff against the original; the
  release-readiness e2e asserts the rendered testid/text.

## Rollout

Single feature branch `decompose-settings-data-sources`. Files:
- **New:** `app/src/features/settings/DataSourcesSection.tsx`.
- **Modify:** `app/src/features/settings/SettingsPanel.tsx` (remove const + section; add component + import;
  drop 3 now-unused imports).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
