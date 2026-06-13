# EP-009: Provider readiness honesty — Design

- **Date:** 2026-06-13
- **Status:** Implemented (Council preview scope)
- **Gate:** AI trust (Gate 4)
- **Source:** `docs/development-implementation-plan.md` EP-009; ground-truthed in
  `docs/reviews/2026-06-13-ep-roadmap-ground-truth.md`.

## Background

The plan: "Provider UI does not say 'ready' unless the provider is verified."
Verified against the two provider surfaces:

- **Settings** (`SettingsPanel` / `SettingsPrimitives.ProviderStatusCard`) is
  already honest: it distinguishes `configured` (key present, untested) from `ok`
  (a diagnostic call succeeded) from `check` (failed), driven by real diagnostics.
- **Council preview** (`CouncilVoicePanels.CouncilVoicePreview`) was NOT honest.
  `getCouncilVoices` marked each provider `"will run"` and the panel header said
  "AI helpers ready to run" with a "N/M ready" count -- all keyed on `settings`
  key *presence* only. The preview never receives diagnostics, so it cannot know
  a provider is verified; "ready"/"will run" overclaimed.

## Change

Relabel the Council preview so presence-only reads as **configured** (we will
attempt it), never as verified/ready:

- Per-provider pill `"will run"` -> `"configured"` (4 sites). The Claude
  local-login fallback stays `"will try"`, and unset providers stay
  `"needs key"`/`"optional"` -- matching the plan's configured / will_try /
  skipped vocabulary. ("verified"/"failed" are not expressible here because the
  preview has no diagnostics; that remains Settings' job.)
- Header "AI helpers ready to run" -> "AI helpers configured".
- Count "N/M ready" -> "N/M configured".

"configured" matches the word `ProviderStatusCard` already uses, so the two
surfaces now share vocabulary.

## Scope

- Council preview only. Settings was already honest, so it is unchanged. Deeper
  work (plumbing verified diagnostics into the Council preview, or scoping the
  Settings per-provider "Test" buttons) is not needed to remove the overclaim and
  is out of this packet.

## Testing

- No frontend unit harness exists in this repo (frontend logic is tested only via
  wdio e2e; `npm run check` is vite build + cargo + sidecar `node --test`).
- **New e2e** in `council-mock.spec.ts`: on the Council screen the voice preview
  must contain "configured" and must NOT contain "ready to run" or "will run".
  The header/count render regardless of keys, so this is deterministic in the
  no-key e2e environment. Confirmed RED before the relabel ("configured" absent,
  "ready to run" present), GREEN after.
- `npm run check` green; full `npm run test:e2e:build`.

## Regression caught by the layout guard

The first GREEN e2e run failed `layout-maxscale.spec` -- the longer word
"configured" made a voice-preview status pill spill 7px past the viewport at
140% text scale (`span "configured" right=1059 vw=1052`). This was a real
regression from the relabel, caught by the max-scale guard built earlier this
session. Fixed by letting the label+badge row wrap (`flex flex-wrap ...
gap-x-2 gap-y-1`), which drops the card's min-content from `label + badge` to
the wider of the two -- comfortably clearing the overflow while keeping the
honest "configured" wording. The honest fix was not to shorten the word.
