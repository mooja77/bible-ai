# Council Transparency Execution Plan

This document is the file-level implementation plan for Phase 12. It turns the visualization plan and UI spec into development milestones.

## Milestone 1: Data Contract and Normalization

Goal: make the existing Council response capable of powering all visualizations while remaining backward-compatible with saved sessions.

Files:

- `app/src/lib/bible.ts`
- `app/sidecar/providers/_shared.mjs`
- `app/sidecar/council.mjs`
- `docs/council-transparency-visualization-plan.md`

Tasks:

- Add optional fields to `CouncilPosition`:
  - `supporting_evidence_ids?: number[]`
  - `challenging_evidence_ids?: number[]`
  - `why_not_higher?: string`
  - `confidence_rationale?: string`
  - optional future `cluster_id?: string`
  - optional future `source_position_labels?: string[]`
- Add optional `confidence_rationale?: string` to `CouncilResult`.
- Update provider and synthesis prompts to request these fields.
- Update `normaliseResult` to sanitize all optional fields.
- Ensure old saved sessions render with fallback text and empty arrays.
- Expand mock Council output to include all new fields.

Acceptance criteria:

- TypeScript build passes.
- Mock Council returns at least two positions, cited/supporting/challenging evidence, `why_not_higher`, and confidence rationale.
- Older sessions without the new fields do not throw in the UI.

## Milestone 2: Shared Transparency Helpers

Goal: centralize all derived data so UI and export render from the same calculations.

Files:

- `app/src/features/council/councilTransparency.ts`
- `app/src/features/workspaces/workspaceMarkdown.ts`

New helper functions:

- `buildCouncilEvidenceIndex(response)`
- `buildVoiceAgreementMatrix(response)`
- `buildRetrievalTraceRows(response)`
- `buildConfidenceFactors(response)`
- `buildPositionEvidenceGroups(position, response)`
- `formatCouncilTransparencyMarkdown(response, question)`

Rules:

- Helpers must derive claims only from structured visible data.
- Helpers must tolerate missing optional fields.
- Voice matrix matching starts with normalized label overlap.
- Disagreement score is `maxVoiceWeight - minVoiceWeight` for matched voice weights.

Acceptance criteria:

- Helpers return deterministic output for mock Council data.
- Workspace export and UI can consume the same helper output.

## Milestone 3: Per-Position Evidence Explorer

Goal: make every position inspectable through cited, supporting, and challenging passages.

Files:

- `app/src/features/council/CouncilPanel.tsx`
- Optional extracted component: `app/src/features/council/CouncilEvidenceTabs.tsx`

UI:

- Add segmented controls inside each position card:
  - Cited
  - Supporting
  - Challenging
  - Ignored
- Each row shows citation, translation, source chip, classification badge, verse text, reasoning, and Reader jump.
- Challenging evidence includes explanatory copy that it complicates the argument without automatically disproving it.

Acceptance criteria:

- User can switch tabs without losing current Council result.
- Cited evidence remains visible for older saved sessions.
- Challenging evidence is visually distinct and readable.

## Milestone 4: Voice Agreement Matrix

Goal: show provider agreement and disagreement across final positions.

Files:

- `app/src/features/council/CouncilPanel.tsx`
- Optional extracted component: `app/src/features/council/CouncilVoiceMatrix.tsx`

UI:

- Table columns:
  - Position
  - Final
  - One column per provider voice
  - Disagreement
- Cell background intensity reflects weight.
- Failed/skipped providers display disabled cells with status.
- Clicking a cell reveals that provider's matching position summary and citations.

Acceptance criteria:

- Matrix renders for one voice and multiple voices.
- Matrix shows blank or `0%` when a provider did not name a position.
- Failed providers remain visible.

## Milestone 5: Retrieval Trace Visualization

Goal: explain why passages were retrieved before theological weighting.

Files:

- `app/src/lib/bible.ts`
- `app/src-tauri/src/db.rs`
- `app/src-tauri/src/lib.rs`
- `app/src/features/council/CouncilPanel.tsx`
- Optional extracted component: `app/src/features/council/CouncilRetrievalTrace.tsx`

Data fields:

- `matched_terms?: string[]`
- `semantic_score?: number`
- `keyword_score?: number`
- `cross_reference_weight?: number`

UI:

- Source chips: keyword, semantic, cross-reference, selected range.
- Compact score bar when score data exists.
- Cross-reference "from" citation when available.
- Matched terms when available.

Acceptance criteria:

- Existing retrieval still works when score fields are missing.
- Keyword and cross-reference sources are distinguishable.
- Retrieval trace explains that retrieval is candidate selection, not final argument strength.

## Milestone 6: Confidence Rationale

Goal: explain why confidence is low, medium, or high.

Files:

- `app/src/features/council/CouncilPanel.tsx`
- Optional extracted component: `app/src/features/council/CouncilConfidenceRationale.tsx`
- `app/sidecar/providers/_shared.mjs`

UI:

- Confidence badge opens or expands a rationale panel.
- Panel shows:
  - returned confidence rationale
  - evidence coverage
  - disagreement score
  - unresolved tensions
  - provider failures
  - conflicting evidence count

Acceptance criteria:

- If the sidecar returns no rationale, UI derives a conservative fallback.
- Low confidence is visibly tied to limiting factors.

## Milestone 7: Raw Source Drawer

Goal: allow advanced audit without requiring database access.

Files:

- `app/src/features/council/CouncilPanel.tsx`
- Optional extracted component: `app/src/features/council/CouncilSourceDrawer.tsx`

UI:

- Button: `View source data`
- Drawer tabs:
  - Response JSON
  - Synthesis
  - Provider voices
  - Retrieval options
  - Retrieved evidence
  - Provider manifest
- Copy current tab.
- Copy full response JSON.

Safety:

- Never render environment variables.
- Never render API keys.
- Drawer only uses already stored `CouncilResponse`.

Acceptance criteria:

- Drawer opens from current and restored Council sessions.
- JSON is pretty-printed and copyable.

## Milestone 8: Workspace Export Transparency

Goal: preserve transparency outside the app.

Files:

- `app/src/features/workspaces/workspaceMarkdown.ts`
- `app/src/features/workspaces/workspaceHtml.ts`
- Existing PDF export path that consumes Markdown
- `app/tests/e2e/workspace.spec.ts`

Markdown sections:

- Council Process
- Why This Won
- Position Comparison
- Voice Agreement Matrix
- Evidence by Position
- Retrieval Trace
- Confidence Rationale

Acceptance criteria:

- Markdown preview includes process, winner summary, position comparison, matrix, evidence, retrieval trace, and confidence sections for saved Council results.
- HTML and PDF exports include the same information through the Markdown renderer path.

## Milestone 9: Explanation Polish

Goal: make the ranking understandable without requiring the user to inspect every lower-level audit section.

Files:

- `app/src/features/council/CouncilPanel.tsx`
- `app/src/features/council/councilTransparency.ts`
- `app/tests/e2e/council-mock.spec.ts`
- `app/tests/e2e/workspace.spec.ts`

UI:

- Add a top-level winner summary above the position list.
- Show lead over the runner-up, matching voice count, evidence basis, visible challenges, and confidence rationale.
- Add a side-by-side position comparison selector for any two returned positions.
- Highlight matched retrieval terms in evidence text when those terms are present in the verse.
- Include winner summary and position comparison sections in exported Council Markdown.

Acceptance criteria:

- The leading argument can be understood from a compact summary.
- A user can compare the winner against a weaker argument without trusting only the final weight.
- Highlighting never invents terms; it only marks terms already present in retrieved evidence text.
- E2E coverage proves winner summary, position comparison, and highlighted evidence render in mock mode.

## Milestone 10: Testing and Release

Files:

- `app/tests/e2e/council-mock.spec.ts`
- `app/tests/e2e/workspace.spec.ts`
- `docs/testing-and-release-plan.md`
- `docs/implementation-checklist.md`

E2E coverage:

- Council process view still renders.
- Winner summary renders.
- Position comparison renders.
- Voice matrix renders final and voice weights.
- Evidence tabs switch between cited/supporting/challenging.
- Retrieval trace renders source chips.
- Retrieval trace highlights matched evidence text when available.
- Confidence rationale renders limiting factors.
- Source drawer opens and includes response JSON.
- Workspace Markdown preview includes transparency sections.

Verification:

```powershell
cd app
npm run check:full
npm run release:build
```

## Suggested Implementation Sequence

1. Milestone 1 and mock data.
2. Milestone 2 helpers.
3. Milestones 3 and 4 UI visualizations.
4. Milestones 5 and 6 explanation panels.
5. Milestone 7 source drawer.
6. Milestone 8 export.
7. Milestone 9 full verification.

This order keeps the data shape stable before building visual components and lets E2E tests use deterministic mock Council output.
