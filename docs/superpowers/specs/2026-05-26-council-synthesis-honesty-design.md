# Council Synthesis Honesty (Fallback Labeling) — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `council-synthesis-honesty`)
- **Theme:** B — Council AI trust/UX, sub-project 2
- **Owner:** John Moore

## Problem

The Council presents a "synthesis" as the headline answer. But `runCouncil` (`sidecar/council.mjs`)
produces that synthesis three different ways, and two of them are **silent**:

- **Consensus** (≥2 voices succeed, Claude synthesis runs): a real multi-voice synthesis.
- **Single voice** (`ok.length === 1`): `synthesis = ok[0].result` — one voice's analysis returned
  *as the synthesis*, with no indication.
- **Synthesis failed** (≥2 voices succeed but the synthesis call throws): the `catch` sets
  `synthesis = ok[0].result` — again one voice presented as the synthesis, logged to stderr only.

So a user can't tell a genuine multi-voice consensus from a single voice's opinion. For a tool
whose value proposition is weighing multiple AI voices on scripture, that's a trust problem.

(Out of scope: the frontend `buildFallbackArgumentMap` derives an argument *diagram* from a
position's own evidence when the model didn't supply one — a visualization, not a fabricated
conclusion. And `ensurePositionEvidence` already labels recovered evidence in its reasoning text.)

## Goals

1. Tell the user when the headline result is **not** a multi-voice consensus, and why.
2. Cover both silent paths: single-voice and synthesis-failed.
3. Keep the full result visible — the banner is an honest label above the existing synthesis, not a
   removal.

## Non-goals (YAGNI)

- No change to the council return contract beyond two additive, optional fields.
- No Rust change — `validate_council_response_value` only `.get()`s `synthesis`/`voices`/`manifest`
  (+ optional `retrieved_evidence`) and ignores unknown top-level fields, so new fields persist
  as-is. Confirmed.
- No labeling of `buildFallbackArgumentMap`-derived diagrams (separate, lower-priority concern).
- No relabeling/renaming the "Synthesis" panel (a banner is clearer and less disruptive).

## Approach

**Tag the response with how the synthesis was produced, and show a banner when it isn't a
consensus.** A pure helper computes the mode; `runCouncil` sets it on the response; the frontend
renders a banner above the primary synthesis view for the two non-consensus modes.

## Sidecar design (`sidecar/council.mjs`)

### `resolveSynthesisMode({ okCount, synthesisFailed })` (pure, exported)

```js
export function resolveSynthesisMode({ okCount, synthesisFailed }) {
  if (okCount <= 1) return "single_voice";
  if (synthesisFailed) return "synthesis_failed";
  return "consensus";
}
```

### `runCouncil` wiring

Track whether the synthesis call threw, then set the mode + the fallback voice name on the result:

- `ok.length === 1` → `synthesis = ok[0].result`; mode `single_voice`.
- `ok.length > 1`, synthesis succeeds → mode `consensus`.
- `ok.length > 1`, synthesis throws (existing `catch` falls back to `ok[0].result`) → mode
  `synthesis_failed`.

The returned object becomes `{ synthesis, voices, manifest, synthesis_mode, synthesis_voice }`,
where `synthesis_voice` is `ok[0].display_name` for the two non-consensus modes and omitted for
`consensus`. (Use `resolveSynthesisMode({ okCount: ok.length, synthesisFailed })`.)

### Mock mode

`mockCouncilResult` sets `synthesis_mode: "consensus"` (it deliberately exercises the consensus /
minority UI). This keeps the existing `council-mock` e2e unaffected (no banner in mock).

## Frontend design

- **`bible.ts`:** `CouncilResponse` gains optional `synthesis_mode?: "consensus" | "single_voice"
  | "synthesis_failed"` and `synthesis_voice?: string`.
- **`CouncilPanel.tsx`:** a `SynthesisModeBanner` rendered **once**, above the *primary* synthesis
  result view (the top-level `CouncilResultView` for `response.synthesis` — NOT the per-voice
  `CouncilResultView` inside expanded voice cards, and NOT in mock-consensus runs). Copy:
  - `single_voice`: *"Only one Council voice was available, so this is {synthesis_voice}'s analysis
    — not a multi-voice consensus."*
  - `synthesis_failed`: *"The synthesis step failed, so this shows {synthesis_voice}'s analysis
    instead of a combined consensus."*
  - `consensus` or missing: no banner.
  Styled as an amber `soft-card`/`meta` note (informational, not an error), with the
  `synthesis_voice` shown when present (fallback to "one voice" if absent).

## Data flow

```
runCouncil: ok = successful voices
  → ok.length === 1  → synthesis = ok[0].result; mode = single_voice; voice = ok[0].display_name
  → synthesis throws → synthesis = ok[0].result; mode = synthesis_failed; voice = ok[0].display_name
  → else             → synthesis = <real synthesis>; mode = consensus
  → response { synthesis, voices, manifest, synthesis_mode, synthesis_voice }
  → CouncilPanel: SynthesisModeBanner (only if mode is single_voice | synthesis_failed)
```

## Error handling / edge cases

- `synthesis_mode`/`synthesis_voice` optional everywhere; older persisted sessions (no field)
  render with no banner (treated as consensus) — no migration.
- `synthesis_failed` still returns a usable result (the first voice), now honestly labeled, rather
  than failing the whole run.
- Mock mode is `consensus` → unchanged behavior.

## Testing

- **Sidecar unit test** (`sidecar/tests/council.test.mjs`, `node --test`): `resolveSynthesisMode`
  returns `single_voice` for `okCount: 1` (regardless of `synthesisFailed`), `synthesis_failed` for
  `okCount: 3, synthesisFailed: true`, and `consensus` for `okCount: 3, synthesisFailed: false`.
- **Frontend:** verified by `npm run build`. No e2e — the single-voice / synthesis-failed paths
  can't be triggered deterministically in the mocked env (mock is `consensus`); the banner is a
  small conditional render.
- Full `npm run check` green (includes the sidecar tests) before merge.

## Risks & mitigations

- **Mock e2e regression** → mock explicitly set to `consensus`, so no banner appears in mock runs;
  existing `council-mock` assertions unaffected.
- **Banner shown on the wrong view** (e.g. on expanded voice cards) → it keys on the top-level
  `response.synthesis_mode` and is rendered only at the primary synthesis view, not inside the
  per-voice `CouncilResultView`.
- **Scope creep** → explicitly two additive fields + one banner; no contract/Rust/migration change.

## Rollout

Single feature branch `council-synthesis-honesty`. Changes confined to `sidecar/council.mjs`,
`sidecar/tests/council.test.mjs`, `src/lib/bible.ts`, and `src/features/council/CouncilPanel.tsx`.
Verify with `npm run check` (+ manual smoke: configure exactly one provider to confirm the
single-voice banner) before merge to `main`.
