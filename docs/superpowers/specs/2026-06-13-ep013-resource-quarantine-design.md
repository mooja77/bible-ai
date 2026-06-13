# EP-013: Resource import quarantine — Design

- **Date:** 2026-06-13
- **Status:** Implemented (import-time review marker; UI surfacing is a follow-up)
- **Gate:** Data trust / content trust (Gate 2)
- **Source:** `docs/development-implementation-plan.md` EP-013 (quarantine half);
  decision classes in `docs/content-bom.md` (EP-003 draft).

## Background

The size-budget half of EP-013 shipped earlier (`69dd79a`). The quarantine half:
a resource source imported from backup JSON must not silently be treated as
reviewed/trusted. Nothing recorded review status on import, so an imported source
looked the same as a vetted one.

## Change

`apply_resource_review_marker(metadata_json)` (pure, unit-tested) stamps a
`review_status` onto an imported resource source's metadata:

- `bundled` -- if the source declares `source_status: bundled`/`built-in` (trusted).
- `reviewed` -- if it carries a non-empty `source_review` note.
- `unreviewed` -- otherwise (quarantined).

It is applied in the `resource_sources` arm of `normalize_import_row`, so every
backup-imported source gets a review marker. The marker is additive (it does not
remove `source_review` or other metadata), so existing displays are unaffected;
it records, in the data, whether a source has passed review.

## Scope / follow-ups

- This records the quarantine status in the data (the guarantee that an import
  cannot pose as reviewed). **Surfacing** an "unreviewed" badge in the Settings
  Data Sources UI (via `resourceSourceStatus`) and a **release-gate check** that
  fails when an unreviewed source would ship are natural follow-ups that build on
  this marker -- they were left out to keep the packet bounded and testable.
- The decision-class enforcement (reject redistribution-negative sources for
  release) depends on the EP-003 content BOM being finalized.

## Testing

- `imported_resource_sources_get_a_review_marker`: `{}` -> `unreviewed`; a source
  with `source_review` -> `reviewed`; a `bundled` source -> `bundled`. RED first.
- Full Rust suite (112) still green, including the resource-import tests; the
  marker is additive so it does not break existing import behavior.
- `cargo test` 112; `npm run check` green; `npm run test:e2e:build`.
