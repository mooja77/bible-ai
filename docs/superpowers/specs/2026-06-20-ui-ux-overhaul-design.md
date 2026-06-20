# UI/UX Overhaul — Design

- **Date:** 2026-06-20
- **Status:** Approved direction (validated via interactive prototypes); ready for implementation planning
- **Scope:** Whole-app overhaul, one spec, delivered in sequenced phases
- **Decisions locked:** Real-time process progress from day one; one whole-app spec

## 1. Summary

Two pillars, one product feeling:

1. **A sleek, calm, minimal app.** Summary-first everywhere; no walls of text; progressive
   disclosure; nothing intimidating on first contact.
2. **A fully transparent, *explorable* AI process.** The Council's real pipeline is
   animated in real time ("you are here"), and every part of the result is clickable
   down to the raw bottom — scripture text, retrieval scores, each voice's verbatim
   reasoning, the weight math, conflicts, the judgment and *why*.

These are in tension (spectacle vs. calm) and the resolution is **depth on demand**:
the default surface is quiet and uncluttered; the richness lives one tap below it.

## 2. Goals / Non-goals

**Goals**
- Replace the dense, text-heavy Council transparency panels with one coherent,
  drill-anywhere **Reasoning Explorer**.
- Animate the **real** Council run in real time, including branches, retry/fallback
  loops, voice failures, conflict, and the review/judgment stage.
- Establish a single visual design system (tokens + motion + a universal interaction
  grammar) and restyle every screen to the minimal standard.
- Preserve every existing accessibility guarantee and keep the e2e suite green.

**Non-goals**
- No change to the *theology*, retrieval algorithms, or provider set.
- No new heavyweight UI/animation dependency (see §4.4).
- No change to data persistence or the backup/restore/secret model.
- Not redesigning the installer / release pipeline.

## 3. Constraints (hard)

These are existing, tested guarantees. New work must not regress them.

- **Reduced motion:** every animation needs a no-motion equivalent that still conveys
  state via color/label/checkmark (`prefers-reduced-motion`, honored in `App.css`).
- **Contrast:** new colors must pass WCAG AA in both themes (guarded by
  `tests/e2e/contrast-light.spec.ts`).
- **Zoom/layout:** components must not overflow at 140% UI scale (guarded by the
  layout-maxscale spec).
- **e2e determinism:** the WebdriverIO suite runs one shared session with
  `BIBLE_AI_MOCK_COUNCIL=1`. Real-time progress must be deterministically mockable.
- **Zero-runtime-dep frontend:** current deps are only React + Tauri APIs. Keep it that
  way (§4.4).
- **No data-model change required for the result view** — `CouncilResponse` already
  carries everything the Explorer needs (voices, `retrieved_evidence` with
  semantic/keyword/xref scores, positions with `supporting_evidence_ids` /
  `challenging_evidence_ids` / `argument_map` / `weakest_link` / `what_would_change_this`
  / `confidence_rationale`, `evidence_classification`, `dissent_notes`,
  `unresolved_tensions`). The overhaul is presentation-layer + a new progress channel.

## 4. Visual design system

### 4.1 Aesthetic
Sleek dark, luminous, minimal. Extends the existing indigo-on-slate theme rather than
replacing it. Light mode keeps parity via the existing token-remap mechanism.

### 4.2 Semantic color grammar (the constant the user must learn once)
- **● voice** — each AI voice has a stable accent color.
- **▲ supports** — emerald.
- **▼ challenges** — rose.
- **leader / verdict** — gold.
- **neutral structure** — slate/indigo.
This grammar is identical everywhere (map, explorer, result view) so meaning never
shifts between screens.

### 4.3 Interaction grammar (the constant layout)
Every explorer level reads the same way:
**what produced it ▸ · the focus · ◂ what it affects.**
- Left = causes/inputs. Center = the focused entity. Right = effects/consumers.
- A persistent **breadcrumb** tracks depth and climbs back.
- A persistent **legend** keeps the color grammar on screen.

### 4.4 Rendering tech
- **CSS + SVG + Canvas2D + `requestAnimationFrame`.** No animation library.
  Rationale: zero new deps, deterministic for e2e, trivially gated by
  `prefers-reduced-motion`, and Canvas/SVG already proven in the prototypes.
- New tokens live in `App.css` `@theme` / `:root` (motion durations, easing, glow,
  the semantic palette above), reused by all components.

## 5. Real-time progress architecture

The Council runs through one Tauri command (`ask_council` → Rust → Node sidecar via
NDJSON over stdio, correlated by `id`). We add **interleaved progress lines** before
the terminal result and forward them to the UI over a **Tauri Channel**.

### 5.1 Event taxonomy (`council_progress`)
Each event: `{ seq, ts, kind, ... }`, emitted in order. Kinds map 1:1 to real code points:

| kind | emitted when | payload |
|---|---|---|
| `run_started` | run begins | `question`, `providers_available[]` |
| `safety_checked` | after sensitive-topic classify | `status: "clear" \| "blocked"`, `category?` |
| `retrieval_started` | before evidence fetch | `strategy` |
| `retrieval_fallback` | semantic→keyword fallback fires | `from`, `to`, `reason` |
| `retrieval_done` | evidence ready | `count`, `mode` |
| `voice_started` | each provider dispatched | `provider`, `display_name` |
| `voice_retry` | a voice retries after timeout | `provider`, `attempt` |
| `voice_done` | a voice returns ok | `provider`, `ms`, `position_count` |
| `voice_failed` | a voice errors/times out | `provider`, `category`, `hint` |
| `synthesis_started` | clustering begins (≥2 ok) | `voice_count` |
| `synthesis_fallback` | synthesis failed → lead voice | `reason` |
| `judged` | weights+confidence assigned | `leader_label`, `leader_weight`, `confidence` |
| `run_complete` | terminal | `session_id`, `synthesis_mode` |

### 5.2 Wiring
- **Sidecar** (`council.mjs` / `index.mjs`): `runCouncil` accepts an `onEvent(event)`
  callback; `index.mjs` passes `onEvent = (e) => send({ id, type: "council_progress", event: e })`.
  Emit points added in `runCouncil` / `runOneVoice` / `synthesise`. The final
  `council_result` line is unchanged.
- **Rust** (`lib.rs` + `sidecar` module): `ask_council` gains a
  `tauri::ipc::Channel<CouncilProgress>` argument. The sidecar read loop, when it sees
  `type == "council_progress"` for the in-flight `id`, sends it on the channel and keeps
  reading until `council_result` / `error`. The command still **returns** the full
  `CouncilResponse` as today (progress is additive, not a replacement).
- **Frontend**: `useCouncilRun()` hook subscribes to the channel, reduces events into an
  ordered `RunState` (per-stage status: pending/active/done/failed/looped), and exposes
  it to `CouncilRunMap`. The resolved `CouncilResponse` (command return) hydrates the
  Explorer.

### 5.3 Mock / test path
`BIBLE_AI_MOCK_COUNCIL=1` emits a **scripted, deterministic** event sequence (with
timing compressed) that exercises every branch — including a forced **conflict**, one
**voice failure + retry**, and a **synthesis fallback** variant selectable by a sentinel
in the question (mirroring the existing `__FORCE_COUNCIL_*__` pattern). This lets e2e
assert map transitions without real providers.

## 6. Component A — `CouncilRunMap` (animated process map)

The live "you are here" visualization, driven entirely by §5 `RunState`.

- **Layout:** vertical spine — Question → Safety gate → Retrieve → Voices (parallel
  fan) → Conflict → Review & Judge → Verdict — with side branches for *crisis-care
  routing*, the *semantic→keyword* retrieval loop, the *synthesis→lead-voice* fallback
  loop, and per-voice *retry*.
- **Motion:** a pulse advances along the spine as events arrive; the active node glows;
  parallel voices pulse concurrently and resolve independently (done = color, failed =
  rose with hint); conflict flares; the judge node fills a confidence meter; the verdict
  reveals leader + % + a one-line *why* + preserved-dissent count.
- **Every node is a launch point into the Explorer (§7)** for that entity.
- **Reduced-motion / e2e variant:** the same component renders a static vertical
  **stepper** with live status text + checkmarks, updated by the identical events — no
  canvas, full information parity. Selected by `prefers-reduced-motion` (and a Settings
  toggle).
- **Testids:** stable per node + per status for e2e assertions.

## 7. Component B — `ReasoningExplorer` (drill-anywhere)

One unified, recursive surface that **replaces** the scattered transparency panels
(`CouncilProcessView`, `CouncilRetrievalTrace`, `CouncilEvidenceAudit`,
`CouncilArgumentMaps`, `CouncilResearchTrail`, `CouncilVoiceMatrix`,
`CouncilPositionComparison`). Several of those become **entity renderers** inside it,
which also reduces the god-component sprawl noted in the Theme-F work.

### 7.1 Navigation model
- A stack of `{ entityType, entityId }` with breadcrumb; `push` to go deeper, breadcrumb
  click to climb. Animated zoom-in transition (reduced-motion → instant).
- Reachable from: the result verdict ("See how this was reached"), any `CouncilRunMap`
  node, and any cross-link inside a level.

### 7.2 Entity renderers (each = causes ▸ focus ◂ effects)
- **Outcome (root):** ranked positions with weight bars. → Position.
- **Position:** left = voices that argued it; center = summary + green/red
  support-vs-challenge bar + %; right = scriptures split ▲/▼. Deeper chips: argument
  map, `weakest_link`, `what_would_change_this`, `confidence_rationale`,
  `source_position_labels`.
- **Verse (evidence):** left = retrieval *why* (semantic / keyword / cross-ref bars →
  combined) + matched terms + translation; center = full verse text; right = every
  position it touches (▲/▼). → Position.
- **Voice:** left = confidence + duration (+ error category/hint if failed); center =
  verbatim rationale; right = its stance(s). → Position.
- **Argument node:** claim with support/challenge children, each → Verse.
- **Conflict / Tension:** the diverging positions + the conflicting verses
  (`evidence_classification.status = conflicting`, `unresolved_tensions`,
  `dissent_notes`). → Position / Verse.

### 7.3 Full-visibility guarantee
A coverage table (in the implementation plan) maps **every** `CouncilResponse` field to
a reachable place in the Explorer, so nothing in the data is unreachable. Acceptance:
from the root, a user can reach raw verse text, each score component, each voice's
rationale + error, every position's full weight rationale and argument map, every
conflicting/ignored evidence item, and the confidence rationale.

## 8. Component C — minimal app-shell overhaul

Apply §4 across the app; principle everywhere: **summary first, details on tap.**
- **Navigation:** a slim, quiet persistent rail; keep the command palette.
- **Council entry:** one prominent "Ask" field; the result leads with the **verdict**
  (answer + confidence) and a single calm entry into the map/explorer — not the current
  stack of dense panels.
- **Reader:** typographic, distraction-light; verse actions appear on hover/focus;
  controls recede.
- **Search:** one clear input; results as calm cards.
- **Settings & onboarding:** continue the progressive-disclosure direction already begun
  (Theme D); lighten the tour.

## 9. Accessibility & testing

- **Reduced-motion parity** for `CouncilRunMap` and Explorer transitions (information
  parity, verified by a dedicated spec).
- **Contrast:** extend `contrast-light.spec` to the new semantic palette; both themes.
- **Layout at 140%:** the map's vertical layout and explorer's responsive 3-zone grid
  (collapses to single column) must pass the layout guard.
- **Keyboard + ARIA:** explorer is keyboard-navigable (breadcrumb, deeper, back); map
  nodes are buttons with labels; focus-visible per existing outline rules.
- **New e2e specs:** `council-run-map.spec` (transitions incl. conflict + voice failure
  + synthesis fallback via mock), `reasoning-explorer.spec` (drill to bottom on each
  entity type + breadcrumb climb), reduced-motion variant. Keep all current specs green.

## 10. Phased delivery (one spec, sequenced)

Each phase is independently reviewable; later phases depend on earlier.

- **P0 — Design system foundation:** tokens, semantic palette, motion vars, legend +
  breadcrumb primitives, reduced-motion plumbing.
- **P1 — Real-time progress channel:** §5 sidecar events + Rust Channel + `useCouncilRun`
  + the deterministic mock sequence. (Backend-heaviest; gated by mock + unit/e2e.)
- **P2 — `CouncilRunMap`:** animated map + reduced-motion stepper, driven by P1.
- **P3 — `ReasoningExplorer`:** drill-anywhere surface; migrate existing transparency
  panels into entity renderers; full-visibility coverage table satisfied.
- **P4 — Council result restyle:** verdict-first, single calm entry into map + explorer.
- **P5 — App-shell minimal restyle:** nav, reader, search, settings, onboarding.
- **P6 — Hardening:** a11y specs, contrast/layout extension, polish, perf check on the
  canvas path.

## 11. Risks & mitigations

- **Streaming complexity / e2e flakiness** → the deterministic compressed mock sequence
  is the contract the UI is tested against; real providers are never required in e2e.
- **Reduced-motion divergence** → one component, two render paths off the same state;
  parity asserted by spec.
- **Canvas perf on low-end hardware** → cap particle/node counts; the stepper path is the
  floor; measure in P6.
- **"Whole-app" scope creep** → phases are independently shippable; P1–P4 (the Council
  experience) deliver the core value even if P5 lands incrementally.
- **Palette contrast regressions** → extend contrast spec in P0 before building on the
  tokens.

## 12. Open questions (resolve during planning, non-blocking)

- Per-voice accent colors: fixed palette vs. derived from provider identity.
- Whether `CouncilRunMap` and `ReasoningExplorer` share one canvas/SVG substrate or stay
  separate (likely separate; map = Canvas spine, explorer = DOM/SVG).
- Exact migration order for the existing transparency components into entity renderers.
