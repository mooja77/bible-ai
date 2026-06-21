# World-Class Redesign — Evidence-Grounded Design Directives

- **Date:** 2026-06-20
- **Status:** Foundation for the ground-up UI/UX rebuild (replaces the prior incremental approach)
- **Basis:** Deep-research pass (103 agents, 21 primary/secondary sources, claims adversarially verified — see run `wf_096f1e50-31c`). Only **confirmed** claims are treated as directives; **refuted** claims are listed as anti-patterns.

## Mandate

The existing layout/UI is replaced from scratch with a world-class, SOTA experience. The **only** carry-over is today's animation engine: the Council run-map and the drill-anywhere reasoning explorer logic. Aesthetic: **Calm Editorial** (warm paper, ink, restrained gold).

## North star (Apple Design Awards 2025 criteria) — *apple.com/ developer.apple.com ADA 2025 (primary, 3-0)*
- **Interaction:** intuitive interfaces, effortless controls, platform-tailored.
- **Visuals & Graphics:** stunning imagery, *skillfully drawn interfaces*, high-quality animation, a **distinctive and cohesive theme**.
- Plus Delight, Inclusivity, Social Impact. Design every screen to clear this bar.

## Directive 1 — Chrome-less, content-first *(iA Writer, ADA 2025 finalist; primary 3-0)*
- The **page is the product**. At rest, scripture fills the canvas; navigation/controls recede.
- No persistent control-dump sidebar. Reading options, translation, search live off-canvas.

## Directive 2 — One command surface *(Superhuman, primary 3-0; Linear/Raycast/Vercel corroborated)*
- **⌘K invocable from anywhere.** Centered overlay. Forgiving fuzzy search (typo-tolerant, case-insensitive, aliases, score threshold).
- It is the single entry to: switch translation, search, jump to a verse, open a book, **summon the Council**, change settings.

## Directive 3 — Reading typography *(Bringhurst / UXPin, 2-1 directional)*
- **Measure 50–75 CPL, target ~66**; up to ~80–90 acceptable on wide desktop. Practically: a centered serif column **~620–680px**.
- Body **~18–20px serif**, generous leading (~1.8–1.95). Verse numbers delicate, superscript, muted gold — never clutter the line.

## Directive 4 — Color as an intent scale *(Vercel Geist, primary; 100-1000 scale 3-0, accessibility maxims directional)*
- Tokens encode **intent, not lightness**: backgrounds → borders → solid fills → secondary text → primary text.
- **One reserved accent** (our gold) for *state* + the single most important action. **AA 4.5:1** for body text. **Never signal state by color alone** (pair with icon/label).

## Directive 5 — Motion tokens *(Material m1 + IBM Carbon, primary 3-0)*
- **Desktop: 150–200ms** (mobile ~300ms). Scale: tap/toggle **70ms**, fade **110ms**, small expansion **150ms**, toast/expansion **240ms**, large/important **400ms**, background dim **700ms**.
- Easing: **entrances decelerate** `cubic-bezier(0,0,0.2,1)`; **exits accelerate** `cubic-bezier(0.4,0,1,1)`; standard move/scale `cubic-bezier(0.4,0,0.2,1)`. (Re-verify against Material 3 before locking.)

## Directive 6 — The Council = trust through transparency *(Ground News, ADA 2025 finalist; primary 3-0 + design inference)*
- Treat the multi-model council exactly like Ground News treats bias: **color-coded per-voice markers** and **layouts crafted to invite exploring multiple viewpoints**. The transparency *is* the design.
- Keep the animated run-map + drill-down explorer (today's engine) — reskinned to the editorial system and made the immersive hero, not a buried panel.

## Directive 7 — Explainable rationale, not metrics *(Smashing 2026 "Explainable Rationale", primary 3-0; numeric-confidence REFUTED 0-3)*
- Surface reasoning as **concise plain-language rationale**: "Because X, therefore Y," each step linked to a **rule / preference / prior action / piece of evidence**. Not a wall of audit panels.
- **ANTI-PATTERN (refuted 0-3):** prominent numeric confidence ("75%") and color-coded confidence glyphs as trust signals — they invite automation bias. Prefer **qualitative bands** ("strong agreement," "contested") **backed by the actual cited evidence** the user can open.

## Directive 8 — Craft ethos *(Rauno Freiberg, primary 3-0)*
- "Quality is a function of patience and focus." Obsess the small stuff: optical alignment, transition timing, empty states, the feel of every interaction.

## Anti-patterns to delete (refuted claims — do NOT ship)
- Big numeric confidence % / color-coded confidence glyphs (refuted 0-3). → qualitative + evidence.
- Dense, always-visible audit panels. → concise rationale, drill on demand.
- Persistent control-dump sidebar. → chrome-less + ⌘K.

## Open questions (resolve during build)
- Material 3 current easing/duration tokens vs the cited Material v1/Carbon values.
- Exact spacing scale (Geist's specific 4px-rhythm claim was refuted) — adopt a verified 4/8px base.
- Best qualitative confidence visualization given numeric % is out.

## Carry-over (keep, reskin)
- Council real-time progress channel (P1), run-map animation (P2), reasoning explorer logic (P3). The *engine* stays; the *presentation* is rebuilt to these directives.
