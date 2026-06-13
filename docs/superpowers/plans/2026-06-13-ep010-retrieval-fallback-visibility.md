# EP-010: Retrieval fallback visibility — Implementation Plan

> The Council silently downgraded semantic retrieval to keyword without saying
> why. Capture the reason, persist it, and render it in the UI and exports.

**Spec:** `docs/superpowers/specs/2026-06-13-ep010-retrieval-fallback-visibility-design.md`
**Verification:** `cargo test` + `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify: `retrieve_evidence` (lib.rs) returns only `(evidence, mode)`; the
  search path reports `degraded_reason` but the Council path captured nothing;
  `retrieval_fallback_reason` existed nowhere.
- [x] RED: 4 unit tests on a new pure `council_retrieval_fallback_reason`;
  confirmed failing (function missing).
- [x] GREEN (Rust): implement the helper; track `embed_ok` in `retrieve_evidence`;
  return the 3-tuple; persist `result["retrieval_fallback_reason"]` in
  `ask_council`.
- [x] GREEN (frontend): add the type field (`bible.ts`); render an amber note in
  `CouncilPanel` (data-testid `council-retrieval-fallback`); add a blockquote in
  `CouncilMarkdownExport`.
- [x] Verify: `cargo test` 101/101; fmt + clippy `-D warnings` clean;
  `npm run check` green; `npm run test:e2e:build` (no regression).

## Notes

- Pure-helper design made the decision logic unit-testable despite
  `retrieve_evidence` being async + DB/Ollama-bound.
- `wanted_semantic` = the mock-gated `use_semantic`, so mock e2e never reports a
  fallback (semantic disabled there) -> render path is build-verified, not
  e2e-asserted. A future fixture with `retrieval_fallback_reason` set could add a
  render assertion.
- Builds on the lib.rs serialization chain after EP-007 (next is EP-019/EP-020).
