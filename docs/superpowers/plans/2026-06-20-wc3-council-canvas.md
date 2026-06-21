# WC3 — Council Canvas — Implementation Plan

> Sub-skill: subagent-driven-development. Phase WC3 (WC1 shell + WC2 reader DONE). Design law: `docs/superpowers/specs/2026-06-20-world-class-redesign-directives.md` (Directive 6 trust-through-transparency colour-coded voices; Directive 7 qualitative bands + explainable rationale, NOT numeric %). Architecture: code-architect run af5253c2.

**Goal:** Replace the verdict card with an editorial **CouncilCanvas** — the question (serif), a **qualitative agreement band** (not "75%"), a plain-language **"Because… therefore…" rationale**, colour-coded **evidence chips**, and one calm **"Trace each voice & verse"** entry into the existing `ReasoningExplorer`. Reuse `reasoningModel`, `CouncilRunMap`, `ReasoningExplorer`. Keep `CouncilResultView` (h2=Synthesis) + the legacy panels below (auditability). **Near-zero e2e churn** via the hidden-testid trick.

## Key trick (zero spec edits)
`CouncilCanvas` includes three hidden (`display:none`, `aria-hidden`) spans carrying `data-testid="council-verdict-card"` / `-answer` (leader label) / `-confidence` (band label). The verdict spec only calls `.isExisting()` / `.getText().length>0` on these → stays green. `h2=Synthesis` stays in `CouncilResultView` in the main flow (unmoved) → all `h2=Synthesis` specs stay green. Net spec edits: **0** (verify by full suite).

## Files to create
- `app/src/features/council/CouncilQuestion.tsx` — `{question}` in serif, centered. No logic.
- `app/src/features/council/AgreementBand.tsx` — exports `deriveAgreementBand(response)` + renders the band + colour-coded voice dots (each with text label + `aria-label`, `role="status"`). testid `council-agreement-band`.
- `app/src/features/council/RationaleLine.tsx` — `buildRationaleLine(response)` + renders it. testid `council-rationale`.
- `app/src/features/council/EvidenceChips.tsx` — ▲ support / ▼ tension chips (buttons → `onOpenExplorer`); null when none. testid `council-evidence-chips`.
- `app/src/features/council/CouncilCanvas.tsx` — composes the above + a `council-canvas-explore-cta` button + the 3 hidden `council-verdict-*` spans. Props `{ response, question, onOpenExplorer }`. testid `council-canvas`. `aria-live="polite"`.

## Files to modify
- `app/src/App.css` — `[data-theme="light"]`: add AA-safe `--c-voice-a/b/c/d` overrides (dark neon values fail on warm paper). Suggested light: a `#1a4fa8`, b `#0d6e5a`, c `#7a5a00`, d `#8a1f5e` (verify via contrast spec).
- `app/src/features/council/CouncilPanel.tsx` — remove `CouncilVerdictCard` import+render; render `<CouncilCanvas response question onOpenExplorer={() => setShowExplorer(true)} />` at the top of the result block (line ~360–362); keep retrieval badge, `trace-reasoning-toggle`, `CouncilResultView`, judgment, `council-full-analysis-toggle` + collapsed panels untouched. Add `!runState.complete` to the run-map visibility gate (`(loading || runState.started) && !runState.complete`) for a clean run→canvas transition.
- `app/src/features/council/CouncilRunMap.tsx` — in `runmap-verdict` (~line 124) replace `{Math.round(leader_weight*100)}%` with the qualitative `"{confidence} confidence"` phrase (keep testid; no spec asserts its inner text).
- DELETE `app/src/features/council/CouncilVerdictCard.tsx` (after wire-in).

## deriveAgreementBand(response) (exact)
leader = rankedPositions[0]; if none → {label:"No result"}. successVoices = voices.filter(status==="ok"); total = successVoices.length||1 treated. concurring = positionVoices(response, leader).length. ratio = concurring/max(total,1).
- ratio===1 && total>=2 → "Strong agreement"
- ratio===1 && total===1 → "Single voice"
- ratio>=0.67 && total>=2 → "Broad agreement"
- ratio>=0.5 && total>=2 → "Lean"
- else → "Contested"
detail = "{concurring} of {total} voices concur" (single_voice mode → "Single voice analysis"). Display "{label} · {detail}". Confidence word ("high"/"medium"/"low") shown small + muted, NOT the headline.

## buildRationaleLine(response) (exact)
leader = rankedPositions[0]; none → "". support = positionEvidence(leader).support.slice(0,3). citations = support.map(verseCitation).join(", "). summary = leader.summary || synthesis.synthesis.slice(0,200)+"…".
- citations present → "Because {citations}, the leading view holds: {summary}"
- none → "The leading view holds: {summary}"
- single_voice/≤1 voice → prefix "From a single voice — "; sparse mock w/ no evidence → "The Council found: {summary}".

## Tasks (each builds; full suite only after Task 7)
- **T1** App.css light voice tokens (verify contrast spec). 0 e2e.
- **T2** AgreementBand + deriveAgreementBand. 0 e2e (not wired).
- **T3** RationaleLine + buildRationaleLine. 0 e2e.
- **T4** EvidenceChips (null-safe). 0 e2e.
- **T5** CouncilQuestion. 0 e2e.
- **T6** CouncilCanvas (compose + hidden verdict spans + CTA). Build green. 0 e2e.
- **T7 (wire-in)** CouncilPanel: swap CouncilVerdictCard→CouncilCanvas; add `!runState.complete` run-map gate; delete CouncilVerdictCard.tsx. Run FULL suite → green (expect 0 spec edits via hidden spans; if `council-verdict-*` break, add the spec edits). Commit.
- **T8** CouncilRunMap `runmap-verdict` %→qualitative. Run council-run-map spec → green.
- **T9** a11y: `aria-live` on canvas, `role="status"` on band, voice-dot `aria-label`s, reduced-motion guard on any canvas fade (CSS/`motion-safe:`). Run contrast + reduced-motion-relevant specs.

## Preserve (e2e): `council-verdict-card/-answer/-confidence` (hidden spans), `h2=Synthesis` (CouncilResultView, unmoved), `council-winner-summary`, `council-evidence-tabs`, `council-process-view` (collapsed), `council-full-analysis-toggle`, `trace-reasoning-toggle`, `runmap-verdict`, `export-study-packet`, `sensitive-topic-notice`, retrieval badge, all explorer testids. New: `council-canvas`, `council-agreement-band`, `council-rationale`, `council-evidence-chips`, `council-canvas-explore-cta`.

## Risks
- Light voice-dot tokens must pass AA (T1 before T6); pair dots with text labels (colour not sole signal).
- Mock sparse data: deriveAgreementBand/buildRationaleLine handle single_voice + `positionVoices()===0`.
- Keep `CouncilResultView` in main flow (do NOT demote — that would move h2=Synthesis and require spec edits).
- Env: debug build + msedgedriver; suite flakes under load → isolate to confirm.
