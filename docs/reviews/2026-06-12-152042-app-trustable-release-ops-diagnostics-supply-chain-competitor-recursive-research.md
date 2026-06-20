# Bible AI trustable release operations, diagnostics, supply chain, and competitor trust research

Generated: 2026-06-12 15:20:42 +01:00
Filename timestamp: 2026-06-12-152042
Scope: recursive research pass extending the app review trail with release trust, support diagnostics, privacy-safe observability, supply-chain gates, and competitor trust signals.

## Executive update

Bible AI already has a serious local release discipline: release manifests, manual release gates, public release verification, macOS release scripts, real Council QA hooks, restrictive production CSP, and a minimal Tauri capability file. The next gap is not more feature work. The next gap is trustable public distribution: a normal tester must be able to install the app, understand what data leaves the machine, send useful diagnostics without leaking private study content, verify release artifacts, and receive updates through a deliberately controlled channel.

The strongest conclusion from this loop is that v0.1 should keep the existing privacy stance: no passive telemetry or default crash upload. Competitors increasingly expose privacy controls, support routes, AI provenance language, offline claims, and data ownership/export claims as part of the product surface. Bible AI can compete credibly only if release operations make those claims operational.

## What changed from the previous research trail

This pass tightens the previous "privacy-first beta" recommendation into a concrete release-ops plan:

- Treat release trust as a P0 product requirement, not a launch afterthought.
- Defer in-app auto-update until signing, release-channel policy, rollback handling, key custody, and support workflows are written and tested.
- Add a user-initiated support bundle contract before adding Sentry, PostHog, Plausible, or any app event telemetry.
- Add supply-chain gates for JavaScript, Rust, lockfiles, licenses, SBOMs, release artifact hashes, and dependency updates.
- Add competitor-derived trust requirements: visible privacy settings, source/citation visibility for AI answers, support entry points, offline/local claims only where true, and user data export.

## Local app state observed in this pass

Evidence gathered from the repo:

- `app/package.json` has a broad `check` script that builds frontend, runs Rust format/check/test/clippy, validates sidecar files, checks resource import scripts, verifies release scripts, and runs sidecar tests.
- `app/package.json` has release scripts for manifest creation, manifest verification, summary creation, release package verification, archive verification, install smoke tests, macOS release checks, manual release gates, and public release verification.
- `app/src-tauri/tauri.conf.json` is Tauri v2, `productName` is `Bible AI`, version is `0.1.0`, and production CSP is restrictive.
- `app/src-tauri/tauri.conf.json` bundles `data/corpus.sqlite`, sidecar modules, provider code, sidecar package files, Node, and sidecar `node_modules`.
- `app/src-tauri/tauri.conf.json` does not show a Tauri updater configuration.
- `app/src-tauri/capabilities/default.json` grants only `core:default` and `dialog:allow-save`, which is a good low-authority baseline.
- `.github/workflows` is currently empty.
- `npm audit --json` in `app` reported zero vulnerabilities at the time of this pass.
- `npm audit --json` in `app/sidecar` reported zero vulnerabilities at the time of this pass.
- `cargo audit` was not installed in the current environment.
- `cargo deny` was not installed in the current environment.
- No obvious support bundle script or diagnostics export verification script was found in `app/scripts`.
- No obvious SBOM/security aggregate script was found in `app/scripts`.

Current interpretation: release scripts are locally mature, but public trust gates are still missing CI, security automation, signing evidence, SBOM/license evidence, and support-bundle redaction verification.

## Pass 1: release channel and updater research

Tauri updater research changed the sequencing decision. The updater is attractive, but it raises the operational bar immediately. Tauri's updater requires signed update artifacts and says update signature verification cannot be disabled. It requires public-key configuration in `tauri.conf.json`, private-key custody during builds, update artifacts, signatures, and a static or dynamic update endpoint.

Decision: do not ship in-app updates in v0.1 closed beta unless the app already has all of the following:

- A written release-channel policy.
- A signing-key custody policy.
- A reproducible update manifest generation process.
- A rollback and bad-release response runbook.
- A user-visible update channel label in diagnostics.
- Release notes and artifact hashes attached to every public build.
- Support workflow that can identify app version, channel, release manifest hash, corpus hash, and DB schema version.

Recommended channel ladder:

| Stage | Distribution | Update model | Gate |
| --- | --- | --- | --- |
| Local dev | Local Tauri build | Manual rebuild | `npm run check:full` |
| Private tester | GitHub prerelease artifact | Manual download | public release gate plus clean-profile QA |
| Closed beta | Signed GitHub prerelease | Manual download | signing evidence plus support bundle |
| Public download | Signed website/GitHub release | Manual or updater-later | SBOM, release hash, privacy docs |
| Auto update | Tauri updater | Signed updater artifacts | rollback/runbook/support proven |
| Store | Microsoft Store, macOS App Store later | Store managed | content, support, policy review |

## Pass 2: signing and platform trust

Windows and macOS trust are not the same problem.

Windows:

- Microsoft Store MSIX is the lowest-friction public trust path when viable because Store distribution handles signing differently from direct EXE/MSI downloads.
- For non-Store distribution, Microsoft documents Azure Artifact Signing as its recommended service for many Windows developers, but SmartScreen reputation still builds over time. A signed app can still show first-download prompts.
- Tauri's Windows signing docs treat signing as required for Microsoft Store listing and important for SmartScreen trust.
- If the user base starts with private testers, signed GitHub prerelease artifacts are acceptable only if the support docs plainly explain expected OS prompts.

macOS:

- Tauri documents macOS code signing as needed to avoid browser-download launch warnings.
- Distribution outside the Mac App Store needs notarization for a normal user trust path.
- macOS signing needs an Apple Developer account and a Mac-based signing/notarization path.

Practical release decision: first public Windows goal should be "signed installer with known expected SmartScreen behavior," not "no prompt ever." First public macOS goal should be "signed and notarized DMG/app" before non-technical beta testers.

## Pass 3: diagnostics, crash reporting, and analytics

The app's domain makes passive telemetry unusually risky. A Bible study app can contain religious practice, pastoral questions, private notes, AI prompts, and theological concerns. Even "usage" and "search" data may become sensitive.

Decision: the first diagnostic system should be a user-initiated support bundle, not passive telemetry.

Support bundle contract for v0.1 should include:

- App version.
- Release channel.
- OS name/version/architecture.
- Tauri version if available.
- Sidecar version/hash.
- Release manifest hash.
- Corpus hash.
- DB schema version.
- Provider mode summary without tokens.
- Enabled provider names only if the user opts in to include them.
- Last startup status.
- Last sidecar health category.
- Recent error categories.
- Redacted log excerpt.
- Manual note field controlled by the user.

Support bundle contract must exclude by default:

- Provider API keys.
- Gateway tokens.
- Private study notes.
- Raw prompts.
- Raw AI completions.
- Raw evidence passages beyond public Bible references.
- Local absolute paths.
- Environment variables.
- Machine identifiers.
- Full chat/session transcripts.
- Email address unless user explicitly enters it.

Sentry and analytics position:

- Sentry should be treated as an integration candidate, not an official Tauri drop-in. Public search surfaced a Sentry support result indicating no official Tauri v2 SDK; a community Tauri v2 plugin exists, and official Sentry sensitive-data guidance still matters if any Sentry path is tested.
- PostHog provides privacy controls and EU-hosted options, but it still requires the app owner to decide what is collected and get consent where needed.
- Plausible is a stronger fit for aggregate public website analytics than desktop app event analytics.
- If diagnostics are added later, make them opt-in beta diagnostics with a visible switch, a data preview, and a "send now" action.

## Pass 4: supply-chain and security tooling

The current JavaScript audit result is clean, but that is not enough for public trust.

Recommended P0 security gates:

- `npm audit --audit-level=moderate` in `app`.
- `npm audit --audit-level=moderate` in `app/sidecar`.
- `cargo audit` for Rust advisory checks.
- `cargo deny` for Rust advisories, duplicate/banned crates, source checks, and license policy.
- OSV-Scanner for lockfile and multi-ecosystem vulnerability coverage.
- SBOM generation for npm and Rust dependencies.
- Dependabot configuration for npm, GitHub Actions, and Cargo.
- GitHub Actions CI for check/build/security gates.
- Release manifest fields for SBOM hash, dependency lockfile hashes, signer identity, notarization status, and update channel.

Recommended P1 security gates:

- CodeQL workflow for JavaScript/TypeScript and any supported repo languages.
- Dependency review action on pull requests.
- Secret scanning policy if the repository is hosted on GitHub with eligible security features.
- SLSA-style provenance or at least a local build provenance JSON that names builder, source revision, timestamps, lockfile hashes, and artifact digests.

Why this matters for Bible AI specifically:

- The app ships a sidecar and `node_modules`, so package integrity is part of user trust.
- The app ships a corpus database, so corpus hash and content BOM belong in release evidence.
- The app relies on a Rust desktop shell, frontend dependencies, sidecar dependencies, and provider integrations. One scanner will not cover that full surface.

## Pass 5: competitor trust and market signals

Competitor research was intentionally focused on trust surfaces, not general feature counts.

| Product | Observed trust signal | Implication for Bible AI |
| --- | --- | --- |
| YouVersion | Privacy policy emphasizes user choice, no selling of information, free/no ads/no purchases, support articles explaining permissions. | Bible AI needs visible privacy/data movement explanations in-app, not just a repo doc. |
| Logos | AI features are framed around Smart Bible Search, Study Assistant, user library context, exact Bible text lookup, and direct source citations. | Bible AI's Council/source-drawer model should be marketed as evidence-grounded study, not generic chat. |
| Olive Tree | Help docs expose privacy controls and distinguish necessary services, analytics, crash reporting, and personalization. | If Bible AI ever adds diagnostics, use explicit categories and switches. |
| Accordance | Mobile page stresses offline use after setup, downloaded modules, speed, and privacy. | Bible AI can win trust with local corpus/offline study claims, but only if provider calls and online dependencies are transparent. |
| Bible Gateway | 2026 mobile app page emphasizes reading/listening, notes/sync, parallel versions, Plus study resources, and support/privacy links. | General Bible-reader competition is content and habit driven; Bible AI's moat must be deeper workflows and better provenance. |
| Bible Chat | AI Bible chat competitor claims Scripture-trained answers, pastor/theologian guidance, citations, free tier, premium tier, and support contact. | Commodity Bible chat is crowded. Bible AI should avoid vague "talk to the Bible" positioning and instead emphasize inspectable evidence and private/local-first design. |
| Bible AI / bibleai.com | Claims AI Bible search, reading, study plans, and data ownership through notes/bookmark download. | Data export is now table stakes for a trustable Bible AI app. |

Market conclusion: the obvious competitor set splits into four groups:

- Habit and devotional platforms: YouVersion, Bible Gateway.
- Serious study libraries: Logos, Accordance, Olive Tree.
- Free reference/study sites: Blue Letter Bible, STEP Bible, Bible Hub, Sefaria-adjacent text platforms.
- AI chat/search apps: Bible Chat, bible.ai, BibleGPT-style tools, and many mobile AI Bible assistants.

Bible AI's defensible lane is not "another Bible reader" or "another Christian chatbot." The defensible lane is a local-first, evidence-grounded Bible study workstation with inspectable AI reasoning, strong citation hygiene, source quality controls, and privacy-aware release operations.

## Tooling recommendation matrix

| Need | Tool | Recommendation |
| --- | --- | --- |
| Desktop app | Tauri 2 | Keep. Current config is restrained and low-authority. |
| Frontend | React, TypeScript, Vite | Keep. No research signal suggests changing. |
| Sidecar | Node ESM sidecar | Keep for now. Harden packaging and diagnostics. |
| Updates | Tauri updater | Defer until signing, channel, rollback, and support bundle exist. |
| Windows signing | Microsoft Store MSIX or Azure Artifact Signing/OV | Decide by distribution path and eligibility. Do not promise zero SmartScreen prompts. |
| macOS signing | Apple Developer ID plus notarization | Required before broad non-technical macOS beta. |
| Crash reporting | Sentry or community Tauri plugin | Defer. Later use opt-in beta mode and client-side scrubbing. Validate SDK/plugin maturity before adoption. |
| Product analytics | PostHog | Defer for app telemetry. Possible only with explicit consent and strict event schema. |
| Website analytics | Plausible | Reasonable for public website only, not app internals. |
| JS vulnerabilities | npm audit, OSV-Scanner | Add to CI. |
| Rust vulnerabilities | cargo-audit, cargo-deny | Add to CI and docs. |
| License/SBOM | cargo-deny plus CycloneDX/SPDX tools | Add before public release. |
| Dependency updates | Dependabot | Add for npm, Cargo, and GitHub Actions. |
| Static analysis | CodeQL | Add for JS/TS and supported languages. |
| Build provenance | SLSA/in-toto style metadata | Start with release provenance JSON and artifact digests. |

## Decision register

1. Keep v0.1 default telemetry at zero passive app telemetry.
2. Build support bundles before crash reporting.
3. Treat provider prompts, religious questions, notes, and evidence selections as sensitive by default.
4. Defer Tauri updater until signed release operations are real.
5. Use manual GitHub prereleases for private beta first.
6. Add signing evidence and release manifest metadata before public downloads.
7. Add CI before another public-facing release milestone.
8. Add JavaScript, Rust, OSV, license, and SBOM gates before public release.
9. Position Bible AI against AI chat competitors through provenance, source quality, and local-first privacy, not through generic chat language.
10. Treat user data export as a trust requirement, not a nice-to-have.

## P0 implementation plan

Docs to create next:

- `docs/release-channel-policy.md`
- `docs/support-bundle-contract.md`
- `docs/security-supply-chain-gates.md`
- `docs/diagnostics-privacy-policy.md`
- `docs/beta-tester-support-runbook.md`

Scripts to add next:

- `app/scripts/create-support-bundle.mjs`
- `app/scripts/verify-support-bundle-redaction.mjs`
- `app/scripts/verify-security-gates.mjs`
- `app/scripts/create-sbom.mjs` or package-manager native SBOM commands wrapped by a script
- `app/scripts/create-release-provenance.mjs`
- `app/scripts/verify-release-provenance.mjs`

Package scripts to add next:

- `security:npm-audit`
- `security:osv`
- `security:cargo-audit`
- `security:cargo-deny`
- `security:sbom`
- `security:check`
- `support:bundle`
- `support:bundle:verify`
- `release:provenance`
- `release:provenance:verify`

Repository automation to add next:

- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `.github/dependabot.yml`
- Optional later: `.github/workflows/codeql.yml`

Release manifest fields to add next:

- `releaseChannel`
- `sourceRevision`
- `builder`
- `builtAt`
- `signed`
- `signerIdentity`
- `notarized`
- `updaterEligible`
- `artifactDigests`
- `sbomDigest`
- `corpusDigest`
- `contentBomDigest`
- `dependencyLockDigests`
- `supportBundleSchemaVersion`

## P1 implementation plan

- Add in-app "Privacy and data movement" view showing local data, provider calls, optional diagnostics, and export.
- Add in-app "Copy diagnostics summary" button that produces a redacted text summary.
- Add beta tester support form template that tells users exactly what not to paste.
- Add public release notes template with install warnings, expected platform prompts, artifact hashes, and known issues.
- Add release checklist rows for Windows signing, macOS notarization, clean-profile install, support bundle redaction, and security scans.
- Add CodeQL workflow once CI is stable.
- Add dependency review workflow for pull requests once repository hosting supports it.

## P2/P3 deferred work

- Tauri updater with signed static JSON manifest.
- Sentry opt-in beta crash reporting with no prompt/session content.
- PostHog or equivalent opt-in product analytics only after a strict event schema and privacy review.
- Microsoft Store or WinGet distribution.
- macOS App Store or TestFlight path.
- Public status page for release artifacts and known incidents.

## Risks if ignored

- Unsigned installers will create avoidable user trust failures.
- Auto-update without rollback and key custody can turn a bad release into a persistent support incident.
- Passive telemetry can undermine the local-first/privacy message even if technically legal.
- A support process that asks users to paste logs can leak prompts, notes, tokens, paths, or religiously sensitive content.
- A clean npm audit today does not cover Rust advisories, license risk, corpus provenance, bundled sidecar dependencies, or future advisory changes.
- Competitors already use privacy, support, citation, and data ownership language. Bible AI cannot claim those advantages unless they are visible and verifiable.

## Source links used

- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri distribution overview: https://v2.tauri.app/distribute/
- Tauri Windows code signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri macOS code signing: https://v2.tauri.app/distribute/sign/macos/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Microsoft Artifact Signing quickstart: https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart
- Microsoft SmartScreen reputation: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft Windows code signing options: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Sentry sensitive data docs: https://docs.sentry.io/platforms/apple/guides/ios/data-management/sensitive-data/
- Community Tauri Sentry plugin: https://github.com/timfish/sentry-tauri
- PostHog privacy controls: https://posthog.com/docs/privacy
- Plausible data policy: https://plausible.io/data-policy
- npm audit docs: https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/
- cargo-audit: https://github.com/rustsec/rustsec/tree/main/cargo-audit
- cargo-deny: https://embarkstudios.github.io/cargo-deny/
- OSV-Scanner: https://google.github.io/osv-scanner/
- GitHub Dependabot quickstart: https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/dependabot-quickstart
- GitHub CodeQL CLI: https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-cli
- SLSA provenance: https://slsa.dev/spec/v1.0/provenance
- YouVersion privacy policy: https://www.bible.com/privacy
- YouVersion Android permissions support: https://help.youversion.com/l/en/article/m6az6pyjcq-permissions-on-android
- Logos AI overview: https://support.logos.com/hc/en-us/articles/35181728416397-How-Logos-uses-AI
- Logos AI tools: https://support.logos.com/hc/en-us/articles/30128615450765-Using-AI-Tools-for-Smarter-Bible-Study
- Olive Tree privacy controls: https://help.olivetree.com/hc/en-us/articles/360052888272-iPhone-iPad-Privacy-Controls
- Olive Tree help center: https://help.olivetree.com/hc/en-us
- Accordance mobile details: https://www.accordancebible.com/details-of-the-mobile-app/
- Bible Gateway mobile app: https://www.biblegateway.com/app/
- Bible Gateway privacy: https://www.biblegateway.com/legal/privacy/
- Bible Chat product/FAQ: https://thebiblechat.com/
- Bible Chat privacy policy: https://biblechat.org/privacy-policy
- Bible AI product page: https://bibleai.com/
