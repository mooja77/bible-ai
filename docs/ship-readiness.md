# Ship Readiness

Date: 2026-07-13
Status: Engineering baseline green; **public release blocked by current evidence gates**.

This is the straight answer to "is the product finished / shippable to end users."

## Bottom line

The remediation engineering is complete and the local automated build, corpus,
security, and WebView suites pass. The app is not yet approved for public
distribution because the current real-provider evidence has only one successful
provider family and the named human rights, safety, accessibility, clean-profile,
and distribution attestations have not been completed. A private development
build is usable; a public release is not authorized by the current evidence.

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
  are hydrated from retrieved corpus rows; five adversarial quality cases pass;
  provider cancellation crosses the sidecar boundary.
- Automated quality: `npm run check`, 155 sidecar tests, 124 Rust tests, strict
  Clippy, schema sync, both npm audits, Cargo audit, and CycloneDX SBOM validation
  pass.
- Desktop behavior: all 77 WebView E2E tests pass, including the Reader/Council
  axe scan, keyboard/focus behavior, contrast, and maximum text scaling. The
  run used exact-matched, Microsoft-signed EdgeDriver/WebView2 150.0.4078.65.

Additional follow-through now records the exact Ollama embedding model digest
and aggregate per-edition embedding hashes, provides a resumable atomic corpus
builder, stores safety resources in a versioned locale registry, labels the PDF
as an untagged visual archive while preferring HTML/Markdown for accessibility,
and adds Windows E2E plus macOS bundle-smoke CI. The labelled Council
confidence-review process exists but remains pending named human labels.

The current 20-result Granite/Ollama fixture passes every local grounding, quote,
primary-passage, stage, and output-weakness check with zero sidecar errors. It
does **not** pass the release contract because only one non-mock provider succeeds
per question. This is expected fail-closed behavior; local-model quality cannot
be presented as cross-family provider evidence.

## The exact steps to ship (human)

1. **Repair one external provider credential and complete multi-provider
   evidence.** The saved Google, OpenAI, and Anthropic credentials were rejected
   during the 2026-07-13 live probes. Run the current suite with Granite/Ollama
   plus one working external family, using `--resume` only when provider/model
   diagnostics match, then run `cd app && npm run qa:real-council:verify`.
   Provider names, model IDs, retrieval evidence, and every trust stage must be
   present; do not edit the fixture by hand to make it pass.

2. **Complete content and safety review** with named qualified reviewers:
   `npm run qa:content-review:template`, record the target territories and every
   source's redistribution/attribution decision, and run
   `npm run qa:content-review:verify`. A pastoral/crisis professional must also
   review the wording and localized resource candidates in
   `docs/sensitive-topic-safety-policy.md`.

3. **Build the release installer** on the target Windows build machine. Record
   hashes for the exact installer, corpus, sidecar, and SBOM artifacts.

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

- Repairing/authorizing a second provider account and accepting any associated
  API cost; the current local-provider evidence is already captured.
- Content/licensing review for the actual target territories.
- Pastoral/crisis-professional review of safety wording and local resources.
- Keyboard, screen-reader, zoom, credential-vault, and clean-profile attestation.
- Signing/notarization decisions, installed-build smoke, and publication.
- A separate macOS build/sign/notarization pass on macOS before any `.dmg` claim.

## Honest verdict

Engineering-complete, but not release-evidence-complete. Do not call the current
state publicly shippable until the current-pipeline provider fixture and all
named human attestations pass the fail-closed release gate.
