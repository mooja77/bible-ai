# Ship Readiness

Date: 2026-07-14
Status: Engineering baseline green; **public release blocked by current evidence gates**.

This is the straight answer to "is the product finished / shippable to end users."

## Bottom line

The remediation engineering is complete and the local automated build, corpus,
security, WebView, installer, and two-provider Council machine gates pass. The
app is not yet approved for public distribution because the named human
confidence, content-rights, safety, accessibility, clean-profile, and
distribution attestations have not been completed. A private development build
is usable; a public release is not authorized by the current evidence.

## What is verified (done)

- Core product works: reader, search, Council, Study Packet folder export,
  bookmarks/notes/tags, Theology, resources, backup/restore.
- Trust & safety: sensitive-topic prompts are routed away from the Council;
  exports are leak-scanned; provider readiness is reported honestly; restore
  validates DB identity and scrubs legacy secrets; imports are size-budgeted and
  unreviewed sources are quarantined.
- Study Packet v1 folder export works end-to-end with a write-boundary leak guard.
- Corpus trust: 11 source artifacts checksum-locked; explicit edition
  versification mappings; 155,557 mappings; 155,556 text-bearing embeddings;
  no unexplained orphan verses; full source and corpus verifiers pass.
- AI quality: citation-free output is unverifiable; visible Scripture quotations
  are hydrated from retrieved corpus rows; four canonical quality cases pass;
  provider cancellation crosses the sidecar boundary.
- Automated quality: `npm run check`, 156 sidecar tests, 3 corpus-backed QA
  helper tests, 125 Rust tests, strict Clippy, schema sync, npm audit (zero
  vulnerabilities), and CycloneDX SBOM validation pass. Cargo audit exits zero
  with 19 allowed warnings: Linux-only GTK3 maintenance notices, one patched-in-
  newer-GTK `glib` advisory with no current Windows dependency path, and
  unmaintained transitive text/PDF crates for which the direct `krilla 0.8.2`
  dependency is already the latest published version. These warnings remain a
  tracked cross-platform/PDF maintenance risk, not a zero-warning claim.
- Desktop behavior: all 77 WebView E2E tests pass, including the Reader/Council
  axe scan, keyboard/focus behavior, contrast, and maximum text scaling. The
  run used exact-matched, Microsoft-signed EdgeDriver/WebView2 150.0.4078.65.

Additional follow-through now records the exact Ollama embedding model digest
and aggregate per-edition embedding hashes, provides a resumable atomic corpus
builder, stores safety resources in a versioned locale registry, labels the PDF
as an untagged visual archive while preferring HTML/Markdown for accessibility,
adds Windows E2E plus macOS bundle-smoke CI, and exposes the installed corpus's
verse, mapping, FTS, embedding, per-edition, model, and digest inventory in
Settings. Setup diagnostics preserve corpus and Ollama results if the AI
sidecar is unavailable. The labelled Council confidence-review process exists
but remains pending named human labels.

The current 20-result Granite/Ollama + Claude Code fixture passes every
grounding, quote, primary-passage, stage, provider-diversity, and output-weakness
check with zero sidecar errors. Claude and Ollama each succeeded 20/20. The
strict machine verifier passes, but its SHA-bound human confidence review is
still pending and cannot be inferred from the automated result.

Fresh unsigned Windows bundles were built on 2026-07-14 and passed resource
verification, clean-profile app launch, and NSIS install/launch/uninstall smoke:

- NSIS: `Bible AI_0.1.0_x64-setup.exe`, 493,796,392 bytes,
  SHA-256 `97a4966432b1a9ec459c18fe205280719bef1a47303c2062640df67bca14e055`.
- MSI: `Bible AI_0.1.0_x64_en-US.msi`, 612,086,884 bytes,
  SHA-256 `5deb52ea2c5443dfe4999522a891358a9d2ed001a8b47b2466adf84258f97d4f`.

## The exact steps to ship (human)

1. **Complete content and safety review** with named qualified reviewers:
   run `npm run qa:content-review:template`, record the target territories and every
   distribution channel plus every source's evidence, redistribution, and
   attribution decision, confirm the bound `free_noncommercial` release scope,
   and run
   `npm run qa:content-review:verify`. A pastoral/crisis professional must also
   review the wording and localized resource candidates in
   `docs/sensitive-topic-safety-policy.md`.

2. **Complete the human Council confidence review.** The current Granite +
   Claude machine fixture already passes. Run
   `npm run qa:confidence-review:packet`, then have a named qualified reviewer
   complete every label and blocking-issue field in the generated SHA-bound
   `app/release/council-confidence-review.json`. Run
   `npm run qa:confidence-review:verify`. Do not edit the underlying Council
   fixture or claim that automated grounding proves theological quality.

3. **Retain the exact release artifacts.** The current NSIS/MSI are built and
   hashed above. If source, corpus, sidecar, SBOM, version, or signing state
   changes, rebuild and repeat every artifact-bound gate.

4. **Manual clean-profile QA** on a *separate clean Windows user profile or VM*
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

   The evidence must also include keyboard-only, screen-reader, 200% zoom,
   localized safety-resource wording, and content-review results.

5. **Signing decision** (per `docs/distribution-channel-decision.md`): a public
   *beta* may ship **unsigned** as long as the SmartScreen/"unknown publisher"
   warning is documented in the release notes. Acquiring a Windows code-signing
   certificate is the alternative and unblocks the auto-updater later. This is a
   cost/identity decision for the owner.

6. **Verify the public-release and installed-build gates**. Both
   `npm run qa:public-release:verify` and the release smoke/install-smoke chain
   must pass against the exact artifacts intended for publication.

7. **Publish**: GitHub Release with the installer + SHA-256 checksums, the release
   notes (`docs/release-notes.md`), the known-issues list, the privacy note, and
   the unsigned-installer warning if shipping unsigned.

## What only a human can do (recap)

- Named 20-case Council confidence review against the exact fixture SHA-256.
- Content/licensing review for the actual target territories.
- Pastoral/crisis-professional review of safety wording and local resources.
- Keyboard, screen-reader, zoom, credential-vault, and clean-profile attestation.
- Signing/notarization decisions, installed-build smoke, and publication.
- A separate macOS build/sign/notarization pass on macOS before any `.dmg` claim.

## Honest verdict

Engineering-complete, but not release-evidence-complete. Do not call the current
state publicly shippable until the current-pipeline provider fixture and all
named human attestations pass the fail-closed release gate.
