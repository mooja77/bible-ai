# EP-022b: Fabricated-citation quality check — Design

- **Date:** 2026-06-13
- **Status:** Implemented (detector + CI gate)
- **Gate:** AI quality (Gate 4)
- **Source:** EP-022 follow-up ("per-failure-class response checks") and the
  failure classes in `docs/ai-risk-eval-plan.md`.

## Background

EP-022 added the quality-case schema + resolution gate. The next concrete step is
actually *detecting* a failure class objectively. The clearest, most checkable is
**fabricated citation**: a Council position citing a verse that was never in the
retrieved evidence (the model citing Scripture from outside the evidence pool).

## Change

`scripts/quality-checks.mjs`:

- `findFabricatedCitations(response)` (pure, unit-tested): returns every position
  citation whose `verse_id` is not in `response.retrieved_evidence`. If the
  response has no retrieved evidence, the check is **inconclusive** (returns `[]`)
  rather than flagging every citation -- it judges only against a real pool.
- Run directly, it gates the shipped `tests/fixtures/council-quality.json`
  fixtures and exits non-zero on any fabricated citation. Wired into
  `npm run check`, so a fixture (or a future captured real response) that cites
  outside its evidence fails the build.

## Testing

- 4 unit tests: a citation within the pool is clean; a citation outside the pool
  is flagged (with verse + citation); an empty pool is inconclusive; and all three
  shipped fixtures (heavy-disagreement, provider-failure, sparse-evidence) contain
  no fabricated citations. RED first (module missing).
- `npm run check` green (85 sidecar tests incl. the 4 new; the gate runs over the
  fixtures).

## Follow-ups

- More detectors reusing this shape: missing-primary-passage, misquoted-passage
  (compare `quote` to the corpus text), hidden-disagreement. Each is a pure
  function over a response + the same CI-gate pattern.
