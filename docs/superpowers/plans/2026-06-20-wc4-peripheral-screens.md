# WC4 — Peripheral Screens Reskin — Implementation Plan

> Sub-skill: subagent-driven-development. Phase WC4 (WC1 shell + WC2 reader + WC3 Council canvas DONE, all green on `feat/v1-editorial-reskin`). Design law: `docs/superpowers/specs/2026-06-20-world-class-redesign-directives.md`. Architecture: code-architect run 2026-06-21.

**Goal:** Reskin the five peripheral screens — **Theology**, **Resources**, **Workspaces**, **Tags**, **Settings** — to the Calm Editorial system. They render inside the new shell + inherit the palette, but their internals are still old-style: hard-bordered `surface-panel` boxes, `text-xs tracking-wider text-neutral-400` sidebar-label section heads, dense button rows, no serif hierarchy, emerald dark-mode selection states. Make them feel like the same world-class editorial product **without breaking a single e2e selector**.

## Strategy
Additive-then-swap, exactly as WC1–WC3. (1) Add shared editorial CSS classes (additive, zero e2e impact). (2) Per screen, swap chrome-heavy structure for the new classes — keep every `data-testid`, `aria-label`, heading text, and button text EXACT. Presentation only (one logic touch: Theology confidence picker). Each task is e2e-green in isolation because selectors are preserved.

## New shared editorial CSS (App.css, additive) — T1
- `.editorial-page-header` (+ `h1` serif 2rem/400, + `p` 0.875rem neutral-500 max-w 52ch) — chrome-less page title block (no box).
- `.section-kicker` — clone of `.reader-kicker` (11px/600/0.12em/uppercase/`--color-amber-300`, display:block) for content-screen sections.
- `.editorial-section-h2` — serif 1.125rem/400 neutral-200, primary section title.
- `.editorial-rule` — ghost gradient 1px divider, opacity .55, replaces hard `border-t border-neutral-800`.
- `.action-strip` (+ `.btn-ghost` 0.75rem/tight) — recedes button dumps into a calm ghost row.
- `.topic-pill-active` (accent-bg + accent-border + amber-100) / `.topic-pill-idle` (neutral-400, hover surface-card-hover) — sidebar list selection without emerald.
- Verify: build green + `contrast-light.spec` (kicker uses amber-300 → light `#836620` ~5.4:1 AA, already proven WC3). Commit.

## Per-screen tasks
- **T2 Tags** (`TagBrowser.tsx`): de-box header → `editorial-page-header` + kicker "Study organization"; h2→h1 serif (no test selects `h1/h2=Tags`); topic nav active→`topic-pill-active`/idle; item list rhythm. Preserve `tag-browser`, `tag-browser-tag`, `tag-browser-item`. Verify `tags-browse.spec`.
- **T3 Resources** (`ResourcesPanel.tsx`): de-box header (+kicker "Open resources"); de-box 5-filter strip → flat `Filter` kicker + grid; result active emerald→accent; resource body text → `font-serif text-base`; Citation/Attribution h3→`section-kicker`; actions→`action-strip`. Preserve `resource-status/-results/-empty-state/-detail/-citation`, all filter aria-labels, `h1=Resources`. Verify `backup-restore.spec`.
- **T4 Workspaces** (`WorkspacesPanel.tsx`): sidebar kicker "Your study"; workspace list active `bg-neutral-800`→accent; detail hard `border-b`→`editorial-rule`; export 8-button row→`action-strip` btn-ghost (primary stays btn-primary); Note/Markdown-Preview h3→`section-kicker`. Preserve `h1=Workspaces`, `h2={title}`, `delete-workspace`, `markdown-preview`, `workspace-save-status`, `workspace-item`, all Save/Preview button texts + aria-labels. Verify `workspace.spec` + `backup-restore.spec`.
- **T5 Theology Part A — structure** (`TheologyPanel.tsx`, `TheologySections.tsx`): de-box header (+kicker "Systematic theology"); topic sidebar surface-panel→`border-r` divider col; topic active→`topic-pill-active/idle`; progress sidebar surface-panel→`border-l` divider col; all section heads → `section-kicker` + `editorial-section-h2`; de-box secondary `soft-card p-3` → `editorial-rule` + MOVE testids to inner section els. Preserve every theology testid + aria-label + button text. Verify `backup-restore.spec`.
- **T6 Theology Part B — actions + confidence** (`TheologyPanel.tsx`): collapse 7-button row → 2 prominent (Ask Council btn-secondary, Save Conclusion btn-primary) + ghost strip; replace numeric `input[type=range]` confidence with 5-step qualitative segmented picker (Uncertain/Leaning/Moderate/Confident/Settled → 0/25/50/75/100, nearest-snap for aria-pressed, same `updateConclusion({confidence})`). No spec tests the range/value. Verify `backup-restore.spec`.
- **T7 Settings Part A — structure** (`SettingsPanel.tsx`, `SettingsInfoSections.tsx`, `DataSourcesSection.tsx`): remove `surface-panel` section boxes → `<section className="space-y-5">` + `editorial-rule` between; kickers above heads; **`h2=Provider Status` MUST stay `<h2>` + exact text** (only class→`editorial-section-h2`); "Council"/"User Data" h2→kicker or editorial-section-h2 keeping text; **move `data-sources-screen`/`license-attribution-screen`/`about-distribution-screen` testids to inner always-rendered divs** (release-readiness waits on display). Verify `release-readiness` + `backup-restore` + `settings-validation`.
- **T8 Settings Part B — buttons + primitives** (`SettingsPanel.tsx`, `SettingsPrimitives.tsx`): provider test buttons→`action-strip` btn-ghost (still `<button>`+text → selectors resolve, isDisplayed passes); keep `Save & test`/`Save setup`/`Save settings` prominence + EXACT text; restore-flow buttons untouched; `SetupPathButton` idle border→`--border-subtle`/transparent (testId kept). Verify `release-readiness` (3) + `backup-restore` + `settings-validation` + FULL suite.
- **T9 Motion + polish**: `editorial-rule` opacity fade `--motion-fade`; pill transitions 140ms; rely on existing reduced-motion block; visual QA both themes; FULL suite green. Commit WC4 complete.

## E2E risks (zero spec edits expected)
- `h2=Provider Status` exact-text → keep tag+text, change class only.
- `data-sources/license/about` testids hidden after de-box → move to inner always-rendered div (not the removed wrapper).
- ghost test buttons not clickable → still `<button>`+text, in-DOM, not disabled → selector + isDisplayed pass.
- workspace `h2={title}`, `button=Confirm restore`, `button*=${topicTitle}` → text preserved.
- confidence range removed → confirmed no spec selects it.
- Affected specs (read-only, no edits): `release-readiness`, `backup-restore`, `tags-browse`, `workspace`, `settings-validation`, `contrast-light`.

## Order rationale
T1 first (all use the classes). T2–T4 independent. T5 before T6 (structure before action collapse). T7 before T8 (containers before strips). T9 last.
