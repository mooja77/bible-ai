# UX H4 — First-run AI setup onboarding (slice 1) — Implementation Plan

> Turn the Council's dead-end "no provider" notice into a friendly, actionable get-started card with a direct Open-Settings button + "still usable without AI" reassurance. Attacks the #1 barrier; additive, low-risk. Full guided wizard deferred to a later slice.

**Spec:** `docs/superpowers/specs/2026-05-30-ux-h4-setup-onboarding-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] `CouncilVoicePreview`: add `onOpenSettings?` prop; replace terse no-provider notice with a
  get-started card (heading, plain body, "Open Settings to connect" button, reassurance). Relabel
  header to "AI helpers ready to run" / "{n}/{m} ready".
- [x] `CouncilPanel`: add + forward `onOpenSettings?`.
- [x] `App.tsx`: wire `onOpenSettings={() => { setSearchQuery(""); setMode("settings"); }}`.
- [x] tsc clean; grep-confirm no e2e couples to the card/strings.
- [x] `npm run check` 65/65; `npm run test:e2e:build` green.
- [x] spec/plan committed; ff-merge to main.

## Self-review
- Scoped to the contextual card (not a big wizard) given session length/risk; documented the deferred
  full wizard. Mirrors the existing onOpenDataSources→setMode("settings") pattern. Sequential single
  calls; tsc/build the arbiter.
