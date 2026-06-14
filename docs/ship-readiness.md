# Ship Readiness

Date: 2026-06-14
Status: Shippable as a public/private beta once the human gates below are done.

This is the straight answer to "is the product finished / shippable to end users."

## Bottom line

The app is feature-complete and **passes every automated release gate**. The only
things between here and a shipped beta are gates that require a human on a real
machine (and one product decision). Nothing more needs to be *built*.

## What is verified (done)

- Core product works: reader, search, Council, Study Packet folder export,
  bookmarks/notes/tags, Theology, resources, backup/restore.
- Trust & safety: sensitive-topic prompts are routed away from the Council;
  exports are leak-scanned; provider readiness is reported honestly; restore
  validates DB identity and scrubs legacy secrets; imports are size-budgeted and
  unreviewed sources are quarantined.
- Study Packet v1 folder export works end-to-end with a write-boundary leak guard.
- AI quality: fabricated-citation gate over the Council fixtures; quality-case
  schema + resolution rule.
- Release pipeline: `npm run release:check` (verify/manifest/summary/package/
  archive + smokes) and **Real Council QA** (`qa:real-council:verify`, 20 real
  Gemini/OpenAI results) pass.
- `npm run check` is green: vite build, Rust (fmt/check/clippy `-D warnings`/112
  tests), 85 sidecar tests, all `node --check`, leak + quality-case + quality
  gates.

The single failing gate today is **Manual clean-profile QA** in
`qa:public-release:verify` -- and it fails only because no human has performed and
recorded it yet (`release/manual-release-gates.json` is still the blank template).

## The exact steps to ship (human)

1. **Build the release installer** (on a Windows machine):
   `cd app && npm run release:build`
   This runs `tauri build` (NSIS/MSI installers) + the full `release:check` chain.

2. **Manual clean-profile QA** on a *separate clean Windows user profile or VM*
   (never your dev profile). Install the built installer, then verify and record
   each in `app/release/manual-release-gates.json` (template already present;
   regenerate with `npm run qa:manual-gates:template`):
   - operator, windows_profile, and the NSIS/MSI `installer_artifacts` (names +
     SHA-256).
   - clean_profile_install, first_launch, settings_provider_keys, credential-vault
     (clean + upgrade profile), exports secret-leak check, backup/restore,
     sqlite backup/restore -> set each `*_passed` to `true` only if it truly
     passed.
   Do NOT fill these in without actually doing the checks -- the gate exists
   precisely so a person attests to a clean-machine install.

3. **Verify the public-release gate**: `npm run qa:public-release:verify` must
   pass (it will, once step 2 is honestly recorded).

4. **Signing decision** (per `docs/distribution-channel-decision.md`): a public
   *beta* may ship **unsigned** as long as the SmartScreen/"unknown publisher"
   warning is documented in the release notes. Acquiring a Windows code-signing
   certificate is the alternative and unblocks the auto-updater later. This is a
   cost/identity decision for the owner.

5. **Pastoral / content sign-off** (genuinely required for a faith + AI tool):
   - The crisis wording in `SENSITIVE_TOPIC_MESSAGE` (`app/src-tauri/src/lib.rs`)
     and the sensitive-topic taxonomy/coverage (see
     `docs/sensitive-topic-safety-policy.md`). Marked `TODO(pastoral-review)`.
   - The license/redistribution cells marked `TODO confirm` in
     `docs/content-bom.md`.

6. **Publish**: GitHub Release with the installer + SHA-256 checksums, the release
   notes (`docs/release-notes.md`), the known-issues list, the privacy note, and
   the unsigned-installer warning if shipping unsigned.

## What only a human can do (recap)

- The manual clean-machine QA + attestation (step 2) and the build/publish (1, 6).
- The signing certificate decision (4).
- Pastoral/legal sign-off on safety + license wording (5).
- Real-provider spend is already evidenced (Real Council QA, 20 results); future
  real-provider testing uses the owner's keys.

## Honest verdict

Engineering-complete and gate-green. It is **shippable as a beta** the moment a
person completes the clean-machine QA attestation, makes the signing call, and
signs off the crisis wording. There is no remaining build work blocking a ship.
