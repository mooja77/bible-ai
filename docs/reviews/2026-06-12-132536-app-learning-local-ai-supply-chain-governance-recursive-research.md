# Bible AI learning, local AI, supply chain, portability, and governance recursive research

- Generated: 2026-06-12 13:25:36 +01:00
- Filename timestamp: 2026-06-12-132536
- Scope: additional recursive research pass after the community/content/privacy/eval report.
- Method: reread latest reports and core docs, research remaining tool/market/tech areas, and fold each pass back into a revised plan.

## Executive update

The strongest new conclusion from this loop:

> Bible AI should now define "learning value" as active recall, self-explanation, source-grounded judgment, and repeatable export, not as more generated summaries.

The app already has a strong research/workspace direction. The next deeper opportunity is to make that workflow teach users to study better:

- ask them to retrieve and explain before AI answers,
- ask them to record their own judgment after comparing sources,
- create review cards or prompts from Study Packets,
- preserve a durable learning trail outside the app,
- avoid turning Council output into passive consumption.

The strongest technical conclusion is similarly conservative:

> Keep the current local-first stack, but add release provenance and portability discipline before adding sync, auto-update, or more runtime complexity.

This pass promotes five plan changes:

1. Add learning-science acceptance criteria to Study Packet v1.
2. Keep Ollama as the default local runtime; evaluate llama.cpp later only through an adapter.
3. Add SBOM/provenance/signing planning before public trust claims.
4. Keep sync out of scope until export/backup are boring and an end-to-end-encrypted sync design exists.
5. Add open-source/community governance docs before inviting broad contributors or public testers.

## Recursive loop log

### Pass 1 - Remaining unreduced risks

The newest reports already cover competitors, beta recruiting, privacy, content standards, evals, accessibility, and distribution. Reading the roadmap and release docs surfaced five remaining risks:

- Learning features are broad but not tied to proven learning behaviors.
- Local AI runtime choices could sprawl beyond what the desktop app needs.
- Release artifacts already have hashes/manifests, but not an explicit SBOM/provenance maturity path.
- Cloud sync is out of scope, but there is no future-governance line preventing casual sync creep.
- If the repo becomes public-facing, community/security governance is not yet concrete.

Self-improvement:

- Make the next canonical docs practical gates, not essays.
- Tie learning features to beta acceptance tests.
- Treat release integrity and governance as product trust features.

### Pass 2 - Learning science and Bible study workflow

Learning-science sources consistently favor active retrieval, distributed practice, and self-explanation over passive rereading/highlighting. Anki's official docs confirm its spaced repetition model and current FSRS support. W3C cognitive accessibility guidance also reinforces the need to reduce memory burden, make tasks understandable, and support users who process complex information differently.

Product implication:

- Bible AI should not optimize for "AI gives me a polished study" alone.
- The app should make the user retrieve, explain, compare, and conclude.
- Study Packet v1 should include both AI-generated synthesis and user-generated recall/judgment fields.

Recommended learning acceptance criteria for Study Packet v1:

1. The packet begins with a user-stated question or passage.
2. The user can write an initial observation before asking AI.
3. The app surfaces source evidence and dissent.
4. The user records a personal conclusion and confidence.
5. The packet includes "review later" prompts or questions.
6. The export keeps generated synthesis separate from user notes and user judgment.

Recommended learning features to add after Study Packet v1:

- "Before AI" observation prompt.
- "Explain it back" field after reading the answer.
- Review cards generated from a Study Packet, with user approval.
- Optional Anki-compatible export for key terms, passages, and questions.
- Spaced review queue inside the app only after the export workflow is stable.

Do not add yet:

- streaks,
- gamified devotional habit loops,
- quiz generation without source trace,
- AI-authored conclusions that replace user judgment.

### Pass 3 - Church, small-group, and seminary workflow context

Small-group and theological-education signals point in the same direction as prior market reports:

- small groups need structured, discussion-ready Bible study materials;
- church leaders are interested in AI but worried about data privacy, plagiarism, message integrity, and authenticity;
- theological education is actively discussing AI, but with caution around formation, context, and responsible use;
- AI Bible apps are already being scrutinized for theological bias.

Product implication:

- Bible AI's first educational value is not classroom replacement. It is preparation support for a leader or learner.
- The app should produce discussion questions, source notes, and uncertainty notes, but not sermon manuscripts or authoritative pastoral verdicts.
- A seminary or church-adjacent beta should include explicit AI-use boundaries.

Recommended beta task variants:

1. Small-group teacher: prepare a 45-minute discussion from a passage.
2. Serious learner: compare two interpretive positions on a hard text.
3. Original-language beginner: inspect one key word and write cautious observations.
4. Pastor/ministry volunteer: create a source trail for a contested doctrine without using it as a sermon ghostwriter.

Acceptance signal:

- The user says the packet helped them ask better questions, not merely get an answer faster.

### Pass 4 - Local AI runtime and desktop technical options

The current runtime design is still sound:

- Tauri 2 desktop app.
- Rust for local DB/search/export/OS integration.
- Node sidecar for provider orchestration.
- Ollama for local embeddings.
- User-owned cloud providers for larger Council reasoning.
- SQLite FTS5 plus BLOB embeddings and Rust cosine scan.

Additional runtime research:

- Ollama remains the best default local runtime because it is already integrated, has an embeddings API, and is widely used by non-specialists.
- llama.cpp server is a credible later option because it supports GGUF models and OpenAI-compatible chat/completion/embedding endpoints.
- ONNX Runtime Web is interesting for browser/WebGPU inference, but it is not a near-term fit for Bible AI's desktop/Rust-side retrieval path.
- Tauri sidecars can bundle external binaries, but every bundled runtime increases installer size, update burden, security review, and support complexity.

Decision:

- Keep Ollama-first local runtime.
- Do not bundle a local LLM runtime in the private beta.
- Consider a future `Local runtime adapter` only after Smart Research and Study Packet workflows are stable.
- If adding llama.cpp later, treat it as an optional OpenAI-compatible local endpoint rather than a second custom integration.

Runtime eval checklist before adding any new local AI runtime:

- installation burden,
- model download burden,
- Windows CPU/GPU behavior,
- embeddings parity,
- JSON output reliability,
- memory footprint,
- offline behavior,
- support burden,
- security/update path,
- user-facing explanation.

### Pass 5 - Supply chain, release integrity, and app security

The app already has release manifests, release summaries, archive verification, and SHA-256 checks. That is a good base. The next maturity layer is to define a public release integrity story:

- SBOM for dependencies and bundled sidecars,
- provenance/attestation for release artifacts,
- reproducibility expectations,
- code signing and SmartScreen caveats,
- vulnerability reporting path,
- dependency health checks.

Relevant tools/standards:

- SLSA provides a shared vocabulary for build provenance and assurance levels.
- CycloneDX is a mature SBOM standard.
- GitHub Artifact Attestations can attach provenance to artifacts built in GitHub Actions.
- Sigstore/cosign can sign blobs/artifacts in CI.
- OpenSSF Scorecard can check open-source security posture.

Decision:

- Do not block private beta on full SLSA or SBOM work.
- Before public GitHub Releases, add a release-integrity checklist.
- For the first public release, target practical provenance rather than perfection:
  - SHA-256 hashes,
  - release manifest,
  - release summary,
  - signed installer if available,
  - SBOM candidate,
  - GitHub Artifact Attestation if using Actions,
  - documented manual verification command.

Recommended canonical doc:

- `docs/release-integrity-and-supply-chain.md`

Recommended release-gate additions:

- verify lockfiles are committed,
- verify no unexpected sidecar binaries,
- generate dependency SBOM candidate,
- attach release manifest and hashes,
- document build host,
- review Tauri capabilities,
- review provider-key redaction,
- include SECURITY.md or private vulnerability reporting path before public launch.

### Pass 6 - Data portability, backup, and sync

Bible AI already supports export, backup, and restore. That should remain the portability backbone.

Sync research reinforces a key split:

- Obsidian Sync is a paid convenience layer with end-to-end encryption and version history.
- Syncthing is peer-to-peer continuous file sync and keeps users in control of devices/storage.
- Rclone can back up, restore, and encrypt cloud-storage workflows.
- Tauri filesystem/path APIs can support local export and app-data workflows, but wider filesystem access should remain capability-scoped.

Decision:

- Do not add cloud sync in private beta.
- Make local export and backup excellent first.
- Document "bring your own sync" cautiously: users may sync exported Markdown or backups with tools they already trust, but the app should not recommend live-syncing `user.sqlite` without a corruption/locking strategy.
- If sync is added later, require end-to-end encryption, version history/conflict resolution, deletion semantics, support policy, recovery workflow, and privacy terms.

Portability tiers:

| Tier | Timing | Description |
| --- | --- | --- |
| Exported Study Packet | Now/next | Markdown/HTML/PDF artifact for long-term portability. |
| JSON backup/restore | Already present | Structured app data migration with secret redaction. |
| SQLite backup/restore | Already present | Power-user/full-state backup with safety backup checks. |
| Bring-your-own file sync | Later docs only | User-controlled sync of exports/backups, not live database sync. |
| Built-in encrypted sync | Defer | Requires full sync architecture and privacy program. |

Recommended canonical doc:

- `docs/data-portability-and-sync-policy.md`

### Pass 7 - Open-source governance and security reporting

If Bible AI becomes public/open-source, product trust will depend on more than code. The repo needs community and security rails before broad contribution:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- issue templates
- vulnerability reporting guidance
- support policy
- governance/maintainer decision policy
- contributor guidance against importing copyrighted Bible texts
- AI-use policy for contributions and generated content

GitHub supports community health files and private vulnerability reporting. Contributor Covenant is a common code-of-conduct base. OpenSSF Scorecard can help identify security posture gaps.

Decision:

- Before broad public announcement, add a minimum community-health pack.
- Keep theological debate moderation out of GitHub issues; use issues for bugs, docs, source review, and reproducible product problems.
- Put doctrinal-content disputes into a source/eval process, not open-ended issue arguments.

Recommended canonical docs/files:

- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/source_review.yml`
- `.github/ISSUE_TEMPLATE/ai_output_issue.yml`
- `docs/governance-and-community-policy.md`

## Revised plan after this loop

### Promote now

Create stable docs from the research corpus:

1. `docs/decision-index.md`
2. `docs/beta-operating-model.md`
3. `docs/beta-feedback-kit.md`
4. `docs/study-packet-v1.md`
5. `docs/learning-design-principles.md`
6. `docs/source-expansion-strategy.md`
7. `docs/ai-risk-eval-plan.md`
8. `docs/support-bundle-policy.md`
9. `docs/accessibility-release-gate.md`
10. `docs/release-integrity-and-supply-chain.md`
11. `docs/data-portability-and-sync-policy.md`
12. `docs/governance-and-community-policy.md`

### Update existing docs

1. `docs/architecture.md` - correct stale sqlite-vec current-state wording.
2. `docs/testing-and-release-plan.md` - add Study Packet learning checks, eval fixtures, accessibility, supply-chain, and capability review.
3. `docs/privacy-and-distribution.md` - add no passive telemetry, no automatic support uploads, and sync/gateway caveats.
4. `docs/install-windows.md` - add private beta, SmartScreen/code signing, and release integrity notes.
5. `README.md` - clarify managed gateway and public beta posture.

### Defer

- Built-in sync.
- Auto-update.
- Public managed gateway.
- Bundled local LLM runtime.
- Public app-store release.
- Paid marketplace/resource packs.
- Full SLSA target.
- SaaS observability.

### Add beta acceptance tests

Study Packet learning checks:

- user initial observation exists when provided,
- generated synthesis is separate from user notes,
- user judgment is exported,
- review questions are exported,
- source set and provider/model metadata are exported,
- no provider keys or private unrelated notes are exported.

Release integrity checks:

- release manifest verifies,
- release summary verifies,
- checksums match,
- sidecar files present and expected,
- Tauri capabilities reviewed,
- lockfiles present,
- SBOM candidate generated or explicitly deferred with reason.

Local AI checks:

- Ollama unavailable path degrades cleanly,
- embedding model mismatch is surfaced,
- local endpoint URL validation remains strict,
- provider output contract tests cover malformed JSON and timeout paths.

## Decision register additions

| Area | Decision | Why |
| --- | --- | --- |
| Learning value | Active recall and user judgment before more summaries | Passive AI answers do not prove learning. |
| Spaced review | Defer full SRS; support review prompts/export first | Avoid building Anki poorly before Study Packet v1 is stable. |
| Local runtime | Ollama-first; llama.cpp optional later | Lowest support burden with current implementation. |
| Bundled local model | Defer | Installer size, model licensing, updates, and support are not beta-ready. |
| Release provenance | Add practical SBOM/provenance path before public release | Trust-sensitive desktop downloads need verifiable integrity. |
| Sync | Export/backup first; encrypted sync later only with design | Live sync can corrupt data and create privacy obligations. |
| Open-source governance | Add community/security docs before broad launch | Public religious/AI project needs clear boundaries. |

## Source links used in this pass

- RetrievalPractice.org Make It Stick summary: https://www.retrievalpractice.org/make-it-stick
- Dunlosky et al. effective learning techniques: https://pubmed.ncbi.nlm.nih.gov/26173288/
- Anki manual background and FSRS: https://docs.ankiweb.net/background.html and https://docs.ankiweb.net/deck-options.html#fsrs
- W3C Cognitive Accessibility: https://www.w3.org/WAI/cognitive/
- W3C Making Content Usable for People with Cognitive and Learning Disabilities: https://w3c.github.io/coga/content-usable/
- Lifeway small group study guidance: https://www.lifeway.com/articles/what-should-your-small-group-study and https://www.lifeway.com/articles/ministry-a-small-group-bible-study-plan
- Lifeway State of Groups report: https://research.lifeway.com/wp-content/uploads/2025/01/DIGITAL-State-of-Groups-Insights-Report.pdf
- Barna church leaders and AI: https://www.barna.com/research/church-leaders-ai-usage-concerns/
- Barna technology/faith 2026 trends: https://www.barna.com/research/state-of-the-church-2026-trends/
- Bible Society AI Bible apps and theological bias: https://www.biblesociety.org.uk/research/ai-bible-apps-and-theological-bias-report
- Association of Theological Schools: https://www.ats.edu/
- ATS/In Trust/Atla AI theological education event: https://www.intrust.org/news-insights/faithfully-co-creating/
- Ollama API and embeddings docs: https://docs.ollama.com/api/introduction and https://docs.ollama.com/capabilities/embeddings
- llama.cpp server docs: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- Tauri sidecar docs: https://v2.tauri.app/develop/sidecar/ and https://v2.tauri.app/learn/sidecar-nodejs/
- ONNX Runtime Web docs: https://onnxruntime.ai/docs/tutorials/web/
- SLSA: https://slsa.dev/
- CycloneDX: https://cyclonedx.org/
- GitHub Artifact Attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- Sigstore/cosign docs: https://docs.sigstore.dev/cosign/system_config/installation/
- OpenSSF Scorecard: https://scorecard.dev/ and https://github.com/ossf/scorecard
- Obsidian Sync: https://obsidian.md/sync
- Syncthing: https://syncthing.net/ and https://docs.syncthing.net/
- Rclone and crypt: https://rclone.org/ and https://rclone.org/crypt/
- Tauri path and filesystem APIs: https://v2.tauri.app/reference/javascript/api/namespacepath/ and https://v2.tauri.app/plugin/file-system/
- GitHub community health files: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
- GitHub security policy and private vulnerability reporting: https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository and https://docs.github.com/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository
- Contributor Covenant: https://www.contributor-covenant.org/

