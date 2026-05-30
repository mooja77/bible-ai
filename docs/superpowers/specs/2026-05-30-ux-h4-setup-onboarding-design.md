# UX H4 — First-run AI setup onboarding (slice 1: Council get-started card) — Design

- **Date:** 2026-05-30
- **Status:** Implemented (merged to `main`)
- **Theme:** H — UX for non-technical users, sub-project 4. The plan's #1 friction: AI setup barrier.

## Problem

The Council is gated behind AI-provider setup, but a new user hits only a terse, jargon-y notice
("No AI provider is configured yet… add an OpenAI, Google, or Anthropic key") with **no action** —
they must discover Settings on their own. This is the single biggest barrier to the flagship feature.

## Scope (slice 1)

Rather than build a large multi-step wizard component late in a session, this slice delivers the
highest-value, lowest-risk piece: turn the dead-end notice into a **friendly, actionable get-started
card** with a direct path to Settings and a "you can still use the app without AI" reassurance.
(A fuller guided wizard — provider-choice cards with inline key validation — remains a later H4 slice.)

### `CouncilVoicePanels.tsx` — `CouncilVoicePreview`
- New optional `onOpenSettings?: () => void` prop.
- The no-provider block becomes a card (`data-testid="council-setup-prompt"`):
  - Heading **"Get the AI helpers ready"**.
  - Plain-language body: connect at least one helper; easiest is a free local Claude Code login, or
    paste your own key; ~a minute; key stored securely on device.
  - A primary **"Open Settings to connect"** button (`data-testid="council-open-settings"`, shown
    when `onOpenSettings` is provided).
  - Reassurance: "You can keep reading and searching Scripture without AI."
- Also relabels the panel header "Voices before submit" → **"AI helpers ready to run"** and
  "{n}/{m} enabled" → "{n}/{m} ready" (plain language; no e2e couples to these strings — verified).

### `CouncilPanel.tsx`
- New optional `onOpenSettings?` prop, forwarded to `CouncilVoicePreview`.

### `App.tsx`
- Pass `onOpenSettings={() => { setSearchQuery(""); setMode("settings"); }}` (mirrors the existing
  `ResourcesPanel onOpenDataSources={() => setMode("settings")}` pattern).

## Testing

- `npm run build` + full `npm run check` green; grep-confirmed no e2e couples to the voice-preview
  card or its strings; full `npm run test:e2e:build` green.
- No new e2e: the card only renders when *no* provider is configured; the e2e profile's setup state
  isn't a stable hook for this, and the wiring is a behavior-preserving prop pass verified by tsc +
  the existing council-mock flow.

## Out of scope (later H4 slices)
- Full guided wizard: provider-choice cards (Easiest / Paste key / Gateway) with inline key-format
  validation and "skip & just read"; first-run auto-surfacing. (The contextual card here already
  removes the dead-end.)

## Rollout

Branch `ux-h4-setup-onboarding`. Modify: `CouncilVoicePanels.tsx`, `CouncilPanel.tsx`, `App.tsx`,
spec/plan. Verify with `npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
