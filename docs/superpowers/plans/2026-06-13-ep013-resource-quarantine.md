# EP-013: Resource import quarantine — Implementation Plan

> A resource source imported from backup JSON must not pose as reviewed. Stamp a
> review_status marker on import. (Size budgets were the earlier half, 69dd79a.)

**Spec:** `docs/superpowers/specs/2026-06-13-ep013-resource-quarantine-design.md`
**Verification:** `cargo test` + `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Find the seam: `normalize_import_row` resource_sources arm (user_db.rs).
- [x] RED: `imported_resource_sources_get_a_review_marker` (unreviewed / reviewed
  / bundled); confirmed failing (helper missing).
- [x] GREEN: `apply_resource_review_marker` (pure) stamps `review_status`; wired
  into the resource_sources import arm. Additive (keeps existing metadata).
- [x] Verify: `cargo test` 112 (no import regressions); fmt + clippy clean;
  `npm run check` green; `npm run test:e2e:build`.

## Notes

- The marker is in the data, so it cannot be bypassed; surfacing an "unreviewed"
  badge in the Data Sources UI and a release-gate rejection of unreviewed sources
  are follow-ups that build on it.
- Decision-class enforcement (redistribution-negative rejection) waits on the
  EP-003 content BOM being finalized.
