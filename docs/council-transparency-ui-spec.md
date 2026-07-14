# Council Transparency UI Spec

This spec turns the Phase 12 plan into concrete screens, visualizations, explanations, and component contracts.

## Principles

- The user should be able to audit every claim from visible data.
- The first screen still prioritizes the answer; transparency appears directly below the synthesis, not hidden in settings.
- Visualizations explain the process, not hidden model thoughts.
- Every visualization needs a plain-language explanation and a fallback state.
- All scripture references remain clickable back to Reader.

## Result Page Layout

Order after a Council response:

1. Retrieval status row
2. Synthesis position cards
3. Winner summary inside the synthesis section
4. Process explanation
5. Side-by-side position comparison
6. Voice agreement matrix
7. Per-position evidence explorer
8. Retrieval trace
9. Confidence rationale
10. Raw source drawer
11. Voice audit trail
12. Retrieved evidence audit

The existing synthesis remains above the new visualizations so users can read the answer first, then inspect how it was produced.

## Visualization 1: Process Explanation

Component: `CouncilProcessView`

Purpose:

- Explain the Council pipeline in four visible steps.
- Show the user that a final position is weighted, not simply asserted.

Layout:

- Metric row:
  - Evidence considered
  - Independent voices
  - Preserved positions
  - Conflicting passages
- Step row:
  - Retrieve evidence
  - Separate analysis
  - Cluster arguments
  - Expose audit
- "Why this argument ranked higher" comparison:
  - Leading argument
  - Nearest alternative
  - Weight gap
  - Cited passage counts
  - Voice mention counts
  - Conflicting evidence count

Explanation text pattern:

```text
The synthesis assigned "{leader}" the largest final weight after clustering the voices.
It leads "{runner_up}" by {gap} percentage points.
{n} retrieved passages remained visible as conflicting evidence, so the ranking is not hiding objections.
```

Fallback states:

- If only one position exists: show "No separate runner-up position was returned."
- If no voices succeeded: this state should be impossible because Council errors before rendering, but show error text if encountered.
- If no retrieved evidence exists: show "No retrieved evidence was stored with this session."

## Visualization 2: Voice Agreement Matrix

Component: `CouncilVoiceMatrix`

Purpose:

- Show which providers supported each final position and how strongly.
- Reveal disagreement instead of reducing everything to one final answer.

Layout:

```text
Position              Final   Claude   OpenAI   Gemini   Disagreement
Complementarian       62%     70%      55%      60%      15 pts
Egalitarian           31%     25%      40%      28%      15 pts
Other                  7%      5%       5%      12%       7 pts
```

Visual encoding:

- Cell background intensity scales with weight.
- Final column uses amber.
- Voice columns use neutral-to-emerald intensity.
- Disabled columns show "not run", "no key", or "error".

Interaction:

- Click a cell to open the provider's matching position summary and citations.
- Click a row to highlight that position in the synthesis cards.
- The matrix shows the currently focused position below the table.

Matching logic:

- Phase 1: normalized label overlap.
- Phase 2: add `cluster_id` and `source_position_labels` to the synthesis output.

Explanation text:

```text
This matrix compares the final synthesis against each provider voice. A blank cell means that voice did not name a matching position.
```

Fallback states:

- One voice: show a compact "Single voice result" table.
- No matching position: show blank with tooltip "No matching position named by this voice."

## Visualization 3: Per-Position Evidence Explorer

Component: `CouncilEvidenceTabs`

Purpose:

- Show each argument's cited evidence and the evidence that supports or challenges it.
- Let users inspect why the argument is strong or limited.

Tabs:

- Cited
- Supporting
- Challenging
- Ignored

Evidence row fields:

- Citation button
- Translation code
- Source chip: keyword, semantic, cross-reference, range
- Status chip: used, supporting, conflicting, ignored
- Verse text
- Provider or synthesis reasoning
- Jump to Reader action

Tooltip behavior:

- Source chips describe how the passage entered the candidate evidence pool.
- Status chips describe whether the passage was used, supportive, conflicting, or ignored.

Challenging evidence copy:

```text
This passage was retained because it complicates or limits the argument. It does not automatically disprove the position.
```

Fallback:

- If `supporting_evidence_ids` is missing, use global classification status `supporting`.
- If `challenging_evidence_ids` is missing, use global classification status `conflicting`.
- If neither exists, show only cited evidence.

## Visualization 4: Retrieval Trace

Component: `CouncilRetrievalTrace`

Purpose:

- Explain why a verse entered the evidence pool.
- Separate retrieval relevance from theological argument strength.

Row layout:

- Citation
- Source chips:
  - keyword
  - semantic
  - cross-reference
  - selected range
- Score bar:
  - keyword score
  - semantic score
  - cross-reference weight
- Matched terms, where available
- From-citation for cross-references
- Highlighted matched terms inside verse text when the terms appear directly in the verse.

Explanation text:

```text
Retrieval finds candidate passages. The Council still decides whether each passage is used, supporting, conflicting, or ignored.
```

Fallback:

- If scores are missing, show source chips only.
- If matched terms are missing, omit the term row.

## Visualization 5: Confidence Rationale

Component: `CouncilConfidenceRationale`

Purpose:

- Explain why the answer is marked low, medium, or high confidence.

Inputs:

- `synthesis.confidence`
- `synthesis.confidence_rationale`
- provider count
- provider failure count
- disagreement score from matrix
- unresolved tensions
- evidence classification counts

Layout:

- Confidence badge
- Rationale paragraph
- Factors list:
  - Evidence coverage
  - Voice agreement/disagreement
  - Unresolved tensions
  - Provider failures
  - Conflicting evidence

Explanation text pattern:

```text
Confidence is {level} because {rationale}. The main limiting factors are {factors}.
```

Fallback:

- If no rationale was returned, derive a conservative explanation from disagreement, provider count, and unresolved tensions.

## Visualization 6: Raw Source Drawer

Component: `CouncilSourceDrawer`

Purpose:

- Let advanced users inspect the exact stored data.

Entry point:

- Button: "View source data"
- Location: right side of process explanation header.

Tabs:

- Response JSON
- Synthesis
- Provider voices
- Retrieval options
- Retrieved evidence
- Provider manifest

Actions:

- Copy current tab
- Copy full JSON

Safety:

- Never include environment variables.
- Never include API keys.
- Truncate extremely long text blocks with "Show more".

Explanation text:

```text
This is the structured data stored for the Council result. It is useful for auditing, debugging, and export verification.
```

## Workspace Export Rendering

Markdown sections for saved Council results:

```md
## Council Process

- Evidence considered: 60
- Voices run: 3
- Preserved positions: 2
- Conflicting passages: 4

### Why the leading argument ranked higher

...

## Voice Agreement Matrix

| Position | Final | Claude | OpenAI | Gemini | Disagreement |
|---|---:|---:|---:|---:|---:|

## Evidence by Position

### Position Name

#### Cited
...

#### Supporting
...

#### Challenging
...

## Retrieval Trace

| Citation | Source | Status | Score | Reason |
|---|---|---|---:|---|

## Confidence Rationale

...
```

HTML/PDF:

- Initially render the Markdown output.
- Later convert matrix and trace sections into styled tables before printing/PDF generation.

## Empty and Error States

- Provider error: show disabled voice matrix column and retain the error in the raw source drawer.
- Missing old-session fields: render available citations and show "This older saved result does not include detailed rationale fields."
- No challenging evidence: show "No challenging evidence was identified for this position."
- No supporting evidence beyond citations: show "No additional supporting passages were classified beyond the cited evidence."

## Component Build Order

1. Data helpers:
   - `buildCouncilEvidenceIndex`
   - `buildVoiceAgreementMatrix`
   - `buildRetrievalTraceRows`
   - `buildConfidenceFactors`
2. `CouncilVoiceMatrix`
3. `CouncilEvidenceTabs`
4. `CouncilRetrievalTrace`
5. `CouncilConfidenceRationale`
6. `CouncilSourceDrawer`
7. Export renderer helpers

## Test Targets

Add stable test IDs:

- `council-process-view`
- `council-voice-matrix`
- `council-evidence-tabs`
- `council-retrieval-trace`
- `council-confidence-rationale`
- `council-source-drawer`
- `council-source-json`

E2E assertions:

- Matrix contains final and voice weights.
- Evidence tabs switch between cited/supporting/challenging.
- Retrieval trace shows source chips.
- Confidence rationale shows limiting factors.
- Source drawer opens and copies JSON.
- Workspace Markdown preview contains process, matrix, evidence, retrieval trace, and confidence sections.
