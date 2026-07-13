# Release Execution Handoff — 2026-07-13

Status: Windows artifacts built and machine-verified; public distribution remains
blocked by three fail-closed evidence gates.

## Built artifacts

Version: `0.1.0`, Windows x64.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `Bible AI_0.1.0_x64-setup.exe` | 457,309,833 | `3f72aed0b74c13f14d55f88dab273e5dcd788392dc3488453ed29dc1bd057512` |
| `Bible AI_0.1.0_x64_en-US.msi` | 560,028,678 | `7921f0bf5044fb4a860eebdab3248268cf72b62d3849915ba5c3f276e7e7be5f` |
| `app.exe` | 18,449,408 | `d8f82048fe1736a4ba1e4410caeb9bf0e37e8c07e3b69fbeda8d550ffd258859` |
| `corpus.sqlite` | 819,224,576 | `e0501e10c38f1222ebfbbf482cba2af98025ae1be4ff63b14b1bac34dff2bbc8` |
| `Bible AI_0.1.0_release-package.zip` | generated package | `6e1d720bbf3bd13720694e67a7f4f055b45e8dd12b8c6091e9c9b7eaaab9e7f0` |

The verified release package contains both installers, the release manifest,
release summary, and npm/Cargo CycloneDX SBOMs. The portable manual-QA package
contains both installers, manifest/summary, evidence collector, and evidence
verifier.

## Machine verification completed

- `npm run check:trust`: schema v14, 11 source-lock entries, five adversarial
  quality cases, 148 sidecar tests.
- `npm run check`: production TypeScript/Vite build, Rust format/check/test,
  strict Clippy, script/resource/leak/quality checks, and sidecar tests.
- Full corpus lock/integrity: 31,310 verses; 155,557 edition mappings; 155,556
  embeddings; all six translation-row expectations pass.
- Supply chain: npm app and sidecar audits report zero vulnerabilities; Cargo
  audit reports zero vulnerabilities and 19 documented allowed upstream
  maintenance/unsoundness warnings; npm/Cargo SBOMs validate.
- Release build: optimized Tauri app plus MSI and NSIS bundles succeeded.
- Release tree verification and direct clean-profile binary smoke passed.
- Release manifest, summary, package, archive, and manual-QA package all passed
  their verifiers.
- Source/staged hashes match for Council sidecar, shared provider logic, and
  Ollama provider logic.
- Tauri WebView aggregate suite passed after a fresh rerun. An earlier saturated
  aggregate produced cascading timeouts; the first failing workspace spec then
  passed 12/12 in isolation, and the full suite passed in 166.6 seconds. The
  EdgeDriver warning that the installed driver has not been tested against Edge
  150 remains tooling debt, not a test failure.

## Real Council evidence

The current fixture contains 20 complete non-mock Granite 4.1 8B/Ollama runs,
zero sidecar request errors, and 20 results that pass local grounding, exact quote
hydration, primary-passage coverage, scope, judge, evidence-route, soft-layer,
kill-test, and output-weakness checks.

The strict verifier rejects only provider diversity: one successful non-mock
provider per question and one successful provider across the run, where two are
required. Saved Google, OpenAI, and Anthropic credentials were present but
rejected by their APIs; values were never printed or persisted. The runner now
supports `--resume`, but it reuses a result only when provider/model diagnostics
match and local trust checks already pass.

## Public gate result

All automated corpus, schema, SBOM, npm-audit, and Cargo-audit stages pass. The
public gate fails only:

1. **Real Council QA:** repair/authorize one external provider family, rerun with
   Granite/Ollama plus that provider, then verify.
2. **Manual clean-profile QA:** run the portable packet on a separate Windows
   user or VM; record named operator/profile, installer hashes, install/launch,
   credential vault, secret leakage, backup/restore, keyboard, screen reader,
   200% zoom, safety wording, and locale-resource evidence.
3. **Human content rights review:** a named qualified reviewer must approve every
   locked source for the intended territories, including redistribution and
   attribution obligations.

Do not install onto the development profile to satisfy the clean-profile gate,
do not infer human approval from automated tests, and do not publish or merge a
release solely because the artifacts build.

## Exact next commands after human/provider work

From the repository root, with a working second provider configured:

```powershell
python scripts/run_real_council_qa.py --limit 20 --evidence-limit 24 --continue-on-error --resume
Set-Location app
npm run qa:real-council:verify
npm run qa:manual-gates:verify
npm run qa:content-review:verify
npm run qa:public-release:verify
npm run release:install-smoke
```

Only after all commands pass should the exact hashed package be attached to a
public GitHub Release.
