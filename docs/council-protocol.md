# Council Protocol

This document records the implemented Council protocol: provider membership, prompt contract, response schema, normalization rules, persistence, and visible audit behavior. It is intentionally tied to the current sidecar implementation rather than an aspirational design.

## Purpose

The Council is used for disputed theological questions where a single answer would hide meaningful disagreement. It is designed to:

- Retrieve a shared evidence set from the local corpus.
- Ask each available provider to analyze the same question independently.
- Preserve defensible minority positions.
- Produce weighted positions with citations that link back to local `verse_id` values.
- Expose the process through UI visualizations and workspace export.

## Runtime Flow

Implemented flow:

1. The frontend calls `ask_council` with the question and retrieval options.
2. Rust retrieves candidate evidence from keyword, semantic, selected filter, and optional cross-reference paths.
3. Rust invokes the Node sidecar with the question, evidence, model/settings, retrieval options, and retrieved evidence.
4. The sidecar discovers available providers from local settings/environment.
5. Each available provider runs independently against the same question and evidence.
6. If multiple voices succeed, Claude synthesis clusters aligned positions and produces the final result.
7. If only one voice succeeds, that voice is passed through as the synthesis.
8. The full `CouncilResponse` is persisted to `council_sessions.response_json`.
9. The UI renders the synthesis plus process explanation, matrix, evidence tabs, retrieval trace, confidence rationale, source drawer, voices, and retrieved evidence audit.

Mock mode:

- `BIBLE_AI_MOCK_COUNCIL=1` returns deterministic local Council data for E2E tests.
- Mock mode still exercises persistence, UI rendering, workspace export, and delete/restore flows.

## Provider Membership

Provider wrappers are thin adapters. They call a model API, extract JSON, then normalize the response into the common `CouncilResult` shape.

Implemented provider behavior:

- `availableProviders(env)` returns providers that can run with the current environment/settings.
- `providerManifest(env, model)` records both available and skipped providers for UI audit.
- Provider failures are retained in `voices[]` with `status: "error"` and shown in the audit trail.
- No provider receives API keys in the rendered Council source drawer.

Council synthesis currently depends on Claude availability for multi-voice orchestration. If synthesis fails after voices succeed, the sidecar logs the failure and falls back to the first successful voice.

## Voice Prompt Contract

Each voice receives:

- The disputed question.
- Candidate evidence lines formatted as translation, citation, `verse_id`, and text.
- A strict JSON output request.

Voice rules:

- Enumerate seriously defensible positions, including minority positions.
- Assign each position a weight in `[0, 1]`; weights should sum to `1.0`.
- Cite only verses whose `verse_id` appears in the evidence set.
- Preserve dissent rather than merging all views into a vague compromise.
- Classify every candidate evidence verse as `used`, `supporting`, `conflicting`, or `ignored`.
- Explain confidence and per-position limitations in user-facing terms.

The current voice prompt lives in `app/sidecar/providers/_shared.mjs` as `VOICE_SYSTEM_PROMPT`.

## Synthesis Prompt Contract

Synthesis receives the full structured responses from successful voices.

Synthesis rules:

- Cluster aligned positions across voices.
- Average weights within clusters, treating omitted positions as zero weight for that voice.
- Preserve positions named by only one voice unless other voices explicitly reject them.
- Normalize final weights to `1.0`.
- Carry through the strongest citations, support/challenge IDs, confidence rationale, and `why_not_higher`.
- Merge evidence classifications and preserve unresolved tensions.

The current synthesis prompt lives in `app/sidecar/providers/_shared.mjs` as `SYNTHESIS_SYSTEM_PROMPT`.

## Response Schema

Top-level response:

```ts
interface CouncilResponse {
  synthesis: CouncilResult;
  voices: CouncilVoice[];
  manifest: CouncilProviderInfo[];
  retrieval_mode?: "semantic" | "fts" | "hybrid" | "hybrid+xref";
  evidence_count?: number;
  retrieval_options?: CouncilRetrievalOptions;
  retrieved_evidence?: RetrievedEvidence[];
}
```

Council result:

```ts
interface CouncilResult {
  positions: CouncilPosition[];
  dissent_notes?: string;
  unresolved_tensions?: string[];
  synthesis: string;
  confidence: "low" | "medium" | "high";
  confidence_rationale?: string;
  evidence_classification?: CouncilEvidenceClassification[];
}
```

Position:

```ts
interface CouncilPosition {
  label: string;
  weight: number;
  raw_weight?: number;
  summary: string;
  evidence: CouncilEvidence[];
  supporting_evidence_ids?: number[];
  challenging_evidence_ids?: number[];
  why_not_higher?: string;
  confidence_rationale?: string;
  cluster_id?: string;
  source_position_labels?: string[];
}
```

Evidence:

```ts
interface CouncilEvidence {
  verse_id: number;
  citation: string;
  translation_code: string;
  quote: string;
  reasoning: string;
}

interface CouncilEvidenceClassification {
  verse_id: number;
  status: "used" | "supporting" | "conflicting" | "ignored";
  reasoning: string;
}

interface RetrievedEvidence {
  verse_id: number;
  translation_code: string;
  book_id: number;
  book_name: string;
  book_osis: string;
  chapter: number;
  verse: number;
  text: string;
  source: string;
  score?: number;
  from_verse_id?: number;
  matched_terms?: string[];
  semantic_score?: number;
  keyword_score?: number;
  cross_reference_weight?: number;
}
```

Voice:

```ts
interface CouncilVoice {
  provider: string;
  display_name: string;
  status: "ok" | "error" | "skipped";
  result: CouncilResult | null;
  error: string | null;
  duration_ms: number;
}
```

## Normalization Rules

`normaliseResult` is the compatibility boundary for provider output.

It currently:

- Rejects missing/empty `positions`.
- Renormalizes weights when total weight is not close to `1.0`.
- Preserves `raw_weight` before renormalization.
- Converts missing optional arrays to empty arrays.
- Sanitizes `supporting_evidence_ids` and `challenging_evidence_ids` to positive safe integers.
- Converts missing `why_not_higher`, `confidence_rationale`, and `dissent_notes` to empty strings.
- Converts missing `unresolved_tensions` and `source_position_labels` to empty arrays.
- Defaults invalid confidence to `medium`.
- Drops invalid evidence classification rows.

`parseResponse` tolerates fenced JSON, surrounding prose, trailing commas, and JS-style comments before parsing.

## Retrieval Trace Semantics

Retrieved evidence is candidate evidence, not final argument strength.

Sources:

- `fts`: keyword/full-text search.
- `semantic`: semantic embedding similarity.
- `cross-ref`: cross-reference expansion from an already selected/retrieved verse.
- `selected-range`: selected passage seed when range-based Council actions are used.

Trace fields:

- `matched_terms` explains keyword relevance.
- `semantic_score` explains semantic relevance.
- `keyword_score` explains keyword contribution.
- `cross_reference_weight` explains cross-reference contribution.
- `from_verse_id` identifies the cross-reference source when available.

The UI labels evidence classification separately from retrieval source so users can see the difference between "this verse was retrieved" and "this verse was used."

## Transparency UI Mapping

The UI derives audit views from `CouncilResponse` using `app/src/features/council/councilTransparency.ts`.

Visible sections:

- Winner summary: why the leading argument ranked highest.
- Position cards: weighted positions and primary cited evidence.
- Process view: retrieval, provider analyses, clustering, and audit exposure.
- Position comparison: side-by-side comparison of any two returned positions.
- Voice matrix: final positions versus each provider voice.
- Evidence tabs: cited/supporting/challenging/ignored evidence per position.
- Retrieval trace: why each passage entered the evidence pool.
- Confidence rationale: returned or derived confidence factors.
- Source drawer: structured response, synthesis, voices, options, evidence, and manifest.
- Voice audit trail: raw independent provider outputs.
- Retrieved evidence audit: classified candidate evidence list.

## Persistence

Council sessions are stored in `user.sqlite`:

- `question`
- `status`
- `created_at`
- `completed_at`
- `retrieval_mode`
- `retrieval_options_json`
- `retrieved_evidence_json`
- `response_json`

The app must preserve unknown JSON fields in `response_json` so old and new sessions remain forward-compatible.

## Export Contract

Workspace export includes the same transparency data through Markdown rendering:

- Council Process
- Why This Won
- Position Comparison
- Voice Agreement Matrix
- Evidence by Position
- Retrieval Trace
- Confidence Rationale
- Voices

HTML and PDF exports consume the same Markdown path.

## Failure Handling

Handled failure modes:

- No providers available: Council command fails with a user-visible error.
- Individual provider failure: voice row is retained with status `error`.
- All voices fail: Council command fails with first error.
- Synthesis failure: sidecar falls back to first successful voice.
- Missing optional fields in old sessions: helpers render fallback text/empty sections.
- Clipboard failure in source drawer: copy action silently fails without corrupting state.

## Verification

Primary verification:

```powershell
cd app
npm run check:full
npm run release:build
```

E2E coverage includes mock Council submission, process view, winner summary, position comparison, matrix focus, evidence tabs, retrieval trace highlighting, confidence rationale, source drawer JSON, workspace export, session restore, and deletion.
