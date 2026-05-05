# Council Transparency and Visualization Plan

This plan extends the current Council audit workflow so users can inspect how an answer was produced, why one argument received more weight than another, and where evidence or providers disagreed.

## Goals

- Make Council conclusions explainable without asking users to trust the app.
- Show the difference between final synthesis, individual provider voices, retrieved evidence, and app-derived visual summaries.
- Preserve minority views and objections as first-class data.
- Avoid exposing or implying hidden chain-of-thought. Visualizations must be derived from structured response fields, citations, retrieval metadata, provider outputs, and confidence/rationale text.
- Make the same transparency available in workspace exports.

## Phase 12A: Council Data Contract

Purpose: make visualizations reliable by enriching the structured Council response.

Add optional fields to `CouncilResult` and `CouncilPosition`:

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
}

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

Sidecar prompt updates:

- Ask each voice to include `supporting_evidence_ids`, `challenging_evidence_ids`, `why_not_higher`, and `confidence_rationale` per position.
- Ask synthesis to carry forward the strongest `why_not_higher` and confidence rationale for each final position.
- Keep all new fields optional during migration so older saved sessions still render.

Normalization rules:

- Drop evidence IDs that were not in retrieved evidence.
- Normalize missing arrays to `[]`.
- Normalize missing rationale strings to `""`.
- Keep provider failures visible in the voice audit.

## Phase 12B: Per-Position Evidence Tabs

Purpose: let users inspect an argument directly instead of reading a global evidence list.

UI:

- Each position card gets tabs or segmented controls:
  - Cited
  - Supporting
  - Challenging
  - Ignored nearby evidence, optional when relevant
- Evidence rows show citation, translation, retrieval source, classification badge, provider reasoning, and a Reader jump action.
- Challenging evidence should be visually distinct but not alarmist.

Data source:

- `position.evidence`
- `position.supporting_evidence_ids`
- `position.challenging_evidence_ids`
- `synthesis.evidence_classification`
- `response.retrieved_evidence`

Fallback:

- If the new per-position arrays are absent, derive tabs from citations and global classification.

## Phase 12C: Voice Agreement Matrix

Purpose: show which providers supported which positions and how strongly.

Visualization:

- Rows: final synthesized positions.
- Columns: provider voices that ran successfully.
- Cells: provider weight for the closest matching position, or `0%` / blank if absent.
- Cell color intensity maps to weight.
- Row footer shows final synthesis weight.
- Optional disagreement score: spread between min and max voice weights.

Matching:

- First pass: normalize labels and use substring overlap.
- Better pass: add explicit `cluster_id` or `source_position_labels` from synthesis.

UX behavior:

- Clicking a matrix cell expands the exact provider position summary and cited evidence.
- Failed/skipped voices appear as disabled columns with their error/no-key state.

## Phase 12D: Retrieval Trace Visualization

Purpose: show why each passage entered the evidence pool.

Data additions:

```ts
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

Visualization:

- Evidence list gets source chips: keyword, semantic, cross-reference, range seed.
- A compact stacked bar shows keyword/semantic/cross-reference contribution when scores exist.
- Cross-reference evidence shows "from" citation where available.
- Keyword evidence highlights matched terms in the verse text where possible.

Backend/Rust:

- Preserve FTS score and matched query terms when available.
- Preserve semantic distance/similarity when vector search is used.
- Preserve cross-reference source verse and weight.

## Phase 12E: Confidence Rationale

Purpose: explain why confidence is low, medium, or high.

UI:

- Confidence badge opens a small explanation panel.
- Show:
  - confidence label
  - synthesis confidence rationale
  - voice disagreement summary
  - evidence coverage summary
  - unresolved tensions

Rules:

- Low confidence should be tied to under-defined question, sparse evidence, strong unresolved tension, high voice disagreement, or provider failure.
- High confidence should still show what could weaken it.

## Phase 12F: Raw Source Drawer

Purpose: give advanced users a full audit trail.

UI:

- Add "View source data" button near the Council process view.
- Drawer tabs:
  - Response JSON
  - Provider voices
  - Retrieval options
  - Retrieved evidence
  - Manifest/providers
- Include copy buttons per tab.
- Mask secrets; no environment variables or API keys should appear.

Implementation:

- Render from already stored `CouncilResponse`.
- No extra persistence needed because saved sessions already store `response_json`.

## Phase 12G: Export Transparency

Purpose: exported workspace artifacts should preserve the audit.

Markdown export additions for Council results:

- Process summary
- Voice agreement matrix as a Markdown table
- Per-position cited/supporting/challenging evidence
- Confidence rationale
- Retrieval trace table
- Raw JSON omitted by default, with optional future advanced export toggle

HTML/PDF export:

- Reuse Markdown content initially.
- Later, add richer HTML tables for matrix and trace.

## Phase 12H: Visual Design

Components:

- `CouncilProcessView`
- `CouncilEvidenceTabs`
- `CouncilVoiceMatrix`
- `CouncilRetrievalTrace`
- `CouncilConfidenceRationale`
- `CouncilSourceDrawer`
- `CouncilTransparencyExport`

Design constraints:

- Use compact tables and segmented controls, not marketing-style cards.
- Keep primary synthesis readable first; transparency sections follow below.
- Do not require users to understand JSON to inspect the answer.
- Use tooltips for status chips: used, supporting, conflicting, ignored, failed, skipped.
- Keep matrix usable on narrow screens by allowing horizontal scroll.

Detailed UI behavior, explanation text, fallback states, export rendering, and test IDs are specified in [`council-transparency-ui-spec.md`](council-transparency-ui-spec.md).
The file-level execution sequence is specified in [`council-transparency-execution-plan.md`](council-transparency-execution-plan.md).

## Implementation Order

1. Extend TypeScript types and sidecar normalization for optional rationale and evidence-id fields.
2. Update mock Council data to include supporting/challenging evidence, `why_not_higher`, and confidence rationale.
3. Build `CouncilEvidenceTabs` inside position cards.
4. Build `CouncilVoiceMatrix`.
5. Add retrieval trace fields and UI.
6. Add confidence rationale panel.
7. Add raw source drawer with copy actions.
8. Add a top-level "why this ranked highest" summary.
9. Add a side-by-side position comparison view.
10. Highlight matched retrieval terms inside evidence text where possible.
11. Extend workspace Markdown/HTML/PDF exports.
12. Expand E2E coverage and release verification.

## E2E Coverage

Mock Council test should verify:

- Process view renders.
- Winner summary explains the leading argument.
- Position comparison shows leading and minority arguments side by side.
- Matrix shows leading and minority positions.
- Per-position tabs show cited and challenging evidence.
- Retrieved evidence highlights matched terms where possible.
- Confidence rationale is visible.
- Retrieval trace source chips render.
- Raw source drawer opens and includes response JSON.
- Workspace export includes process summary, matrix, and confidence rationale.

## Release Gate

After implementation:

```powershell
cd app
npm run check:full
npm run release:build
```
