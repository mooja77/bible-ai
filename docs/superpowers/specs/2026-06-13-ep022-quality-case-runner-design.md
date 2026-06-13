# EP-022: Quality-case schema + runner — Design

- **Date:** 2026-06-13
- **Status:** Implemented (schema + validator + resolution-rule gate)
- **Gate:** AI quality (Gate 4)
- **Source:** `docs/development-implementation-plan.md` EP-022; schema per the
  EP-012 drafts (`docs/quality-ops-plan.md`, `docs/ai-risk-eval-plan.md`).

## Background

The plan calls for a machine-readable quality-case schema and a fixture runner
around the AI path, so S0/S1/repeated-S2 AI failures must become regression
fixtures (or accepted-risk entries) before they count as resolved. None existed.
The frontend has no unit harness, but the repo already runs `node --test
"sidecar/tests/*.test.mjs"` in `npm run check` -- a real, provider-free test home.

## Change

- **`scripts/run-quality-cases.mjs`** -- pure exports + a CLI:
  - `SEVERITIES`, `STATUSES`, `FAILURE_CLASSES` (the EP-012 vocabularies).
  - `validateQualityCase(case)` -> schema errors (required fields + enum checks).
  - `resolutionViolations(cases)` -> enforces the quality-ops rule: a resolved
    S0/S1 (or recurred S2) case must link a regression fixture; an
    `accepted_risk` case must carry a written rationale.
  - Run directly, it loads every `app/tests/quality-cases/*.json`, validates them,
    and exits non-zero on any schema error or rule violation.
- **`app/tests/quality-cases/example-fabricated-citation.json`** -- a template
  case so the runner has input and contributors have a worked example.
- **Wired into `npm run check`**: `node --check` + a real run of the runner, so a
  malformed or rule-violating quality case fails the build.

## Scope

- This packet delivers the schema + validation + resolution-rule gate (the
  testable, provider-free core). Running fixtures through the *live* sidecar
  (real providers) is out of scope -- it needs provider keys and is covered by
  the existing `scripts/verify-real-council-qa.mjs` path. Per-failure-class
  response checks (e.g. fabricated-citation detection over a response object) are
  a natural follow-up that can reuse this module's vocabulary.

## Testing

- **8 unit tests** in `sidecar/tests/quality-cases.test.mjs`: complete case
  validates; missing fields / unknown enums are caught; the resolution rule
  (resolved S0 needs a fixture; S2 only when recurred; accepted_risk needs a
  rationale). RED first (module missing).
- The runner itself runs in `npm run check` against the example case.
- `npm run check` green (74 sidecar tests incl. the 8 new; runner gate passes).
