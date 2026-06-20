# Bible AI operating model, distribution, pricing, and beta measurement research

- Generated: 2026-06-12 00:14:12 +01:00
- Filename timestamp: 2026-06-12-001412
- Scope: additional recursive research pass after the persona/workflow decision index.
- Focus: distribution, pricing, adjacent tools, beta operations, privacy-preserving measurement, and the next planning layer.

## Executive update

The app no longer needs broad feature discovery as much as it needs a concrete operating model. Prior review passes already show a capable local-first Tauri desktop app with bundled corpus data, user-owned AI credentials, Council transparency, export/backup flows, and release-gate documentation. The unresolved question is how to put it in front of real users without weakening the privacy and trust posture.

The strongest current path is:

1. Run a private Windows beta using clearly labeled private/test installers or source-run setup.
2. Measure success through user-initiated feedback, interviews, issue forms, and manual support bundles.
3. Avoid passive telemetry in the beta.
4. Delay monetization until the product proves repeatable study workflows.
5. Keep the first paid or funded surface, if any, attached to distribution/support/licensed content/hosted convenience, not to resale of public-domain Bible text or opaque AI chat.

## Recursive pass log

### Pass 1 - Repo gap review

The existing docs already cover public-release caution. `docs/install-windows.md` says installer packaging exists but generated installers remain private/test builds until clean-profile QA passes. `docs/manual-release-qa-report.md` says automated release verification exists, while public release remains blocked by clean-profile installer and credential-vault checks. `docs/privacy-and-distribution.md` establishes the local privacy story.

The remaining gap is operational: who is the first beta for, where do they download it, what do they report, what is collected, what is intentionally not collected, and how the project decides whether the beta worked.

### Pass 2 - Bible software distribution and pricing

The mature Bible software market is split across paid subscriptions, paid library/package stores, app-store purchases, and free/donation-supported desktop software.

- Logos currently presents subscription tiers and paid access to study tools/libraries. This validates that pastors and serious study users will pay for workflow depth, but it also creates a high expectation for polish, libraries, and trust.
- Accordance sells collections and upgrades through a store model. This reinforces that theological software buyers are accustomed to paying for durable libraries and specialized packages.
- Olive Tree emphasizes app availability across mobile/desktop plus purchased resources and in-app purchases. This is a useful benchmark for cross-device expectations, but Bible AI is currently a desktop-first local app.
- e-Sword remains a strong free/donation-supported comparison point for Windows Bible study. This matters because Bible AI's first Windows beta will be compared to free tools even if the AI layer is novel.

Decision implication: Bible AI should not launch by trying to copy a Logos-style subscription. It does not yet have the licensed library depth, support organization, or release maturity for that. The first public positioning should be local-first AI-assisted study with transparent sources and user-owned model access.

### Pass 3 - Adjacent AI research and knowledge-work tools

The closest workflow comparables are not only Bible apps. They include local notes, research libraries, source-grounded AI notebooks, and highlight managers.

- Obsidian's local Markdown vault model is a strong export benchmark. Bible AI Study Packet exports should be plain Markdown, readable outside the app, and friendly to folder-based note systems.
- Zotero is a benchmark for citation/provenance discipline. Bible AI should keep generated study outputs tied to source metadata, verse ranges, translation/module identifiers, and external source URLs when used.
- NotebookLM is a benchmark for source-grounded AI interaction. Bible AI should treat every summary, synthesis, and research packet as a source-bounded output, not a general chatbot transcript.
- Readwise/Reader is a benchmark for reading memory. Bible AI's highlights, notes, study prompts, and exports should preserve user-owned reading history instead of trapping it in the app.

Decision implication: the moat is not "chat with the Bible." The defensible workflow is "produce a source-grounded, exportable study artifact from a local library and user-owned AI providers."

### Pass 4 - Privacy-preserving beta operations

The app's trust posture argues against passive telemetry in the private beta. GitHub Discussions, discussion forms, issue forms, and manual feedback templates can capture the evidence needed without installing tracking.

Crash/error tooling such as Sentry and product analytics such as Plausible may be useful later, but both should be treated as explicit product decisions, not default beta plumbing. If ever added, they should be opt-in, documented, redacted, and disabled by default for local study data. For now, the cleaner path is manual feedback and user-triggered support bundles.

Decision implication: beta measurement should be slower but more trustworthy. The product category deals with private devotional notes, doctrinal questions, provider keys, and potentially sensitive research. That makes consent and local control more important than aggregate event counts.

### Pass 5 - Operating synthesis

The next plan should move from "can the app work?" to "can a target user complete one meaningful study workflow without hand-holding?"

Primary beta success metric:

> At least 3 of 5 target beta users can install or run the app, connect at least one provider or use a documented no-AI path, complete one Smart Research or Council-backed study flow, and export a useful Study Packet without live support.

This metric is intentionally small and concrete. It tests installation, setup, workflow comprehension, AI/provider integration, local data trust, and export value in one pass.

## Distribution decision matrix

| Channel | Timing | Fit | Conditions |
| --- | --- | --- | --- |
| Run from source | Now | Best for developer/contributor review | Keep docs accurate; expects Node/Rust comfort. |
| Private/test Windows installer | Now/next | Best for first non-developer beta | Must be clearly labeled private/test; run clean-profile QA before sharing beyond trusted testers. |
| GitHub Releases public installer | Later | Best first public distribution if repo is public or release artifacts can be public | Requires release notes, checksums, clean-profile QA evidence, installer uninstall/reinstall checks, and credential-vault validation. |
| WinGet | Later | Good for Windows power users after a stable public release | Requires stable public download URLs and package manifests. |
| Microsoft Store | Defer | Broad Windows distribution and update channel | Higher policy, packaging, identity, support, and commercial overhead. |
| macOS DMG | Defer | Useful only after macOS build/sign/notarization path is real | Needs macOS host or CI, Keychain checks, signing/notarization, and Gatekeeper verification. |

Recommended next distribution step: private/test Windows installer with a beta feedback kit. Do not promote it as a public release until the existing clean-profile gate passes.

## Pricing and funding decision matrix

| Model | Timing | Assessment |
| --- | --- | --- |
| Free private beta | Now | Correct default. Reduces trust friction and maximizes learning. |
| Donations/GitHub Sponsors | Later if public/community-led | Low friction, but should not be the core product model unless the app becomes open-source/community-maintained. |
| Paid signed builds/support | Later | Plausible if users value easy installation, updates, and support while source remains available or data stays local. |
| Paid licensed resource packs | Later | Good fit for Bible software norms, but requires licensing, provenance, and resource review infrastructure. |
| Managed AI gateway subscription | Much later | Could simplify setup, but introduces server-side trust, billing, privacy, subprocessor, abuse, and cost-control obligations. |
| Ads, data resale, passive tracking | Never | Misaligned with the app's religious study and local-first trust posture. |

Recommended next pricing decision: no pricing during private beta. Treat the beta as proof of workflow value. If public release happens, decide between free/donation-supported and paid signed-build/support before adding any hosted AI service.

## Adjacent-tool interoperability targets

### Obsidian-friendly Study Packet export

Study Packet exports should work as plain Markdown without custom rendering. Recommended structure:

- One folder per exported packet.
- `README.md` or `study-packet.md` as the main entry.
- Frontmatter with date, app version, source set, translation/module IDs, AI providers used, and user-entered topic/range.
- Stable headings for passage, observations, source trail, Council synthesis, questions, notes, and next actions.
- Relative links to any exported source snippets or JSON audit data.

### Zotero-style source discipline

Bible AI does not need a full Zotero integration now, but it should borrow the habit:

- Preserve source URLs and license metadata where external sources are used.
- Preserve verse/module identifiers for bundled sources.
- Separate user notes from generated synthesis.
- Make citation/provenance exportable.

### NotebookLM-style source grounding

NotebookLM reinforces the value of asking questions against a defined source set. Bible AI should keep that boundary visible:

- Every AI synthesis should state which sources were in scope.
- The UI should distinguish "from retrieved sources" from "model reasoning."
- Export should include enough source trail for the user to audit the output later.

### Readwise-style reading memory

Highlights and notes are not secondary. They are the user's long-term study memory. This supports:

- durable local note/highlight data,
- backup/restore confidence,
- Markdown export,
- no forced account,
- clear separation of private notes from any optional support bundle.

## Privacy-preserving beta measurement plan

### Primary metric

3 of 5 target users complete one useful Study Packet without live support.

### Secondary metrics

- Setup success: can install/run and reach first usable screen.
- Provider success: can add/test at least one user-owned provider, or understand no-AI limitations.
- Workflow success: can start Smart Research or a Council-backed question.
- Trust success: can explain where data and keys are stored after reading the setup/privacy copy.
- Export success: can find and use the exported Study Packet.
- Support success: if blocked, can produce a redacted support packet or issue form without exposing secrets.

### Data intentionally not collected in private beta

- No passive telemetry.
- No automatic note, prompt, or passage upload.
- No automatic provider-key collection.
- No full raw database collection.
- No silent crash reporting.
- No analytics identifiers.

### User-initiated feedback packet

Use a manual feedback template with:

- App version/build hash.
- OS version.
- Install path: source run, private installer, other.
- First-run result.
- Provider configured: none, OpenAI, Gemini, Anthropic, Claude Code, other.
- Workflow attempted.
- Expected result.
- Actual result.
- Screenshot optional.
- Redacted logs optional.
- Support bundle optional.
- Confirmation checkbox: "I reviewed this feedback and removed secrets/private notes I do not want to share."

## Updated operating roadmap

### Phase 0 - Decision index and operating model

Status: this report completes the first operating-model pass.

Outputs:

- Persona/workflow decision index already exists.
- This distribution/pricing/measurement addendum now exists.

### Phase 1 - Private beta package and feedback kit

Recommended docs/files:

- `docs/beta-operating-model.md`
- `docs/beta-feedback-kit.md`
- `docs/support-bundle-policy.md`
- update `docs/install-windows.md` with a private-beta installer section
- update `docs/privacy-and-distribution.md` with explicit no-passive-telemetry and user-initiated support-bundle language

Implementation work:

- Produce a private/test Windows installer only after clean-profile QA.
- Add a build/version display that testers can copy.
- Add or document a "copy diagnostics" action that excludes secrets and user notes by default.

### Phase 2 - Smart Research and Study Packet beta workflow

Recommended product shape:

- One clear entry point for a passage/topic.
- Visible source set before generation.
- Generated synthesis with source trail.
- Export to Markdown packet.
- A short "was this useful?" manual prompt that links to the feedback template, not telemetry.

### Phase 3 - Safety, evaluation, and release gates

Gate before public release:

- clean-profile Windows install/uninstall/reinstall passes,
- credential storage checks pass,
- provider-key redaction checks pass,
- no mock AI in release verification,
- Study Packet export works from a clean profile,
- backup/restore sanity check passes,
- privacy docs match actual behavior.

### Phase 4 - Public GitHub release

Only after the public gate:

- tag a release,
- attach installer artifacts,
- include checksums,
- include release notes,
- document known limitations,
- link privacy/distribution docs,
- state whether the release is free, donation-supported, or paid-support adjacent.

### Phase 5 - Optional broader distribution and funding

After real beta evidence:

- WinGet if Windows users are installing from GitHub successfully.
- Microsoft Store only if support capacity and packaging overhead are justified.
- macOS only after a verified Mac build/sign/notarization path.
- Paid support/signed builds/resource packs only after legal/licensing and user-value questions are resolved.

## Open decisions for the owner

1. Is the intended public posture open-source, source-available, or private binary distribution?
2. Should the first beta be 5 trusted testers, a small church/seminary cohort, or a public waitlist?
3. Is GitHub the right feedback channel, or should feedback avoid requiring GitHub accounts?
4. Should the support bundle be an app feature, a manual docs procedure, or both?
5. Which export format is the priority: Markdown folder, single Markdown file, PDF, DOCX, or all later?
6. Should the app ever offer a managed AI gateway, or remain permanently user-owned-key only?

## Documentation backlog created by this pass

High priority:

- `docs/beta-operating-model.md` - owner-facing operating rules for private beta.
- `docs/beta-feedback-kit.md` - tester instructions, feedback template, and interview script.
- `docs/support-bundle-policy.md` - what diagnostics may include, what must be excluded, and how users review before sharing.

Medium priority:

- `docs/pricing-and-funding-decision.md` - explicit choice to delay monetization plus allowed/disallowed future models.
- `docs/obsidian-export-profile.md` - Markdown packet conventions for local note tools.
- `docs/public-release-checklist.md` - one merged checklist from existing Windows/macOS/manual QA docs.

Low priority:

- `docs/partnerships-and-content-licensing.md` - future licensing/resource-pack path.
- `docs/market-positioning.md` - one-page positioning against Logos, Accordance, Olive Tree, e-Sword, Obsidian, Zotero, NotebookLM, and Readwise.

## Source links used in this pass

- Logos subscriptions/pricing: https://www.logos.com/configure/subscriptions
- Accordance shop and purchase options: https://www.accordancebible.com/shop/ and https://www.accordancebible.com/purchase-options/
- Olive Tree official app/store information: https://www.olivetree.com/ and https://help.olivetree.com/hc/en-us/articles/360027196871-In-App-Purchases
- e-Sword official downloads/free positioning: https://www.e-sword.net/downloads.html and https://www.e-sword.net/
- Obsidian data storage/local Markdown vaults: https://obsidian.md/help/data-storage
- Zotero official site and sync docs: https://www.zotero.org/ and https://www.zotero.org/support/sync
- NotebookLM official site and Audio Overview help: https://notebooklm.google/ and https://support.google.com/notebooklm/answer/16212820
- Readwise and Reader: https://readwise.io/ and https://readwise.io/read
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- GitHub Discussions and discussion forms: https://docs.github.com/discussions and https://docs.github.com/en/discussions/managing-discussions-for-your-community/creating-discussion-category-forms
- GitHub issue forms: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
- Tauri Windows installer docs: https://v2.tauri.app/distribute/windows-installer/
- Windows Package Manager and manifests: https://learn.microsoft.com/en-us/windows/package-manager/winget/ and https://learn.microsoft.com/en-us/windows/package-manager/package/manifest
- Sentry data scrubbing: https://docs.sentry.io/security-legal-pii/scrubbing/
- Plausible privacy-friendly analytics and data policy: https://plausible.io/docs/ and https://plausible.io/data-policy

