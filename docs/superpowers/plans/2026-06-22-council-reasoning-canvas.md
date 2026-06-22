# Council Reasoning Canvas — the animated, drill-down "how & why" centrepiece

> Synthesized from: code grounding (data model + existing components), deep-research pass 1 (verified comprehension directives), deep-research pass 2 (implementation + exemplars + confidence; partial — design/synth phases cut off by the account monthly spend limit, so this plan was authored in the main loop from the completed research). Sub-skill for execution: subagent-driven-development. Design law still applies: `docs/superpowers/specs/2026-06-20-world-class-redesign-directives.md` (Calm Editorial).

## 1. North star
**One canvas that shows the Council *thinking* — question → evidence → voices → agreement & conflict → judgment → outcome — as a single legible, drillable story, where every moving thing carries information.** A non-technical viewer watches the verdict appear *first*, then sees exactly how it was reached: which scriptures were weighed and how strongly, what each voice concluded, where the voices agreed and clashed, how the judge weighed them, and why the leading view won — and can click into any part down to the verse. Beautiful **because** it is legible (the FUI standard: an informational story readable at a glance).

**Base approach (judge-style call):** a **hybrid** — an *explorable static-first artifact* as the foundation (guarantees "completely understandable"), with a *choreographed reveal + replay/scrub* layered on top (delivers "stunning"). Static-first is the sign-off gate; motion is added only once the information design is approved. Research backs this hybrid: watch-it-unfold (segmentation principle) + free explore afterward (overview→zoom→details).

## 2. The canvas, phase by phase
One vertical narrative of six labelled bands (the live run progressively fills them; a completed/saved result shows them all). Each band is drillable in-place (details-on-demand, reusing `reasoningModel.ts` helpers — no separate modal).

- **P1 · Question** — the question in serif, centered. Data: `question`. Anchor; sets the frame.
- **P2 · Evidence gathered** — retrieved verses arrive as chips in a staggered reveal, each **sized by combined retrieval score** and tinted by source (keyword / semantic / cross-ref). Expand a chip → the **score split** (`verseScoreParts`: semantic/keyword/xref mini-bars) + verse text + matched terms. Data: `retrieved_evidence[]`. Drill: click verse → which positions rely on it (`versePositions`). *Answers "what scriptures, and how strongly."*
- **P3 · Voices weigh in** — each voice is a labelled node in its own `--c-voice` colour; its independent positions emerge beneath it as small weighted cards. Data: `voices[].result.positions[]`. Drill: click voice → its full independent take. *Answers "the points of view."*
- **P4 · Agreement & conflict (the signature 2D moment)** — the voices' positions **physically migrate into clusters** by `cluster_id`: matching positions from different voices move together into a shared group; divergent ones stay visibly apart. Tight cluster = agreement; separated groups / lone positions = conflict. Data: `cluster_id`, `source_position_labels`, `buildVoiceAgreementMatrix()`. Drill: click a cluster → the positions + voices in it. *Answers "where the models agree and where they conflict" — research's #1 differentiator (positions cluster/diverge in 2D).*
- **P5 · The judge weighs** — clusters resolve into **ranked final positions**; the leader rises to the top. Each shows its **countable weight** (not %), **why it won** (margin in voices + evidence), its **weakest link**, and **what would change it**. Data: `synthesis.positions[]` (ranked), `weakest_link`, `what_would_change_this`, `buildConfidenceFactors()`. Drill: click position → evidence split (support/challenge) + argument map. *Answers "the judgment, and why."*
- **P6 · Outcome + confidence** — the leading view in plain language ("Because [top verses], the leading view holds: …"), with **confidence as countable units of real entities**: e.g. `●●●●●○  5 of 6 voices converge` and a small waffle `8 of 11 weighed verses support`. Unresolved tensions listed plainly. Data: `synthesis`, `confidence` + factors, `evidence_classification[]`. *Answers "the outcome, and how sure — honestly."*

### Confidence encoding (locked rule, from pass-2)
**Each glyph = one real, nameable entity.** Voices → an icon array of the real voices (lit = concurring). Weighted verses → a waffle of the real classified verses (lit = supporting). Per-voice weight spread (where it exists) → a **quantile dotplot** of the actual per-voice weights, not a bar. The low/med/high word appears small + plain, derived from factors. **Forbidden:** "%", decimals, and threshold/category colour bands (a boundary misreads as a hard class — documented failure mode). No false precision from a 5–6 element sample.

## 3. Information design (static-first)
- Calm-editorial: warm paper, serif for the question/leading view, gold accent reserved for the leader + active focus, generous whitespace, one column ≤ ~66ch for prose.
- Hierarchy = the six bands top-to-bottom; the verdict (P6 essence) is *also* surfaced at the very top as a one-line "leading view" so overview-first holds even before scrolling.
- Legible at a glance: every band has a plain-language kicker label; nothing abstract is shown without a label.
- P4 cluster diagram = SVG (few nodes, crisp); chips/cards/bands = DOM/CSS; Canvas only if a particle effect in P2/P4 demands it.

## 4. Motion system (added after static sign-off)
- Staging: bands reveal in order; within a band, items stagger ~60–90ms; decelerate easing `cubic-bezier(0.22,1,0.36,1)` (the existing `--ease-out`).
- Focus/defocus: the band currently revealing is full-opacity; already-revealed bands settle to calm; upcoming bands are faint.
- Signature beat: the **P4 cluster migration** (FLIP/layout transition of position cards into clusters) is the "wow" moment — informational, not decorative.
- Controls: **play / pause / replay** + a **phase stepper/scrubber** so the viewer moves at their own pace (segmentation principle).
- Live run: the same canvas fills progressively from `CouncilRunState` events (P2 as retrieval lands, P3 as voices report, P4/P5 at synthesis/judged); a completed/saved result plays the full reveal or shows it settled.
- Reduced-motion: `prefers-reduced-motion` → no migration/auto-play; every band renders already-settled and fully legible (the static artifact IS the fallback).

## 5. Component architecture
- **New:** `features/council/reasoning/CouncilReasoningCanvas.tsx` orchestrates six band components (`PhaseQuestion`, `PhaseEvidence`, `PhaseVoices`, `PhaseClusters`, `PhaseJudge`, `PhaseOutcome`) + a `ReasoningControls` (play/pause/scrub) + an in-place `DrillPanel`.
- **Reuse (do not reinvent):** `reasoningModel.ts` (`rankedPositions`, `positionVoices`, `positionEvidence`, `versePositions`, `verseScoreParts`), `councilTransparency.ts` (`buildVoiceAgreementMatrix`, `buildRetrievalTraceRows`, `buildConfidenceFactors`), light voice tokens `--c-voice-a..d`.
- **Absorb roles:** `CouncilRunMap` (live progress → becomes the canvas filling live), `CouncilCanvas` summary (→ P1 + P6 essence), `ReasoningExplorer` drill logic (→ in-place `DrillPanel`).
- **Keep behind "Full analysis" (auditor view), not deleted:** `CouncilResultView`, `CouncilVoiceMatrix`, `CouncilRetrievalTrace`, `CouncilEvidenceAudit`, `VoicesAuditTrail`, `CouncilConfidenceRationale` — they hold e2e testids and serve power users.
- **Dependency decision (deferred to T4):** prefer hand-rolled CSS transitions + a tiny FLIP helper to avoid a heavy dep; adopt Framer-Motion only if the P4 migration choreography proves too fiddly by hand. Decide at T4 with evidence.

## 6. e2e + a11y safety
- Additive-then-atomic-swap (the WC pattern): build `CouncilReasoningCanvas` additively, verify, then make it the lead — keeping the existing sections (with their testids) mounted (behind "Full analysis") so specs stay green.
- Preserve exactly: `council-run-map`, `runmap-stage-*` (+`data-status`), `runmap-voices`, `runmap-verdict`, `h2=Synthesis`, `council-verdict-card/-answer/-confidence`, `council-winner-summary`, `council-evidence-tabs`, `trace-reasoning-toggle`, ReasoningExplorer `re-*`, `export-study-packet`, `sensitive-topic-notice`.
- a11y: drill moves focus into the opened detail (the explorer already moves focus to `re-body`); confidence icon arrays carry `aria-label` ("5 of 6 voices converge"); full keyboard path through bands + drill; reduced-motion honored.

## 7. Staged build plan
- **T1 — Static structured canvas (SIGN-OFF GATE).** All six bands laid out from real data, drillable in-place, **no motion**. Additive (rendered alongside existing). Lock the information design with the user before any animation. e2e: green (additive).
- **T2 — Honest countable confidence + plain-language judgment.** Replace %/bands with icon arrays/waffle/dotplot of real entities; P5 "why it won" + weakest-link + what-would-change in plain words.
- **T3 — P4 cluster/conflict 2D diagram.** The signature visual: positions grouped by cluster (static first, then the migration in T4).
- **T4 — Choreographed reveal + controls + reduced-motion.** Staggered band reveals, P4 migration, play/pause/replay/scrub; reduced-motion static fallback; dep decision.
- **T5 — Atomic swap + FUI polish.** Make the canvas the lead (existing sections → "Full analysis"); focus/defocus, easing, glow/depth to the bar. Full suite green.

## 8. Risks & open questions (for the human)
- **Live vs saved unification:** the canvas must render both a live run (`CouncilRunState`) and a completed/saved `CouncilResponse`. Band components must accept either source — design the data adapter in T1.
- **`cluster_id` / `source_position_labels` real coverage:** if real synthesis populates these sparsely, P4 clustering degrades → fallback grouping by label similarity. **Verify on a real (non-mock) run.**
- **Single-voice case** (common in mock + when only one provider is set): "agreement/conflict" and "5 of 6 voices" collapse → graceful copy ("one voice analysed — no council to compare").
- **Spend limit:** the full multi-agent design/synthesis was cut off by the account monthly spend limit; deepening via the workflow can resume (cached research = instant) once it's raised. This plan stands on the completed research + grounding regardless.
