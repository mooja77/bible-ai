# UX H2 — Plain-language relabel (slice 1: retrieval controls) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (merged to `main`)
- **Theme:** H — UX for non-technical users, sub-project 2. See `2026-05-30-ux-enhancement-plan.md`.

## Problem

Council exposes ML jargon to lay users. Friction #3 in the plan: the **retrieval-strategy
dropdown** shows "Hybrid retrieval / Keyword only / Semantic only" with no explanation of what
"semantic" means or why to choose one; the evidence controls show terse "Cross-references" / "Limit".

## Scope decision (important)

A *full* plain-language relabel across the app is **higher-risk than one pass should absorb**: the
e2e suite hard-codes dozens of exact visible strings as selectors — `h1=The Council`, `h2=Synthesis`,
`"WHY THIS RANKED HIGHEST"`, `"COMPARE POSITIONS"`, `"My Judgment"`, `"Add to Theology"`,
`"Attach session"`, `"Research Trail"`, `"Argument Maps"`, `span=used`, the `explicit reference +
hybrid` badge, etc. Each relabel would require rewriting the asserting spec(s) in lockstep, and a
mistake silently breaks the shared-session suite.

Therefore H2 is delivered in **safe, complete slices**, starting with the retrieval controls where
e2e selects by `value`/`aria-label` (not visible text) — so the visible relabel is provably
e2e-safe. Later slices (Council result headings, judgment panel, transparency-panel titles) will be
coordinated *with* the corresponding spec rewrites under H7 (Council redesign), which already
restructures those surfaces — relabeling them there avoids doing the spec churn twice.

## This slice (retrieval controls, CouncilPanel.tsx)

- Strategy options (selected by `value` in e2e — visible text free to change):
  - `hybrid` "Hybrid retrieval" → **"Search: keyword + meaning"**
  - `keyword` "Keyword only" → **"Search: keyword"**
  - `semantic` "Semantic only" → **"Search: by meaning"**
- "Cross-references" → **"Include cross-references"**
- "Limit" → **"Max passages"** (+ added `aria-label="Maximum passages to consider"`).
- `aria-label`s on the selects (the e2e hooks) are **unchanged**; the `explicit reference + hybrid`
  retrieval-mode badge (asserted by e2e) is **unchanged**.

## Testing

- `npm run build` + full `npm run check` green; grep-confirmed no e2e asserts the relabeled visible
  strings; full `npm run test:e2e:build` green (60 passing).

## Out of scope (tracked for later H2 slices / H7)

Council result headings ("Synthesis" → "Summary answer", etc.), judgment-panel labels, transparency
panel titles ("Research Trail", "Argument Maps", "Confidence rationale", "Retrieved Evidence"),
"voices" → "AI helpers" — all to be relabeled alongside their spec rewrites in H7.

## Rollout

Branch `ux-h2-plain-language`. Modify: `CouncilPanel.tsx`, spec/plan. Verify with `npm run check` +
`npm run test:e2e:build`, then ff-merge to `main`.
