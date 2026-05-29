# Onboarding & Settings D7 — Extract static info sections from SettingsPanel.tsx — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `decompose-settings-info-sections`)
- **Theme:** D — Onboarding & settings, sub-project 7 (third SettingsPanel decomposition slice)

## Problem

`SettingsPanel.tsx` is ~1,367 lines. Two render sections — **License & Attribution** (1192–1234) and
**About & Distribution** (1236–1264) — are purely static (const-driven + `InfoBlock`, no component state).
Extracting them into `features/settings/SettingsInfoSections.tsx` removes ~75 lines of JSX + 3 constants.

## Goals

1. Move the two sections + their constants into `SettingsInfoSections.tsx` as no-prop components.
2. `SettingsPanel.tsx` compiles and behaves identically (same `data-testid`s render).

## Non-goals (YAGNI)

- No change to markup/copy — verbatim JSX.
- The **Data Sources** section stays (it reads `resourceSources` state); `DEFERRED_DATA_SOURCES` stays.

## Boundary analysis (from grounding)

- **License & Attribution** `<section data-testid="license-attribution-screen">` (1192–1234) — maps
  `SOURCE_ATTRIBUTIONS` + 4 `InfoBlock`s. No props/state.
- **About & Distribution** `<section data-testid="about-distribution-screen">` (1236–1264) — `InfoBlock`s
  incl. `${APP_NAME} ${APP_VERSION}` + static release notes. No props/state.
- **Constants:** `APP_NAME` (59), `APP_VERSION` (60), `SOURCE_ATTRIBUTIONS` (75–106) — used ONLY by these
  sections → move. `DEFERRED_DATA_SOURCES` (62–73) → used by the Data Sources section (stays) → stays.
- **`InfoBlock`** — used ONLY by these two sections (1217–1229, 1249–1252) → after the move it is unused in
  SettingsPanel → drop from the `./SettingsPrimitives` import (the new module imports it instead).

## Design

### New `app/src/features/settings/SettingsInfoSections.tsx`

```tsx
import { InfoBlock } from "./SettingsPrimitives";

const APP_NAME = "Bible AI";
const APP_VERSION = "0.1.0";
const SOURCE_ATTRIBUTIONS = [ /* ← verbatim 75–106 */ ];

export function LicenseAttributionSection() {
  return (
    /* ← verbatim License <section> JSX 1192–1234 */
  );
}

export function AboutDistributionSection() {
  return (
    /* ← verbatim About <section> JSX 1236–1264 */
  );
}
```

### `app/src/features/settings/SettingsPanel.tsx` (modify)

- **Remove** the `APP_NAME`/`APP_VERSION` consts (59–60) and `SOURCE_ATTRIBUTIONS` (75–106).
- **Replace** the License `<section>` (1192–1234) with `<LicenseAttributionSection />` and the About
  `<section>` (1236–1264) with `<AboutDistributionSection />`.
- **Add** `import { LicenseAttributionSection, AboutDistributionSection } from "./SettingsInfoSections";`.
- **Drop** `InfoBlock` from the `./SettingsPrimitives` import (now unused in SettingsPanel; tsc arbiter).
- **Keep** `DEFERRED_DATA_SOURCES` + the Data Sources section unchanged.

## Data flow / behavior

Unchanged — the sections are static; same DOM (incl. the e2e `data-testid`s) renders.

## Edge cases

- **No circular import:** `SettingsPanel` → `SettingsInfoSections` → `./SettingsPrimitives` →
  `react`. One-directional.
- **`InfoBlock` drop** → tsc errors if still used in SettingsPanel (it isn't, after the move).

## Testing

- **`npm run build`** (tsc) + full **`npm run check`** green.
- **`npm run test:e2e:build`** — `release-readiness.spec.ts` asserts the `license-attribution-screen` +
  `about-distribution-screen` testids + text ("Bible AI 0.1.0", "eBible.org", "OpenBible",
  "Personal-use release candidate"). Flaky-cascade re-run protocol.
- No new test (behavior-preserving move).

## Risks & mitigations

- **A missed reference / `InfoBlock` drop mistake** → tsc fails.
- **Accidental JSX edit** → sections sed-extracted verbatim; reviewers/diff confirm the moved JSX matches
  the original; the release-readiness e2e asserts the rendered text/testids.

## Rollout

Single feature branch `decompose-settings-info-sections`. Files:
- **New:** `app/src/features/settings/SettingsInfoSections.tsx`.
- **Modify:** `app/src/features/settings/SettingsPanel.tsx` (remove 3 consts; replace 2 sections with
  component tags; add import; drop `InfoBlock`).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
