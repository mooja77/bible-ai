# EP-022: Quality-case schema + runner — Implementation Plan

> No machine-readable quality-case schema or runner existed. Add one in the
> provider-free `node --test` ecosystem, and gate it in `npm run check`.

**Spec:** `docs/superpowers/specs/2026-06-13-ep022-quality-case-runner-design.md`
**Verification:** `npm run check` (build + 74 sidecar tests + runner gate).

## Tasks (as executed)

- [x] Pick the testable home: `node --test "sidecar/tests/*.test.mjs"` (already in
  `npm run check`), since the frontend has no unit harness.
- [x] RED: `sidecar/tests/quality-cases.test.mjs` (8 tests) referencing the
  not-yet-existing module; confirmed failing.
- [x] GREEN: `scripts/run-quality-cases.mjs` -- `validateQualityCase`,
  `resolutionViolations`, the enum vocabularies, and a CLI that validates
  `app/tests/quality-cases/*.json`.
- [x] Add the example case `example-fabricated-citation.json`.
- [x] Wire `node --check` + a real runner invocation into `npm run check`.
- [x] Verify: `npm run check` green (74 sidecar tests; runner validates the
  example). No e2e needed (node/script only, no app-binary or UI impact).

## Notes

- Schema follows the EP-012 drafts; the rule (S0/S1/recurred-S2 resolved -> must
  link a fixture; accepted_risk -> must have a rationale) is the load-bearing
  guarantee and is fully unit-tested.
- Live-provider fixture runs remain in `scripts/verify-real-council-qa.mjs`;
  per-failure-class response checks are a follow-up reusing this vocabulary.
