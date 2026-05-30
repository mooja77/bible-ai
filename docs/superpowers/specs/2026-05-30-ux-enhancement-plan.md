# Theme H — UX/UX Enhancement Plan for Non-Technical Users

- **Date:** 2026-05-30
- **Status:** Plan (roadmap; each Hn becomes its own brainstorm → spec → plan → build cycle)
- **Goal:** Make a dense, power-user Bible-study app **easy and confidence-inspiring for non-technical, novice, and older/low-vision users** — *without removing the depth power users rely on* — and **visualize the technical processes** the app runs so users always know what is happening.
- **Method:** Multiple recursive passes (inventory → research → cross-reference → reconcile with the "show me what's happening" requirement → prioritize). Refinements between passes are recorded at the end.

---

## 1. Guiding principles (from research synthesis)

Source-backed (NNG, GOV.UK, WCAG 2.2, Apple HIG, MS Fluent/HAX, Google PAIR; faith-app + AI-UX reviews). The seven that drive every decision below:

1. **Simple by default, powerful on demand.** Strict ≤2-level progressive disclosure; surface only the few highest-frequency actions; defer advanced/transparency surfaces behind one clearly-labeled, re-accessible layer. (NNG progressive disclosure; the Logos "sea of panels" cautionary tale.)
2. **Plain language in the user's words.** ~9-year-old reading grade; define unavoidable jargon on first use. This reduces perceived complexity more than any visual redesign. (GOV.UK, NNG plain-language.)
3. **Working defaults; value before configuration.** Don't gate core value behind setup; forgiving, inline-validated forms; never placeholder-as-label. (NNG defaults & form design.)
4. **Teach in context, not up front.** Replace the mandatory auto-playing tour with just-in-time help + instructive empty states; keep a re-accessible tour. (NNG onboarding.)
5. **Physically usable for older/low-vision users.** ≥16px resizable body text, ≥4.5:1 text contrast (3:1 UI/focus), ≥24px (ideally 44px) targets, visible 2px/3:1 focus ring, never color-alone, honor OS dark/scale. (WCAG 2.2, NNG senior usability.)
6. **Always show system status; prefer Undo over confirmation.** Visible progress for anything >1s, real progress >10s. (NNG visibility-of-status, response-time limits.)
7. **For AI: lead with one plain answer; make transparency opt-in and built to be *verified*, not admired.** Confidence as High/Med/Low (never raw %); "AI can be wrong — check it against Scripture" near the answer; non-anthropomorphic copy. (PAIR, MS HAX, NNG explainable-AI + the over-trust caveat: citations/confidence/reasoning all inflate trust even when wrong.)

**Reconciling the user's "animate the technical processes" request with the over-trust caveat.** These are two *different* surfaces and must not be conflated:
- **Process visibility (what the system is doing *right now*)** — retrieving passages → consulting voices → comparing → synthesizing. This is Nielsen heuristic #1 (visibility of system status). It is *reassuring and good*, and the user explicitly wants it. We will animate this richly.
- **Evidence transparency (the reasoning/citations behind the answer)** — research trail, argument map, retrieval trace, confidence rationale. Research warns these *inflate trust even when wrong* and should be opt-in and designed to provoke verification. We keep these collapsed-by-default and add "check it yourself" affordances.

The plan treats process animation as a first-class reassurance/comprehension feature, and evidence transparency as on-demand depth.

---

## 2. Current-state diagnosis (from code inventory)

**Strengths to preserve:** consistent sidebar IA; light/dark theming via token inversion; serif Scripture type with RTL; per-mode progressive disclosure of Reader controls; reusable StateViews; skeleton loaders in the reader; an existing (if thin) `CouncilRunningPanel` with elapsed timer; solid keyboard/ARIA baseline (tablist, command palette, escape-to-close, skip link).

**Top friction for non-technical users (ranked, evidence in inventory):**
1. **Setup barrier blocks all AI** — no guided wizard; cryptic "local Claude Code login / user-owned API key / managed gateway" (App.tsx ~966). 
2. **Jargon everywhere, raw** — "Council voices", "Retrieval strategy" (keyword/semantic/hybrid/explicit+hybrid+xref), "Evidence classification" (Cited/Supporting/Challenging), "Synthesis", "Confidence rationale", "Argument map", "Doctrine map", "Strong's", "module/module entry".
2b. **Process is invisible while it runs** — Council is one blocking call; the user sees only "Thinking… {n}s" and a pulsing dot, with no sense of *what stage* is happening or *why it takes time* (CouncilPanel ~233, CouncilVoicePanels ~92).
3. **7 equal top-level modes** with no core/advanced distinction; advanced study modes (Theology, Resources, Tags) sit at the same level as Reader.
4. **Council answer view is extremely dense** — every transparency panel can be on screen at once; no "simple answer first."
5. **Confidence shown without a defined scale**; numeric/ambiguous.
6. **Auto-advancing tour (6.5s/step)** too fast; 7 dense steps up front; "Do not show prompt" wording is odd.
7. **Older/low-vision gaps** — 11px nav titles, ~12px meta pills, subtle 55%-opacity focus ring, body text-sm default, contrast not verified, no global text-scale (only Reader A−/A+).
8. **Reference input fails silently** on natural inputs ("Genesis 1" pre-fix, "John", "3:16"); placeholder under-documents formats.
9. **Personal artifacts** (notes/highlights/tags/bookmarks) lack one obvious first-class home (the YouVersion "notes buried" pitfall).
10. **Translation codes (KJV/WLC/…) shown without full names**; jargon for lay readers.

---

## 3. The enhancement plan (workstreams)

Each **Hn** is an independently shippable sub-project (own spec + plan), ordered roughly by leverage-per-effort. Foundational items (H1 design tokens) unblock later visual work.

### Phase 1 — Foundations: language, legibility, defaults (highest leverage, lowest risk)

**H1 — Accessibility & legibility baseline** *(design system; App.css)*
- Raise default reader/body text to ≥16px; add a **global text-scale control** in the top bar (not just Reader A−/A+) honoring a persisted setting; ensure it scales nav, panels, dialogs.
- Audit & fix contrast to WCAG AA (≥4.5:1 text, ≥3:1 UI/icons) in both themes; bump `nav-section-title` (11px) and `meta-pill` (12px) or pair with weight/contrast.
- Strengthen focus ring to a solid, ≥3:1 visible indicator (current 55%-opacity amber is too faint on dark neutrals).
- Verify all interactive targets ≥24px (ideally 44px) hit area.
- **Verify:** automated contrast check + manual axe pass; e2e unaffected.

**H2 — Plain-language relabel pass** *(microcopy; no behavior change)*
- Replace jargon with lay terms, defining advanced terms on first use. Mapping (default label → keep technical term as a secondary/tooltip):
  - "Council" → keep the name (it's the brand) but add a one-line definition on first encounter: *"A panel of AI helpers that study a question from several angles."*
  - "Voices" → "AI helpers" (or "perspectives"); "Retrieval strategy" → "How it searches" (Keyword / By meaning / Both); "Synthesis" → "Summary answer"; "Confidence rationale" → "Why it's confident (or not)"; "Evidence classification" → "How each passage was used"; "Argument map" → "How the views connect"; "Retrieval trace" → "Passages it looked at"; "Research trail" → "How the Council studied this"; "Doctrine map" → "How topics relate"; "Strong's" → "Original-language word study (Strong's)".
- Reading-grade the tour, empty states, and Settings copy.
- **Verify:** e2e selectors that assert old strings (e.g. release-readiness, council-mock) updated in lockstep; full suite green.

**H3 — Forgiving inputs & empty/error states**
- Reference input: accept "Genesis 1" (whole chapter — already fixed), "John" (book → ch.1), partials; show a friendly inline hint on parse failure instead of silent no-op; expand placeholder/help.
- Audit every mode's empty/loading/error state against NNG's 3-part pattern (status + teach + direct action button). Tags already does this well; bring Council, Workspaces, Theology, Resources to parity (each empty state gets a primary "do the first thing" button).
- Translation picker: show full names with code as secondary ("King James Version · KJV").
- **Verify:** new e2e for reference-input friendly errors; empty-state CTAs.

### Phase 2 — Onboarding & first-run (unblock the AI value)

**H4 — Guided first-run setup for AI (the #1 barrier)**
- A friendly **setup wizard** on first Council use (or first run): "How do you want to use the AI helpers?" with 3 plainly-described cards — *Easiest (local Claude Code login)* / *Use my own key (paste, with format hint + inline validation)* / *Team/managed gateway*. Each explains cost/privacy in one line. Detect what's already available and recommend it.
- "Skip for now — read the Bible without AI" path so core value isn't gated.
- **Verify:** e2e drives the wizard happy-path + skip; existing settings specs stay green.

**H5 — Rework onboarding: contextual + calmer tour**
- Default the tour to **manual paced** (no 6.5s auto-advance; offer Play as opt-in); cut to 3–4 essential steps; reword "Do not show prompt" → "Don't show this again."
- Add **just-in-time tips**: first time a user opens Council / Theology / Resources, a small contextual intro (dismissible, re-openable via a "?" on the panel header) instead of front-loading all 7.
- Council first-run: 2–3 sentences + **tappable example questions** ("What does the Bible say about anxiety?", "Compare views on baptism").
- **Verify:** smoke tour e2e updated; new contextual-intro e2e.

**H6 — Information architecture: core vs. study tools**
- Group the sidebar: **primary** (Reader, Council) always visible; **Study tools** (Theology, Resources, Tags, Workspaces) under a labeled, collapsible "Study tools" group (still one click, but visually de-emphasized for novices). Settings pinned at bottom with a gear icon.
- Strengthen "you are here" (current mode highlight + a breadcrumb/title in the main header).
- Give personal artifacts a clear home: a "My study" affordance surfacing notes/highlights/bookmarks/tags together.
- **Verify:** nav e2e (mode switching) green; new group expand/collapse test.

### Phase 3 — The Council: simple answer + process visualization (the flagship)

**H7 — Council answer redesign: lead with the answer, depth on demand**
- Default result = **the summary answer** + a one-line **High/Medium/Low confidence** statement in plain words + a few **inline Scripture citations that tap straight to the verse in context**. 
- A prominent, non-anthropomorphic disclaimer beside the answer: *"AI can be wrong. Open these passages and weigh it yourself."* (the Berean framing — doctrinally apt and satisfies expectation-setting research).
- All existing transparency panels (process metrics, position comparison, voice matrix, retrieval trace, evidence audit, argument map, confidence rationale, research trail, source drawer) collapse under **one "Show how the Council reached this"** disclosure, each relabeled (H2) and revealed one tap at a time.
- Reframe multi-voice as human trust signal: *"3 of 4 helpers agreed; one raised a caution about X"* by default; the matrix is the deep layer.
- **Verify:** council-mock e2e reworked to assert the new default-collapsed structure + that deep panels still render when expanded.

**H8 — Process visualization & animation (the user's explicit ask) — backend eventing**
*The core enabler. Currently Council is one blocking `invoke` with only an elapsed counter.*
- **Backend:** emit Tauri progress events from the council pipeline (Rust `lib.rs` + sidecar `council.mjs`, which already logs `[council]` stages to stderr). Stages to surface: **Understanding your question → Searching Scripture (N passages found) → Consulting helpers (per-voice: thinking/done/failed) → Comparing the views → Writing the summary.** Each event carries a stage id + human label + optional count + per-voice status.
- **Frontend:** a **live "what's happening now" visualization** replacing the single pulsing dot:
  - A horizontal **stepper / progress choreography** that lights up each stage as it occurs, with a gentle pulse on the active stage and a check on completed ones.
  - **Per-voice cards** that animate independent state: queued → thinking (animated) → done (check) / timed-out (muted) — making "voices run in parallel, one slow one won't block" *visible* rather than just stated in fine print.
  - A passages-found counter that ticks up during retrieval; a subtle "comparing" animation when positions are being ranked.
- **Fallback (Phase 8a, ship first):** if backend eventing is deferred, a **choreographed staged animation** that advances through the known phases on a time/heuristic basis (clearly an estimate, not fake precision) — better than today's opaque spinner, upgradeable to real events in 8b.
- Apply the same pattern, lighter, to other long ops: semantic **search** ("Searching by meaning…"), **explanation** generation, **import/restore/backup** (real progress bars), **embeddings/Ollama** retrieval.
- **Respect `prefers-reduced-motion`** throughout (animations degrade to instant state changes).
- **Verify:** new e2e (mock council emits staged events → assert stepper advances + per-voice states render); reduced-motion path renders without animation.

**H9 — Confidence & trust calibration**
- Standardize confidence to **High/Medium/Low buckets** with a plain action cue everywhere it appears (Council result, judgment panel, Theology). Map any internal numeric to buckets; keep the number available only in the expanded "why" panel.
- Make citations *checkable*: "supported by N passages", tap-to-context, gentle "tap to read in context" nudge (counters the citation over-trust effect).
- Graceful AI states: thin-evidence / voices-disagree / voice-failed each get a plain, honest message + forward path (rephrase, narrow, read passages).
- **Verify:** council-mock asserts bucketed confidence + disagreement messaging.

### Phase 4 — Polish & motion system

**H10 — Motion & micro-interaction system** *(design system)*
- Establish reusable, tasteful motion tokens/utilities (durations, easings) building on the existing `transition`/`verse-flash`/`animate-pulse` foundation: content fade/slide-in on mode switch, list-item enter, save-success checkmarks, toast slide-in (the GlobalErrorNotice already exists), tab/panel cross-fades.
- All gated behind `prefers-reduced-motion`; keep it subtle (the app is for reading — motion must never compete with Scripture).
- **Verify:** build + visual smoke via the desktop MCP; reduced-motion respected.

---

## 4. Sequencing & rationale

1. **H1, H2, H3** first — pure-additive, low-risk, immediately help every user and unblock visual/motion work. (Legibility + plain language + forgiving states.)
2. **H4, H5, H6** — get novices *in* (setup) and *oriented* (onboarding, IA).
3. **H7, H8, H9** — the flagship Council rework + the process-visualization the user asked for. H7 (simplify) should precede/accompany H8 (animate the process) so the new visualization lands in a calmer layout. H8 is the largest (backend eventing) — ship the choreographed fallback (8a) first, real events (8b) second.
4. **H10** last — global motion polish once the structures it animates are settled.

Each Hn ships behind the existing verify gate (`npm run check` + `npm run test:e2e:build`) and ff-merges to `main`, matching the project's established cadence.

---

## 5. Recursive-pass log (how the plan was refined)

- **Pass 1 (inventory):** first instinct was "add tooltips everywhere + a glossary." 
- **Pass 2 (research cross-reference):** rejected tooltip-spray — NNG shows plain *relabeling* + progressive disclosure beats tooltips (which are easy to miss and signal "this is confusing"). Elevated H2 (relabel) and H7 (collapse transparency) over a glossary. Confirmed "7 modes" isn't inherently too many (the "max 7" rule is a myth) — so H6 *groups/de-emphasizes* rather than removes modes.
- **Pass 3 (reconcile the animation request):** separated **process visibility** (reassuring, animate it richly — H8) from **evidence transparency** (over-trust risk, keep opt-in + verification-provoking — H7/H9). This is the key insight that makes the user's "show me what's happening" request *strengthen* trust calibration instead of harming it.
- **Pass 4 (backend grounding):** discovered Council is a single blocking `invoke` with no progress events — so honest stage animation requires **backend eventing** (H8b), with a choreographed fallback (H8a) shippable first. Without this grounding the plan would have promised animations the architecture can't currently feed.
- **Pass 5 (prioritization):** front-loaded the cheap high-leverage trio (H1–H3) so every later screen inherits legibility + plain language; placed motion polish (H10) last so it animates already-settled structures.

---

## 6. Out of scope / explicitly not doing

- No removal of power-user depth — everything stays reachable, just demoted to on-demand.
- No anthropomorphizing the AI (no chat persona/named assistant) — research shows it inflates trust.
- No raw chain-of-thought as "explanation" (NNG: often unfaithful) — process *stages* and *citations* instead.
- No mandatory account/login or telemetry.
