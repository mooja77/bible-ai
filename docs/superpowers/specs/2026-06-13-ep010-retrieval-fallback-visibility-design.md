# EP-010: Retrieval fallback visibility — Design

- **Date:** 2026-06-13
- **Status:** Implemented
- **Gate:** AI trust / Study Packet audit (Gate 4)
- **Source:** `docs/development-implementation-plan.md` EP-010; ground-truthed in
  `docs/reviews/2026-06-13-ep-roadmap-ground-truth.md`.

## Background

The search command (`search`, `lib.rs`) reports `degraded` + `degraded_reason`
when semantic retrieval falls back to keyword, and the Reader search UI surfaces
it (`searchDegraded` in `App.tsx`). The **Council** retrieval path
(`retrieve_evidence`) did not: it silently downgrades semantic to keyword (when
the translation has no embeddings, or the Ollama embed call fails) and the
returned `retrieval_mode` reflects the *actual* mode (e.g. "fts"), but **no
reason** was captured. A user reading a Council result or export saw "fts" with
no indication that they had asked for meaning search and it was unavailable.
`retrieval_fallback_reason` existed nowhere in the codebase.

## Change

End-to-end plumbing of a Council retrieval fallback reason:

- **`council_retrieval_fallback_reason(wanted_semantic, translation, has_embeddings,
  embed_ok)`** -- a pure helper returning the reason or `None`:
  - not semantic -> `None`
  - semantic + no embeddings -> "No meaning index for {translation}; used keyword
    search instead."
  - semantic + embeddings + embed call failed -> "Meaning search needs Ollama
    running; used keyword search instead."
  - semantic + embeddings + embed ok -> `None`
- **`retrieve_evidence`** tracks `embed_ok` (set false in the embed-error branch)
  and now returns `(evidence, mode, fallback_reason)`.
- **`ask_council`** persists `result["retrieval_fallback_reason"]` (String or
  Null), so it is saved into the council session and returned to the UI.
- **Type**: `CouncilResponse.retrieval_fallback_reason?: string | null` (`bible.ts`).
- **UI**: `CouncilPanel` renders an amber note
  (`data-testid="council-retrieval-fallback"`) below the retrieval badge when set.
- **Export**: `CouncilMarkdownExport` adds a `> Retrieval note: ...` blockquote.

`wanted_semantic` is the already-mock-gated `use_semantic`, so mock-council runs
(which disable semantic) never report a fallback.

## Testing

- **4 new Rust unit tests** on `council_retrieval_fallback_reason` (the bug-prone
  decision logic): not-wanted -> None; no-embeddings -> names translation +
  keyword; embed-failed -> keyword; success -> None. RED first (function missing).
- The render/export are simple conditionals on the typed field; verified by
  `tsc` (vite build) + full e2e no-regression. They cannot be triggered in the
  mock e2e environment (semantic is disabled there), so they are build-verified,
  consistent with the unit-tested decision logic.
- `cargo test` 101/101; full `npm run check` green; `npm run test:e2e:build`.
