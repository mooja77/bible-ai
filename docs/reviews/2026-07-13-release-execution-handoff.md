# Release Execution Handoff — updated 2026-07-14

Status: **fresh unsigned Windows artifacts verified; do not publish them**.
Public distribution remains blocked by three fail-closed human evidence
categories.

## Current built artifacts (still not publication-approved)

Version: `0.1.0`, Windows x64, built 2026-07-14.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `Bible AI_0.1.0_x64-setup.exe` | 493,836,610 | `5649e7ab37110d747e0773fa133cbdf600fba6df4b06ab1b117ca04e648643bf` |
| `Bible AI_0.1.0_x64_en-US.msi` | 612,103,268 | `34d94c75d9abf2fb6522241fbb2a8173d46b0d8844f68fb023aea1ec67973e93` |

`release:verify`, clean-profile binary smoke, and NSIS
install/launch/uninstall smoke pass. These hashes identify the machine-tested
artifacts, but they do not substitute for the pending named reviews. Any bundled
source/corpus/version/signing change requires a rebuild and new hashes.

## Historical built artifacts (stale)

Version: `0.1.0`, Windows x64.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `Bible AI_0.1.0_x64-setup.exe` | 457,309,833 | `3f72aed0b74c13f14d55f88dab273e5dcd788392dc3488453ed29dc1bd057512` |
| `Bible AI_0.1.0_x64_en-US.msi` | 560,028,678 | `7921f0bf5044fb4a860eebdab3248268cf72b62d3849915ba5c3f276e7e7be5f` |
| `app.exe` | 18,449,408 | `d8f82048fe1736a4ba1e4410caeb9bf0e37e8c07e3b69fbeda8d550ffd258859` |
| `corpus.sqlite` | 819,224,576 | `e0501e10c38f1222ebfbbf482cba2af98025ae1be4ff63b14b1bac34dff2bbc8` |
| `Bible AI_0.1.0_release-package.zip` | generated package | `6e1d720bbf3bd13720694e67a7f4f055b45e8dd12b8c6091e9c9b7eaaab9e7f0` |

These hashes describe the earlier build only and no longer identify the current
source tree. They are retained as an audit record, not as upload candidates.
After every external and human gate is complete, rebuild and re-run the entire
release chain to produce new hashes.

The historical release package contained both installers, the release manifest,
release summary, and npm/Cargo CycloneDX SBOMs. The portable manual-QA package
contains both installers, manifest/summary, evidence collector, and evidence
verifier.

## Machine verification completed

- `npm run check:trust`: schema v14, 11 source-lock entries, four canonical
  quality cases, three corpus-backed QA helper tests, 157 sidecar tests.
- `npm run check`: production TypeScript/Vite build, Rust format/check/test,
  strict Clippy, script/resource/leak/quality checks, and sidecar tests.
- Full corpus lock/integrity: 31,310 verses; 155,557 edition mappings; 155,556
  embeddings; all six translation-row expectations pass.
- Supply chain: npm app and sidecar audits report zero vulnerabilities; Cargo
  audit reports zero vulnerabilities and 19 documented allowed upstream
  maintenance/unsoundness warnings; npm/Cargo SBOMs validate.
- Release build: optimized Tauri app plus MSI and NSIS bundles succeeded.
- Release tree verification and direct clean-profile binary smoke passed.
- The source-bound release manifest, summary, package, archive, and manual-QA
  package were regenerated and verified against the current installers. They
  must be regenerated again after any tracked source change.
- Source/staged hashes match for Council sidecar, shared provider logic, and
  Ollama provider logic.
- Tauri WebView aggregate suite passed after a fresh rerun. During the final
  hardening pass, a timestamp regression fixture exposed shared-profile cleanup
  and Council-history refresh weaknesses; both were fixed before the complete
  suite was repeated. The current follow-through run passes all 79 tests with
  exact-matched, Microsoft-signed EdgeDriver/WebView2 150.0.4078.65.

The current follow-through also passes 126 Rust tests, strict Clippy, both npm
audits, the full 155,556-embedding identity verifier, all 11 source hashes, and
SBOM validation for 553 npm and 475 Cargo components. None of those checks
revives the stale installer hashes above.

## Real Council evidence

The current fixture contains 20 complete non-mock Granite 4.1 8B/Ollama +
Claude Code (`sonnet`, subscription route) results. Both providers succeeded on
20/20 questions; all 20 pass grounding, exact quote hydration, primary-passage
coverage, scope, judge, evidence-route, soft-layer, kill-test, and output-
weakness checks. There are zero sidecar errors, run warnings, and weak results.

The strict verifier passes. A SHA-bound human confidence template has been
regenerated for the exact fixture and remains deliberately pending. The runner
reuses a result only when provider/model diagnostics match and local trust checks
already pass.

## Public gate result

All automated corpus, schema, SBOM, npm-audit, Cargo-audit, real-Council,
installer, and WebView stages pass. The public gate fails only:

1. **Human Council confidence review:** a named qualified reviewer must label
   all 20 exact fixture cases and resolve blocking findings.
2. **Manual clean-profile QA:** run the portable packet on a separate Windows
   user or VM; record named operator/profile, installer hashes, install/launch,
   credential vault, secret leakage, backup/restore, keyboard, screen reader,
   200% zoom, safety wording, and locale-resource evidence.
3. **Human content rights and safety review:** named qualified reviewers must
   approve every locked source for the intended territories/channels and review
   localized sensitive-topic wording/resources.

Do not install onto the development profile to satisfy the clean-profile gate,
do not infer human approval from automated tests, and do not publish or merge a
release solely because the artifacts build.

## Exact next commands after human review

From `app/`, after the named reviewers complete the generated files:

```powershell
npm run qa:real-council:verify
npm run qa:confidence-review:verify
npm run qa:manual-gates:verify
npm run qa:content-review:verify
npm run qa:public-release:verify
npm run release:install-smoke
```

Only after all commands pass should the exact hashed package be attached to a
public GitHub Release. Build fresh artifacts after those gates pass; never reuse
the stale hashes in this document.
