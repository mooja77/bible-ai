# Bible AI launch operations, telemetry, support, and adoption research

Timestamp: 2026-06-11 23:35:06 +01:00

Filename timestamp: 2026-06-11-233506

Related reports:

- `docs/reviews/2026-06-11-230419-app-market-tech-research.md`
- `docs/reviews/2026-06-11-231437-app-expanded-research-addendum.md`
- `docs/reviews/2026-06-11-232124-app-workflow-ecosystem-research.md`
- `docs/reviews/2026-06-11-233012-app-global-ai-governance-research.md`

Scope: fifth external research loop. This pass focuses on launch operations: beta distribution, signed releases, update channels, support workflows, privacy-preserving telemetry choices, accessibility validation, and community feedback. The goal is to turn the accumulated research into an operating model.

## Executive update

The current app is already positioned around local data, user-owned provider credentials, manual release gates, source transparency, and no hidden telemetry. That is a strong product posture, but launch will stress it.

New conclusion:

> Bible AI should launch with explicit support and feedback workflows before adding telemetry. Keep the app private by default; collect diagnostics only through user-initiated support bundles and opt-in beta channels.

The app should not silently add analytics, crash uploads, or session replay. Those tools may be useful later, but they conflict with the trust story unless they are opt-in, redacted, and documented. For v0.1, manual support artifacts are more consistent with the product's privacy claims.

## Recursive loop log

### Loop 0 - Existing state

Local docs already include release scripts, manual QA gate collection, public release verification, privacy notes, macOS release plans, and no-telemetry error boundary comments. Prior research added source provenance, provider data handling, AI governance, study packets, and release trust.

Gap found: the app has strong build QA, but no explicit beta/support operating model.

Self-improvement: add "support without surveillance" as a product principle.

### Loop 1 - Distribution and signing

Research confirmed:

- Tauri updater requires signed updates.
- Tauri Windows docs say code signing is required for Microsoft Store listing and to prevent SmartScreen warnings.
- Microsoft Store package flights can distribute packages to limited tester groups.
- WinGet uses a public community repository with validation/review for manifests.
- GitHub Releases are suitable for binary assets and release notes.
- TestFlight supports macOS beta testing, but macOS distribution still requires Apple build/signing/notarization realities.

Self-improvement: split release channels into private, beta, public unsigned, public signed, and store/winget lanes.

### Loop 2 - Telemetry and crash reporting

Research confirmed:

- Sentry can be used in Tauri via community plugin or separate Rust/browser SDKs, but it is an external telemetry path.
- Sentry's own support says there is no official Tauri v2 SDK on its roadmap, with community options instead.
- PostHog has privacy controls, cookieless options, and self-hosting, but still requires a careful consent/data-minimization decision.
- Plausible is privacy-friendly for websites, not a natural desktop-app event analytics solution.
- BugSnag and similar tools are useful for crash reporting but still collect runtime state that must be disclosed and redacted.

Self-improvement: do not add passive telemetry to v0.1. Build user-initiated diagnostics first.

### Loop 3 - Accessibility and older-user validation

Research confirmed:

- NN/g identifies older adults as facing unique challenges with websites/apps, even as digital literacy improves.
- WCAG 2.2 target-size minimum is 24 by 24 CSS pixels, with focus appearance guidance for visible focus indicators.
- Apple recommends allowing text enlargement and testing large text sizes.
- Microsoft Inclusive Design emphasizes designing for a broad range of human needs from the start.

Self-improvement: release QA should include a large-text/keyboard/contrast pass, not just automated build tests.

### Loop 4 - Community and beta feedback

Research confirmed:

- GitHub Releases and Discussions can support early public feedback without building in-app accounts.
- Microsoft Store package flights and TestFlight are structured beta paths, but they require store infrastructure.
- GitHub Discussions can organize questions, bug reports, ideas, and polls, but public forums need templates and moderation rules.

Self-improvement: start with GitHub Releases plus Discussions or a simple issue template before store-based beta distribution.

## Launch channel model

| Channel | Use | Requirements | Recommendation |
|---|---|---|---|
| Local/private build | Developer and trusted-user testing | Existing release scripts and clear "private/test build" label | Keep now. |
| GitHub prerelease | Small public-ish beta with binary assets and notes | Release artifacts, hashes, manual QA evidence, known-issues notes | Best first external beta channel. |
| Direct signed website download | Public Windows distribution | Code signing, release manifests, checksums, privacy docs, support path | Use only after manual QA gate and signing are settled. |
| WinGet | Windows power-user distribution | Stable installer URL, manifest, versioning, checksums, public repo review | Later, after signed public builds. |
| Microsoft Store | Broad Windows audience | MSIX/store packaging, signing, app identity, store policies, package flights | Later; useful for trust/discovery, but not first. |
| TestFlight macOS | macOS beta | macOS build host, Apple developer account, signing/notarization workflow | Later after macOS release lane is real. |
| Tauri signed updater | In-app update delivery | Signed update artifacts and update endpoint | Later; do not add before release channels are trustworthy. |

## Support without surveillance

### Recommended v0.1 support model

1. No passive telemetry by default.
2. No session replay.
3. No automatic crash uploads.
4. Add a user-initiated "Create support bundle" command later.
5. Add GitHub/website support templates.
6. Ask users to attach the bundle manually when they choose.

Support bundle should include:

- app version
- OS and architecture
- Tauri app identifier
- release channel
- release manifest hash
- corpus version/hash
- user DB schema version
- provider manifest without secrets
- provider diagnostics statuses without tokens
- last failed command name and error category
- redacted sidecar log excerpt if present
- no Bible study content by default
- optional include-current-session toggle with explicit warning

The bundle should never include:

- provider keys
- managed gateway tokens
- local filesystem paths unless explicitly allowed and redacted
- user notes/studies by default
- raw Council prompts by default
- raw retrieved evidence from user-imported resources by default

### Crash reporting decision

Do not add Sentry/BugSnag for public v0.1 unless:

- it is opt-in
- the app has a privacy notice explaining exactly what is sent
- events are redacted at the boundary
- source maps and Rust symbols are managed securely
- support can reproduce what is reported
- user can disable/delete reporting

If added later, prefer a "beta diagnostics mode" rather than default production telemetry.

### Analytics decision

Do not add PostHog or in-app analytics for v0.1. The product's first learning loop should be:

- beta interviews
- support bundles
- GitHub Discussions
- manual usability sessions
- opt-in survey links
- release download counts from hosting platform

If product analytics are added later, collect only coarse, opt-in events:

- first launch complete
- provider setup path chosen
- provider test success/failure category
- first Council run success/failure category
- export generated
- backup/restore completed

No content, no prompts, no passage text, no resource text, no provider key metadata.

## Beta validation plan

### Beta cohorts

Recruit 10-20 users across:

- serious lay readers
- small-group leaders
- pastors/teachers
- older or low-vision Bible readers
- privacy/offline-first users
- open Bible software users
- seminary/student users if available

### Beta tasks

Each tester should complete:

1. Install from release package.
2. Open Reader and search offline.
3. Change text size and theme.
4. Create a workspace.
5. Add a passage and note.
6. Run or attempt provider setup.
7. Run a Council question if configured.
8. Save result to workspace.
9. Export Markdown/PDF.
10. Create backup.
11. Restore backup on a test profile if possible.
12. Create support bundle after one intentional failed provider test.

### Success metrics without telemetry

Track manually:

- install success rate
- time to first offline value
- provider setup success rate
- first Council success rate
- number of support-bundle requests
- export success rate
- backup/restore success rate
- top 10 confusion points
- top 10 terms users do not understand
- top 10 accessibility issues

This is enough for v0.1 and avoids hidden surveillance.

## Accessibility release gate

The repo already contains strong accessibility/UX planning. Make it release-operational:

Manual pass:

- 100%, 125%, 150%, 200% app text scale.
- Reader large text with Greek/Hebrew.
- Keyboard-only navigation through Reader, Search, Council, Workspaces, Theology, Settings.
- Visible focus ring check.
- Touch target scan for dense toolbars.
- Light and dark contrast scan.
- Reduced-motion behavior.
- Screen-reader smoke for primary landmarks and dialogs.
- Older-user session with first-run setup.

Automated additions:

- Add axe-core or equivalent browser accessibility scan for stable screens.
- Add contrast regression for theme tokens and common text classes.
- Add E2E assertions for focus trap/return on dialogs and command palette.
- Add large-text screenshot or layout check for critical panels.

## Community feedback operating model

### Public feedback surfaces

Start with:

- GitHub Releases for binaries, checksums, release notes, known issues.
- GitHub Discussions for Q&A, ideas, and beta feedback.
- GitHub Issues only for actionable bugs with templates.
- A privacy-support page explaining support bundles.

Avoid at first:

- Discord as the primary support system.
- In-app accounts.
- Anonymous in-app feedback forms.
- Public telemetry dashboards.
- Store reviews as the main bug channel.

### Templates to add

- Bug report:
  - app version
  - release channel
  - OS
  - install method
  - expected behavior
  - actual behavior
  - support bundle attached?
  - contains private study content? yes/no

- Provider setup issue:
  - provider path
  - test result category
  - local/remote
  - gateway yes/no
  - no keys pasted

- Source/resource issue:
  - source slug
  - license concern
  - attribution concern
  - import path

- Council quality issue:
  - question category
  - source set
  - provider count
  - problem type: hallucination, missing evidence, hidden disagreement, overconfidence, bad citation, weak retrieval
  - optional redacted export

## Tool recommendations

| Need | Tool/path | Decision |
|---|---|---|
| Release assets | GitHub Releases | Use for first beta. |
| Checksums/manifests | Existing scripts plus tree hashes | Strengthen before public beta. |
| Auto-updates | Tauri updater | Defer until signed releases and update endpoint exist. |
| Windows trust | Code signing | Required before broad public download. |
| Windows package manager | WinGet | Later, after stable signed installer URL. |
| Windows Store beta | Package flights | Later, if Store distribution is chosen. |
| macOS beta | TestFlight or signed DMG | Later, after macOS lane is built on macOS. |
| Crash reporting | Sentry/BugSnag | Defer; opt-in beta diagnostics only if needed. |
| Product analytics | PostHog/Plausible | Defer; manual beta metrics first. |
| Accessibility automation | axe-core plus E2E checks | Add before public release. |
| Community feedback | GitHub Discussions + issue templates | Use for beta. |
| User diagnostics | User-initiated support bundle | Build before telemetry. |

## Consolidated operational roadmap

### Phase 0 - Keep private builds honest

- Label builds clearly as private/test until manual clean-profile gate passes.
- Keep `qa:public-release:verify` as the public-release source of truth.
- Add a known-issues template to release summary.

### Phase 1 - Beta-ready release package

- Complete clean-profile manual QA evidence.
- Add tree hashes.
- Add SBOM/third-party notices.
- Add support bundle design doc.
- Add issue/discussion templates.
- Add accessibility manual gate.
- Publish a GitHub prerelease only if artifacts and gates are clear.

### Phase 2 - Feedback without telemetry

- Run 10-20 tester cohort.
- Collect support bundles manually.
- Track beta metrics in a spreadsheet or markdown log.
- Convert recurring issues into fixtures/E2E tests.
- Update onboarding and provider setup from observed failures.

### Phase 3 - Signed public Windows build

- Add Windows code signing.
- Add public checksums and manifest.
- Publish release notes, privacy, provider data handling, and source provenance docs.
- Consider WinGet after first stable signed release.

### Phase 4 - Optional diagnostics

- Add opt-in beta diagnostics mode only if manual support is insufficient.
- Start with crash/error reports, not broad analytics.
- Keep event schema reviewed and documented.

### Phase 5 - Broader distribution

- Tauri updater after signing/update endpoint.
- Microsoft Store/package flights if the support burden justifies it.
- macOS TestFlight/signed DMG after macOS build lane is verified.

## Documentation plan after this loop

Add these docs to the previous recommended set:

- `docs/beta-release-operations.md`
  - release channels, tester cohorts, beta tasks, manual metrics, known-issues handling.

- `docs/support-bundle-spec.md`
  - exact fields, redaction rules, opt-in content toggles, storage path, verification tests.

- `docs/telemetry-policy.md`
  - no passive telemetry by default, criteria for opt-in diagnostics, forbidden data types.

- `docs/accessibility-release-gate.md`
  - manual and automated checks, text scale, keyboard, focus, contrast, reduced motion.

- `docs/community-feedback-templates.md`
  - bug report, provider setup, source issue, Council quality issue, beta feedback.

Recommended order now:

1. `docs/source-provenance-policy.md`
2. `docs/provider-data-handling-matrix.md`
3. `docs/ai-governance-and-claims-policy.md`
4. `docs/beta-release-operations.md`
5. `docs/support-bundle-spec.md`
6. `docs/telemetry-policy.md`
7. `docs/accessibility-release-gate.md`
8. `docs/source-set-workflows.md`
9. `docs/study-packet-format.md`
10. `docs/council-evaluation-plan.md`
11. `docs/release-security-checklist.md`
12. `docs/local-model-strategy.md`
13. `docs/global-scripture-data-strategy.md`
14. `docs/product-positioning.md`
15. `docs/competitive-landscape.md`

Reasoning: beta operations and support bundles are needed before external users can produce useful feedback without compromising the privacy posture.

## Key risks newly emphasized

| Risk | Severity | Mitigation |
|---|---:|---|
| Beta feedback pressure leads to hidden telemetry | High | Adopt support bundles and manual beta metrics first. |
| Unsigned Windows builds scare nontechnical users | High | Keep private/test labels until signing path is ready. |
| Crash reports leak study content or provider data | High | No automatic crash uploads; redacted opt-in bundles only. |
| Accessibility remains aspirational | High | Add release gate with text-scale, keyboard, focus, contrast, and older-user checks. |
| GitHub-only support excludes less technical users | Medium | Provide plain-language support docs and exportable support bundle, then decide if email/form support is needed. |
| Auto-updater ships before trust infrastructure | Medium | Defer updater until signed release artifacts and endpoint are stable. |
| Store distribution adds process before product fit | Medium | Start with GitHub prerelease and direct testers. |

## Sources from this loop

- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri Windows code signing: https://v2.tauri.app/distribute/sign/windows/
- Microsoft MSIX signing: https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview
- WinGet package manager docs: https://learn.microsoft.com/en-us/windows/package-manager/
- WinGet manifest submission: https://learn.microsoft.com/en-us/windows/package-manager/package/repository
- Microsoft Store package flights: https://learn.microsoft.com/en-us/windows/apps/publish/package-flights
- Microsoft beta testing and targeted distribution: https://learn.microsoft.com/en-us/windows/apps/publish/beta-testing-and-targeted-distribution
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
- GitHub Discussions: https://docs.github.com/discussions
- TestFlight: https://developer.apple.com/testflight/
- Sentry Tauri community plugin: https://github.com/timfish/sentry-tauri
- Sentry Tauri support note: https://sentry.zendesk.com/hc/en-us/articles/28526715924251-Does-Sentry-have-a-Tauri-v2-SDK
- PostHog privacy controls: https://posthog.com/docs/product-analytics/privacy
- PostHog GDPR docs: https://posthog.com/docs/privacy/gdpr-compliance
- Plausible analytics: https://plausible.io/
- Plausible self-hosted analytics: https://plausible.io/self-hosted-web-analytics
- BugSnag macOS docs: https://docs.bugsnag.com/platforms/macos/
- WCAG 2.2 target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2 focus appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- NN/g older adults usability: https://www.nngroup.com/articles/usability-for-senior-citizens/
- Apple accessibility HIG: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple larger text criteria: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria/
- Microsoft Inclusive Design: https://inclusive.microsoft.design/
- Fluent accessibility: https://fluent2.microsoft.design/accessibility
