# Ship Readiness

Date: 2026-07-15
Status: Engineering baseline green; **public release blocked by current evidence gates**.

Bible AI is a public, MIT-licensed open-source GitHub project. References below
to private/test builds describe unverified installer artifacts, not repository
visibility or the source-code licence.

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
- Automated quality: `npm run check`, 157 sidecar tests, 3 corpus-backed QA
  helper tests, 127 Rust tests, strict Clippy, schema sync, npm audit (zero
  vulnerabilities), and CycloneDX SBOM validation pass. Cargo audit exits zero
  with 19 allowed warnings: Linux-only GTK3 maintenance notices, one patched-in-
  newer-GTK `glib` advisory with no current Windows dependency path, and
  unmaintained transitive Tauri/url-pattern and text/PDF crates (including the
  July 2026 `rustybuzz`/`ttf-parser` notices) for which the direct `krilla
  0.8.2` dependency is already the latest published version. These warnings
  remain tracked cross-platform/PDF maintenance risk, not a zero-warning claim.
- Desktop behavior: all 80 WebView E2E tests pass, including axe scans across
  every primary view and shell overlay, keyboard/focus behavior, contrast, and
  maximum text scaling. The
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

The protected GitHub release pipeline and its two release-only verifier fixes
are merged through PR #23 at
`60502adb0963eb1683eae15ec5b2991479c43894`. The latest changes pass the
[CI/trust run](https://github.com/mooja77/bible-ai/actions/runs/29431440472)
and [platform run](https://github.com/mooja77/bible-ai/actions/runs/29431442006):
all 80 hosted Windows WebView tests, macOS ad-hoc bundle build and launch smoke,
dependency audits, SBOM verification, and GitGuardian. The repository now has
immutable candidate and protected promotion workflows, but no public Release.

The freshest local unsigned Windows application binaries were built on
2026-07-15 at `77d82cd810680f273e7034271b3c85becdb080ee`. They passed resource
verification, isolated-profile app launch, and exact-NSIS
install/launch/uninstall smoke. PRs #22 and #23 then changed only release
verification/package scripts and their tests—not application, sidecar, corpus,
dependency, or build-configuration inputs. From a clean final `main` at
`60502adb0963eb1683eae15ec5b2991479c43894`, the SBOMs, signing record,
manifest, summary, package, archive, and portable manual-QA package were
regenerated and verified against those same binaries:

- NSIS: `Bible AI_0.1.0_x64-setup.exe`, 494,576,058 bytes,
  SHA-256 `5963fec8083b82cba079af65f13bdd7c9fbe57cea98af7ed36a313c91af38b95`.
- MSI: `Bible AI_0.1.0_x64_en-US.msi`, 613,327,972 bytes,
  SHA-256 `2be312318c8e51cb91a460447df9e209140f5a07da6945e7bc6b2908cb836d26`.
- Release archive: `Bible AI_0.1.0_release-package.zip`, 1,105,383,052 bytes,
  SHA-256 `9f201be68bdeac9a02dc77f8c41c54167a77167e49b73ef1fcf9e8c1e905c293`.

These are private local audit artifacts—not upload candidates or publication
approval. The official GitHub candidate workflow must still rebuild from final
`main` after rights review permits private corpus staging. The named human
evidence gates below remain intentionally fail-closed.

The most recent full-corpus Apple Silicon candidate was built from commit
`9adf30b` by
[macOS release-candidate run 29406993816](https://github.com/mooja77/bible-ai/actions/runs/29406993816).
The workflow verified the full corpus checksum, built
`Bible AI_0.1.0_aarch64.dmg` (605,836,814 bytes), mounted it, copied the app,
launch-smoked the installed copy, required non-empty `user.sqlite`, and uploaded
the candidate artifact. It predates the current dependency baseline and must be
rebuilt before release. It proves automated Apple Silicon packaging and startup,
not public approval: the build is ad-hoc signed, unnotarized, not
Intel/universal, and has not completed the clean-Mac human gate.

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

3. **Build and retain exact release artifacts.** The Windows hashes above are
   local audit evidence and must not be reused for publication. After the named
   reviews, build new NSIS, MSI, archive, and macOS artifacts from the chosen
   source commit. If source, corpus, sidecar, SBOM, version, or signing state
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
- Developer ID signing/notarization plus clean-profile human macOS QA before a
  public `.dmg` claim; automated Apple Silicon build/install/startup is already
  proven.

## Honest verdict

Engineering-complete, but not release-evidence-complete. Do not call the current
state publicly shippable until the current-pipeline provider fixture and all
named human attestations pass the fail-closed release gate.
