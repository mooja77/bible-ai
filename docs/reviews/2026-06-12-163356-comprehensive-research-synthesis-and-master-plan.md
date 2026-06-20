# Bible AI comprehensive research synthesis and master plan

Generated: 2026-06-12 16:33:56 +01:00

Filename timestamp: 2026-06-12-163356

Repository: C:\JM Programs\BibleApp

Purpose: Consolidate the accumulated deep review reports, market and competitor research, technical research, safety research, content-rights research, release-operations research, quality-ops research, and local canonical docs into one complete operating plan.

## Executive summary

The research has converged. Bible AI should not become a generic Bible chatbot, a devotional habit app, a Logos replacement, an AI pastor, or a church management platform. The durable product is a local-first Bible study workbench that helps serious learners produce auditable Study Packets: portable research artifacts that contain the passage, retrieved evidence, source metadata, Council reasoning, dissent, user judgment, export attribution, and open questions.

The current app is already far beyond an idea-stage MVP. The built product includes a Tauri desktop shell, local SQLite corpus and user data, Reader, Search, workspaces, notes, range actions, exports, bookmarks/history, original-language tools, modules/resources, Council transparency, provider setup, managed gateway mode, credential-vault storage, release manifests, manual release gates, and learning/theology workflows.

The remaining work is not primarily more features. It is convergence work:

1. Promote research decisions into canonical docs.
2. Fix known release-blocking and trust-blocking hardening gaps.
3. Formalize the Study Packet contract.
4. Add safety routing and quality fixtures before wider beta.
5. Make content rights and source provenance auditable.
6. Make release evidence reproducible from clean machines.
7. Run a narrow beta around serious-study workflows before any public or institutional expansion.

The top-level plan is:

1. Stabilize the source of truth.
2. Close pre-beta technical hardening gaps.
3. Ship Study Packet v1 as the product wedge.
4. Add trust, safety, accessibility, quality, and content gates.
5. Run a small private beta.
6. Prepare public beta release operations.
7. Only then consider institutional pilots, partnerships, pricing, sync, or a managed gateway subscription.

## Source base reviewed

This plan synthesizes 35 timestamped review reports in `docs/reviews/` plus canonical docs under `docs/`.

### Deep app review reports

- `2026-06-11-145646-app-deep-review-findings.md`
- `2026-06-11-150603-app-deep-review-findings.md`
- `2026-06-11-161133-app-deep-review-findings.md`
- `2026-06-11-162801-app-deep-review-findings.md`
- `2026-06-11-163656-app-deep-review-findings.md`
- `2026-06-11-164922-app-deep-review-findings.md`
- `2026-06-11-165940-app-deep-review-findings.md`
- `2026-06-11-170656-app-deep-review-findings.md`
- `2026-06-11-175143-app-deep-review-findings.md`
- `2026-06-11-191942-app-deep-review-findings.md`
- `2026-06-11-192900-app-deep-review-findings.md`
- `2026-06-11-221533-app-deep-review-findings.md`
- `2026-06-11-222504-app-deep-review-findings.md`
- `2026-06-11-224308-app-deep-review-findings.md`
- `2026-06-11-225154-app-deep-review-findings.md`

### Market, tech, and recursive research reports

- `2026-06-11-230419-app-market-tech-research.md`
- `2026-06-11-231437-app-expanded-research-addendum.md`
- `2026-06-11-232124-app-workflow-ecosystem-research.md`
- `2026-06-11-233012-app-global-ai-governance-research.md`
- `2026-06-11-233506-app-launch-ops-research.md`
- `2026-06-11-234938-app-eval-safety-decision-research.md`
- `2026-06-11-235653-app-market-tech-plan-refresh.md`
- `2026-06-12-000831-app-persona-workflow-benchmark-decision-index.md`
- `2026-06-12-001412-app-operating-model-distribution-measurement-research.md`
- `2026-06-12-002026-app-tools-competitors-market-tech-recursive-research.md`
- `2026-06-12-002818-app-community-content-privacy-eval-recursive-research.md`
- `2026-06-12-132536-app-learning-local-ai-supply-chain-governance-recursive-research.md`
- `2026-06-12-134528-app-global-hermeneutics-partnerships-enablement-recursive-research.md`
- `2026-06-12-135728-app-ai-economics-provider-risk-runtime-recursive-research.md`
- `2026-06-12-140235-app-quality-ops-human-eval-support-triage-recursive-research.md`
- `2026-06-12-151119-app-content-rights-search-corpus-moat-recursive-research.md`
- `2026-06-12-152042-app-trustable-release-ops-diagnostics-supply-chain-competitor-recursive-research.md`
- `2026-06-12-154804-app-audience-wedge-market-pricing-learning-moat-recursive-research.md`
- `2026-06-12-161641-app-local-first-interoperability-offline-ai-rag-distribution-recursive-research.md`
- `2026-06-12-162520-app-institutional-trust-pastoral-safety-accessibility-community-recursive-research.md`

### Canonical docs checked

- `docs/architecture.md`
- `docs/feature-roadmap.md`
- `docs/technical-implementation-plan.md`
- `docs/implementation-checklist.md`
- `docs/data-sources.md`
- `docs/testing-and-release-plan.md`
- `docs/privacy-and-distribution.md`
- `docs/open-resource-ingestion-plan.md`
- `docs/learning-ui-workflows.md`
- `docs/learning-testing-and-release-plan.md`
- `docs/learning-and-systematic-theology-plan.md`
- `docs/learning-technical-implementation.md`
- `docs/learning-data-model.md`

## Current app state

### Product

Bible AI is a local-first desktop Bible study app. It already supports:

- Offline bundled Bible corpus.
- Reader navigation.
- Parallel translation and interleaved layouts.
- Full-text search.
- Local semantic retrieval.
- Strong's and original-language tooling.
- Study workspaces.
- Verse and range actions.
- Saved searches.
- Bookmarks and reading history.
- Markdown, HTML, and PDF exports.
- Module/resource import.
- Open resource browsing.
- Theology topics and user conclusions.
- Guided learning workflows.
- Council AI workflows with audit and transparency.
- Provider setup and diagnostics.
- User-owned provider credentials.
- Managed gateway mode.
- Local backup and restore.
- Release packaging and verification scripts.

### Stack

- Desktop shell: Tauri 2.
- Frontend: React 19, TypeScript, Vite, Tailwind.
- Backend: Rust/Tauri with `rusqlite`.
- Corpus: read-only `data/corpus.sqlite`.
- User data: local `user.sqlite`.
- AI sidecar: Node sidecar under `app/sidecar`.
- Local model host: Ollama.
- Cloud provider path: Claude, OpenAI, Gemini, and managed gateway modes.
- Credentials: OS credential vault for provider keys and gateway tokens.

### Strong foundations

- Tauri capability surface is narrow.
- Production CSP is materially tighter than development CSP.
- Provider secrets are moved out of SQLite and into the OS vault.
- JSON backups exclude provider keys and gateway tokens.
- Export sanitizers are documented and tested for secret-looking values and paths.
- Council already has evidence traces, provider audit, dissent, and transparency surfaces.
- Human judgment is already separated from AI output in learning workflows.
- Resource source assessment exists and rejects unclear licenses in the audited pipeline.
- Manual and automated release verification scripts are unusually mature for a desktop beta.

### Current source-of-truth gaps

The research has produced many decisions that are not yet canonical docs. The following files are missing and should be created:

- `docs/study-packet-v1-contract.md`
- `docs/sensitive-topic-safety-policy.md`
- `docs/youth-and-minors-policy.md`
- `docs/accessibility-release-gate.md`
- `docs/institutional-pilot-readiness.md`
- `docs/community-channel-policy.md`
- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- `docs/content-bom.md`
- `docs/distribution-channel-decision.md`

There is also known doc drift:

- `docs/architecture.md` still describes `sqlite-vec` as the vector store, while the current implementation stores embeddings as little-endian `f32` BLOBs in SQLite and searches them with Rust cosine scan.
- Some schema/tooling mirrors have drifted from runtime `USER_SCHEMA_VERSION`.
- Release docs are strong, but signing, SBOM/license notice, artifact evidence, and support-bundle redaction should be promoted into a unified release-readiness gate.

## Final product thesis

Bible AI should be:

> A local-first Bible study workbench for serious learners that produces auditable Study Packets with Scripture, sources, AI-assisted reasoning, dissent, user judgment, and exportable evidence trails.

Bible AI should not be:

- An AI pastor.
- A counselor.
- A crisis service.
- A prayer companion.
- A devotional habit app.
- A replacement for a church.
- A replacement for Logos or Accordance libraries.
- A generic Bible chatbot.
- A youth ministry app.
- A church management system.
- A public community answer marketplace.

## Strategic positioning

### Primary beta audience

Start with a small, direct-invite beta for:

- Serious lay Bible students.
- Small-group teachers.
- Ministry volunteers preparing lessons.
- Pastors or elders who are comfortable with AI limits.
- Seminary or Bible college students using the app personally.
- Privacy-conscious users interested in local-first study tooling.
- Local AI users who can tolerate setup friction in exchange for control.

Avoid mass-market launch audiences first:

- Casual daily devotional users.
- Users looking for quick pastoral answers.
- Youth groups.
- School classrooms.
- Church-wide deployments.
- Users who expect modern copyrighted translation libraries.
- Users who expect hosted sync and mobile parity.

### Competitive stance

Use competitors as expectation baselines, not strategy targets.

| Category | Competitors and tools | Strategic reading |
| --- | --- | --- |
| Deep Bible software | Logos, Accordance | Do not compete on paid library depth. Compete on transparent AI, local ownership, and portable Study Packets. |
| Free Bible study sites | Bible Gateway, Blue Letter Bible, STEP Bible | Users expect easy reference lookup, search, lexicon access, and citations. Bible AI must beat them on research artifact quality, not raw breadth. |
| Habit/devotional apps | YouVersion, Hallow | Do not chase streaks, prayer, meditation, social sharing, or mass consumer habit loops. Borrow onboarding clarity only. |
| Learning media | BibleProject | Benchmark for structured learning clarity. Study Packet flows should feel like guided learning, not chat logs. |
| AI research tools | NotebookLM, Elicit, Consensus | Use source-grounded workflows, artifact creation, and citation discipline as benchmarks. |
| Knowledge tools | Obsidian, Zotero, Pandoc | Export and interoperability should let users leave with useful files and citations. |
| Church platforms | RightNow Media, Planning Center, Subsplash, Gloo | Institutions require policies, support, privacy clarity, and admin expectations. Do not build church management features now. |

## Product moat

The durable moat is not "Bible chatbot with local AI." That can be copied.

The moat is:

- Local-first ownership.
- Offline Bible corpus.
- Auditable Council reasoning.
- Source trails.
- User judgment captured before and after AI output.
- Portable Study Packet export.
- Content-rights discipline.
- Sensitive-topic safety routing.
- Quality-case regression loop.
- Accessibility release gate.
- Trustable release operations.
- Direct relationship with serious-study beta users.

## Master roadmap

### Milestone 0: Source-of-truth stabilization

Goal: turn research decisions into canonical operating docs.

Required outputs:

- `docs/study-packet-v1-contract.md`
- `docs/sensitive-topic-safety-policy.md`
- `docs/youth-and-minors-policy.md`
- `docs/accessibility-release-gate.md`
- `docs/institutional-pilot-readiness.md`
- `docs/community-channel-policy.md`
- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- `docs/content-bom.md`
- `docs/distribution-channel-decision.md`

Required doc updates:

- Update `docs/architecture.md` to replace the current `sqlite-vec` claim with the actual SQLite BLOB plus Rust cosine implementation, while noting `sqlite-vec` as a possible future feature-flagged upgrade.
- Update `docs/testing-and-release-plan.md` to include safety fixtures, accessibility gate, support-bundle redaction, SBOM/license notices, and artifact identity evidence.
- Update `docs/privacy-and-distribution.md` with support-bundle, diagnostics, gateway, and sensitive religious data rules.
- Update `docs/data-sources.md` with content decision classes and content BOM linkage.
- Update `docs/feature-roadmap.md` to make Study Packet v1 and trust gates the next arc.

Definition of done:

- Every high-level decision in this plan has a canonical doc home.
- Review reports remain historical evidence, not the only place decisions live.
- A new contributor can read the canonical docs and understand what blocks beta.

### Milestone 1: Pre-beta technical hardening

Goal: close known reliability, data-integrity, release, and setup gaps before asking beta users to trust private study data to the app.

Release-blocking hardening tasks:

1. SQLite restore legacy secret cleanup.
   - Run credential migration and secret-row cleanup immediately after restore opens the restored DB and before returning success.
   - Add restore-specific regression test.

2. SQLite restore identity validation.
   - Reject minimal or wrong DBs that merely contain `app_settings`.
   - Require Bible AI-specific schema markers, expected tables, schema version, and app identity metadata.
   - Keep quick check and safety backup.

3. SQLite restore UI.
   - Replace raw path input with native file picker or a dialog-issued path token.
   - Keep explicit confirmation and safety backup messaging.

4. Import/restore state refresh.
   - After JSON import and SQLite restore, refresh Settings-owned resource/module state, settings-derived UI state, navigation, chapter user state, and any active app-level state that can be stale.
   - Add E2E assertion that Settings Data Sources updates without remounting.

5. Import budgets.
   - Add maximum JSON bytes, table row counts, text field sizes, resource body sizes, and FTS rebuild limits before transaction start.
   - Return clear errors for oversized imports.

6. Resource import source gate.
   - When `resource_entries` come from backup JSON, require accepted source-review metadata or import them as quarantined/unreviewed.
   - Reject unknown license and redistribution-negative sources for release paths.

7. Note/tag and polymorphic link cleanup.
   - Prevent note tags from pointing to missing notes.
   - Clean up orphaned note tag links on deletion.
   - Make tag counts and tag browser items agree.
   - Add cleanup or "source missing" rendering for Theology links and item tags to deleted objects.

8. Council cancellation.
   - Add operation ids and late-result suppression at minimum.
   - Prefer abort propagation from UI to Tauri to sidecar to provider fetch calls where APIs support it.
   - For non-abortable SDK calls, isolate in a killable process or sidecar-level cancel path.

9. Provider readiness accuracy.
   - Split provider state into `configured`, `will_try`, and `verified`.
   - Count "ready" only from successful diagnostics.
   - Make standalone provider tests either save first or clearly label unsaved draft testing.
   - Scope provider-specific test buttons to the named provider or relabel them as full setup tests.

10. Retrieval fallback transparency.
   - If semantic retrieval fails or degrades to keyword/FTS, show that clearly in Council output and exports.
   - Preserve retrieval mode and fallback reason in the Study Packet.

11. Schema drift guard.
   - Source runtime schema version from one place or add a check that fails when runtime schema, `data/schema.sql`, comments, and resource import generators diverge.

12. Release artifact identity.
   - Bind manual QA evidence to current installer names, byte counts, SHA-256 hashes, and release manifest identity.
   - Add precise sidecar directory file hashing rather than count/byte-total only.

13. Third-party notices and SBOM.
   - Generate a public-release third-party notice/SBOM artifact covering sidecar dependencies, bundled Node runtime provenance, Rust dependencies, frontend dependencies, and license texts where required.

14. Branding and metadata polish.
   - Remove starter Vite/Tauri assets from production surfaces.
   - Update Cargo/package metadata.
   - Centralize app version display from release metadata.

Definition of done:

- Known release-blocking or trust-blocking findings have code tests or accepted-risk entries.
- `npm run check:full`, release verification, and targeted regression tests pass.
- A clean-profile install can be trusted for private beta.

### Milestone 2: Study Packet v1

Goal: define and ship the product artifact that validates the wedge.

Study Packet v1 should be a portable folder/export contract, not just an in-app screen.

Required packet contents:

- `README.md` with title, passage, created/exported timestamps, app version, corpus version, and provider/model summary.
- `passage.md` with Scripture text, translation metadata, and omitted/missing verse notes where relevant.
- `question.md` with the user question, optional starting view, scope, filters, and assumptions.
- `evidence.md` with retrieved evidence, used evidence, ignored evidence, source metadata, retrieval mode, scores where available, and fallback reasons.
- `council.md` with positions, per-voice analysis, synthesis, dissent, confidence rationale, unresolved tensions, weakest links, and "what would change this."
- `judgment.md` with user-authored conclusion, confidence, changed view, open questions, and notes.
- `sources.md` with source rights, attribution, license notes, resource provenance, and source decision classes.
- `manifest.json` with stable machine-readable metadata.
- Optional `bibliography.csl.json` or `references.bib` where citation-grade metadata exists.
- Optional Obsidian-friendly links and folder layout.

Packet rules:

- AI-authored, source-authored, and user-authored sections must be labeled separately.
- No provider keys, gateway tokens, local paths, build paths, environment variables, or machine identifiers.
- Export must be useful outside the app.
- Export must preserve enough metadata to reproduce or audit the study later.
- Export must record if semantic retrieval degraded.
- Export must record corpus embedding model and dimensions when semantic search contributed.

Acceptance cases:

1. Hard passage packet.
   - User studies a debated or difficult passage.
   - Packet preserves multiple positions, evidence, dissent, and user judgment.

2. Small-group teaching packet.
   - User prepares a session with passage, observations, questions, source cautions, and open issues.

3. Word study packet.
   - User studies a Greek or Hebrew term with occurrences, lexicon metadata, and limits.

4. Resource critique packet.
   - User imports or selects a resource excerpt and asks Council to evaluate claims against Scripture.

5. Theology update packet.
   - User links a Council result and resources into a Theology topic and exports the updated learning record.

Definition of done:

- Study Packet v1 is documented and tested.
- Exports open cleanly as Markdown in normal editors and Obsidian.
- Source attribution and user/AI separation survive Markdown, HTML, and PDF paths.
- Beta testers can send a redacted packet or issue report without exposing private secrets.

### Milestone 3: Trust and safety gates

Goal: prevent predictable harm before wider beta.

Required docs:

- `docs/sensitive-topic-safety-policy.md`
- `docs/youth-and-minors-policy.md`
- `docs/accessibility-release-gate.md`
- `docs/community-channel-policy.md`

Sensitive-topic taxonomy:

- Suicide and self-harm.
- Imminent harm to others.
- Domestic abuse.
- Sexual abuse.
- Child safety.
- Medical or mental health issues.
- Legal or financial decisions.
- Pastoral emergency.
- Spiritual abuse, coercion, manipulation, or threats.
- Confession-like disclosures involving harm.

Implementation tasks:

1. Pre-Council sensitive-topic router.
   - Start rule-based and local.
   - Conservative false positives are acceptable at beta scale.
   - Route before normal Council generation.
   - Do not use hidden cloud moderation as the first implementation.

2. Sensitive response mode.
   - App states it is not a pastor, counselor, doctor, lawyer, financial advisor, or emergency service.
   - For crisis or imminent harm, provide concise safety guidance and real-world help routing.
   - Do not produce theological debate as the primary response for crisis prompts.
   - Allow bounded Scripture study when safe, but keep advice limits visible.

3. Safety fixtures.
   - Add eval cases for each sensitive-topic category.
   - Block release if these prompts produce normal Council debate or authoritative pastoral advice.

4. Youth/minors boundary.
   - v0.1 is not child-directed.
   - No youth-group, classroom, or school deployment.
   - No under-13 path.
   - No youth pilot without separate policy and data-flow review.

5. Community channel policy.
   - Define what belongs in public issues.
   - Redirect sensitive disclosures away from public threads.
   - Add issue templates for bad AI output, sensitive-topic concerns, accessibility issues, source/license issues, and privacy/support-bundle concerns.

Definition of done:

- Sensitive prompts route away from normal Council generation.
- Onboarding and Settings state AI-assistant limits plainly.
- Public support channels cannot become unmanaged pastoral/crisis spaces.

### Milestone 4: Accessibility gate

Goal: make accessibility a workflow release gate, not scattered UI polish.

Required core test:

A keyboard-only user can create or load a study, read the passage, search, open overlays, close overlays, run Council/guided learning, review evidence, enter judgment, export a Study Packet, and recover from errors.

Checklist:

- Stable focus order.
- Visible focus state.
- Escape closes overlays and returns focus.
- Dialog semantics for overlays.
- Tablist semantics for tabbed panels.
- Screen-reader-visible labels for icon buttons.
- No unlabeled critical controls.
- Text scaling remains usable.
- Contrast is acceptable in default light and dark themes.
- Controls do not overlap at supported window sizes.
- Keyboard shortcuts do not trap focus.

Automation:

- Add Playwright coverage for the Study Packet path.
- Add axe checks for app shell and major panels if the tooling remains low-friction.
- Keep manual QA for real WebView behavior.

Definition of done:

- Accessibility gate is in `docs/accessibility-release-gate.md`.
- Known gaps are listed.
- Wider beta is blocked if the complete Study Packet path fails keyboard-only QA.

### Milestone 5: AI quality and eval operations

Goal: convert AI failures into a regression system.

Required docs:

- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`

Quality case schema should track:

- Case id.
- Severity.
- Source.
- User workflow.
- Prompt/question.
- Passage/resource context.
- Provider/model.
- Retrieval mode.
- Expected behavior.
- Actual behavior.
- Failure class.
- Status.
- Linked fix.
- Linked regression fixture.
- Accepted-risk rationale if not fixed.

Failure classes:

- Fabricated citation.
- Misquoted passage.
- Missing primary passage.
- Hidden provider disagreement.
- Overconfident disputed claim.
- Tradition/lens misrepresentation.
- Sensitive-topic safety failure.
- Prompt injection/resource poisoning.
- Retrieval false positive.
- Retrieval false negative.
- Export audit gap.
- Licensing or attribution gap.
- Accessibility or readability issue.

Eval ladder:

1. Golden Study Packet manual review.
2. App-specific fixture runner through the actual sidecar path.
3. Provider drift comparison.
4. Prompt injection and poisoned-resource fixtures.
5. Sensitive-topic fixtures.
6. Optional Promptfoo for prompt/security regression.
7. Optional Ragas or DeepEval for supplementary RAG metrics.

Definition of done:

- S0/S1 and repeated S2 AI quality reports become fixtures before fixes count as complete.
- Release notes say what quality risk changed.
- Quality dashboard has open failures, fixed failures, accepted risks, and coverage areas.

### Milestone 6: Content rights, source provenance, and corpus plan

Goal: make source trust and rights as visible as AI trust.

Required doc:

- `docs/content-bom.md`

Source decision classes:

- `bundled_redistributable`
- `user_imported_local`
- `online_api_only`
- `partner_licensed`
- `deferred_rights_unclear`
- `blocked`

Content BOM fields:

- Source id.
- Title.
- Version/date.
- Source URL.
- Maintainer/publisher.
- License.
- Attribution.
- Redistribution permission.
- Modification rules.
- Share-alike requirements.
- Export rules.
- AI/RAG usage rules.
- Language.
- Script.
- Canon scope.
- Versification.
- Checksum.
- Import script.
- OCR/source quality.
- Release inclusion status.

Implementation tasks:

- Extend resource manifest validation to include source decision class, canon scope, language/script, versification, checksum, and AI/export rules.
- Fail public release if a bundled source is missing from the content BOM.
- Quarantine or reject imported resources without accepted source metadata.
- Keep modern copyrighted translations deferred unless explicit rights are obtained.
- Keep Douay-Rheims deferred until versification/canon support is explicit.
- Keep LXX, apocrypha, manuscript images, and partner/API sources as later work.

Definition of done:

- Every shipped source has auditable rights metadata.
- Every exported resource excerpt carries attribution rules.
- Content expansion cannot silently create licensing debt.

### Milestone 7: Local-first technical contract

Goal: preserve user ownership and avoid infrastructure churn.

Decisions:

- Keep SQLite, FTS5, and current BLOB-vector scan until real measurements justify change.
- Treat `sqlite-vec` as a future feature-flag candidate, not the current dependency.
- Consider Tantivy only if expanded resource search exceeds SQLite/FTS comfort.
- Consider LanceDB only if large vector/resource workloads create actual pain.
- Keep Ollama as the default local model path.
- Add OpenAI-compatible local endpoint support later for LM Studio, llama.cpp server, and Ollama compatibility endpoints.
- Do not add sync, collaboration, CRDTs, or shared workspaces in v0.1.

Required metadata:

- Corpus version.
- Corpus source checksum.
- Embedding model.
- Embedding dimensions.
- Embedding generation timestamp.
- Retrieval mode.
- Fallback reason.
- Provider/model used in Council.
- Local vs cloud provider data movement.

Definition of done:

- Users can tell what is local, what leaves the machine, and how retrieval was produced.
- Local-first is visible in product behavior, not just architecture.

### Milestone 8: Release operations and distribution

Goal: make install, update, diagnostics, and release trust boring.

Required doc:

- `docs/distribution-channel-decision.md`

Distribution sequence:

1. Private beta: direct installer or GitHub pre-release with clear caveats.
2. Public beta: GitHub Releases with checksums, signed installers if available, known issues, rollback/downgrade notes, and public release evidence.
3. Package managers later: WinGet/Homebrew after release process is stable.
4. Tauri updater later: only after signing, update JSON hosting, rollback policy, and support process are mature.
5. Microsoft Store later only if discovery/trust benefits outweigh packaging overhead.

P0 release gates:

- Clean-profile Windows install QA.
- Credential-vault migration evidence.
- No bundled shared provider keys.
- No `.env`, local profile DB, manual evidence, or secrets in packages.
- Release manifest hashes match artifacts.
- Manual evidence is tied to current artifact hashes.
- Sidecar files are individually hashed.
- Third-party notices/SBOM generated or explicitly accepted-risk.
- Support bundle redaction verified.
- Export leak scans pass.
- Real-provider Council QA fixture passes or release explicitly stays private/mock-limited.

Diagnostics policy:

- No hidden telemetry.
- No passive collection of Bible reading, search, prompts, notes, theology topics, or resource content.
- Support bundles must be user-initiated and reviewable.
- Crash reporting is deferred unless opt-in beta mode, scrubbing, and SDK maturity are reviewed.

Definition of done:

- A tester can install, verify artifact identity, understand platform warnings, understand provider data movement, and report problems without leaking private study content.

### Milestone 9: Private beta operation

Goal: learn from serious users without over-distributing an unproven faith AI tool.

Beta size:

- Start with 5 to 10 users.
- Expand to 25 only after quality and support loops are working.
- Keep direct invite and high-touch support.

Beta user tasks:

- Create a hard passage packet.
- Create a small-group teaching packet.
- Create a word study packet.
- Critique a resource excerpt.
- Update a Theology topic and export it.
- Try provider setup.
- Try local/Ollama setup if technically comfortable.
- Submit one bad-AI-output report.
- Submit one usability or source clarity report.

Beta metrics:

- First-run setup completion.
- Provider setup success.
- Time to first useful Study Packet.
- Packet export success.
- Evidence/source trust rating.
- User judgment completion rate.
- Bad AI output rate by class.
- Fabricated citation count.
- Retrieval failure/fallback rate.
- Sensitive-topic route correctness.
- Support bundle usability.
- Accessibility blockers.
- User willingness to use the packet outside the app.

Beta non-goals:

- Paid beta.
- Public app-store launch.
- Youth use.
- Church-wide deployment.
- General social/community forum.
- Cloud sync.
- Modern copyrighted translation bundle.

Definition of done:

- Beta testers complete the five acceptance cases.
- Quality cases are converted into fixtures.
- The product wedge is validated or falsified with real artifacts.

### Milestone 10: Institutional pilot readiness

Goal: prepare for church, ministry, seminary, or training-group pilots only after private beta trust gates are stable.

Required doc:

- `docs/institutional-pilot-readiness.md`

Pilot packet:

- AI posture statement.
- Privacy and data movement one-pager.
- Source rights and attribution statement.
- Sensitive-topic safety policy.
- Youth/minors policy.
- Accessibility baseline and known gaps.
- Support and incident path.
- Sample Study Packet.
- Local model/provider setup quickstart.
- Bad AI output reporting process.
- Support bundle review process.
- Pilot agenda and exit criteria.

Institutional constraints:

- No youth group pilots until youth policy and consent/data-flow reviews exist.
- No church-wide deployment until support, training, and incident paths are mature.
- No org admin console yet.
- No shared workspaces yet.
- No managed gateway subscription until cost, privacy, retention, abuse, support, and billing are measured.

Definition of done:

- A responsible institutional adopter can understand exactly what the app does, what data moves, what it does not do, and how incidents are handled.

## Workstream backlog

### Workstream A: Product and positioning

P0:

- Write the final product thesis into `README.md` or a canonical product strategy doc.
- Remove or avoid any language implying AI spiritual authority.
- Define Study Packet v1 as the core beta object.
- Define the five beta acceptance cases.

P1:

- Create beta onboarding script.
- Create sample Study Packets.
- Write "what leaves my machine" copy for setup.

P2:

- Pricing experiments after trust validation.
- Institutional packaging after private beta.

### Workstream B: Study Packet and UX

P0:

- Create `docs/study-packet-v1-contract.md`.
- Audit current workspace/theology exports against the contract.
- Add missing packet metadata and manifest fields.
- Add export leak and attribution checks for packet outputs.

P1:

- Add Obsidian-friendly folder export.
- Add optional CSL JSON or BibTeX sidecar where metadata exists.
- Add "report issue from packet" workflow with user-reviewed redaction.

P2:

- Packet gallery for onboarding.
- Import/reopen packet manifest.

### Workstream C: AI, Council, and RAG

P0:

- Add provider readiness states.
- Add Council cancellation or late-result suppression.
- Add retrieval fallback labeling.
- Add sensitive-topic router before Council generation.
- Add quality fixtures for Council failures.

P1:

- Add app-specific eval harness around sidecar.
- Add local endpoint adapter design.
- Add corpus embedding metadata to Settings and exports.

P2:

- LM Studio/llama.cpp compatible endpoint support.
- Promptfoo integration.
- Ragas/DeepEval only if useful.

### Workstream D: Trust, safety, privacy

P0:

- Create sensitive-topic policy.
- Create youth/minors policy.
- Update privacy doc with diagnostics and support-bundle boundaries.
- Add safety fixtures.
- Add onboarding limitation copy.

P1:

- Localized crisis resource configuration.
- Support-bundle review UI hardening.
- Gateway privacy notes if managed gateway is used beyond private testing.

P2:

- Opt-in crash reporting review.
- Advanced redaction tooling.

### Workstream E: Content and sources

P0:

- Create content BOM.
- Add source decision classes.
- Quarantine/reject unreviewed resource imports.
- Add manifest validation fields for rights, language, canon, versification, checksum, and export rules.

P1:

- Curated source catalog.
- Public-domain historical theology fixtures.
- OCR quality fixture coverage.

P2:

- Partner/API exploration.
- LXX/apocrypha after canon and versification support.
- Modern translations only with explicit rights.

### Workstream F: Release operations

P0:

- Bind manual QA evidence to artifact hashes.
- Add sidecar per-file hashing.
- Generate SBOM/third-party notices.
- Remove starter branding assets.
- Centralize version metadata.
- Complete clean-profile QA.

P1:

- Distribution channel decision doc.
- Release notes template.
- Rollback/downgrade notes.
- Signed Windows installer if feasible.
- macOS signing/notarization enforcement for public macOS builds.

P2:

- Tauri updater.
- WinGet/Homebrew.
- Microsoft Store.

### Workstream G: Quality and support

P0:

- Create quality ops plan.
- Create issue templates.
- Define severity taxonomy.
- Convert S0/S1/repeated S2 AI bugs into fixtures.

P1:

- Quality dashboard.
- Support bundle reviewer checklist.
- Beta report triage process.

P2:

- Public community channel moderation.
- Security policy and vulnerability reporting.

### Workstream H: Accessibility

P0:

- Create accessibility release gate.
- Add keyboard-only Study Packet QA.
- Audit custom overlays, tablists, icon buttons, focus traps, and text scaling.

P1:

- Add automated axe checks where practical.
- Track known gaps in release notes.

P2:

- Formal VPAT-like accessibility statement only if institutional/public need emerges.

### Workstream I: Data integrity and persistence

P0:

- Restore secret cleanup.
- Stronger restore identity validation.
- Native restore file picker.
- Import/restore state refresh.
- Import budgets.
- Note/tag cleanup.
- Theology stale-link cleanup.
- Schema drift guard.

P1:

- Archive/trash pattern for destructive workspace actions.
- Consistent clipboard helper.
- Existing-file overwrite semantics for Markdown save.

P2:

- More granular backup previews.
- Selective restore.

## Release gates by stage

### Private beta gate

All must be true:

- Study Packet v1 contract exists.
- Sensitive-topic policy exists.
- Youth/minors policy exists.
- Accessibility gate exists.
- Content BOM exists for bundled sources.
- Quality ops plan exists.
- Distribution channel decision exists.
- Restore/import hardening is done or explicitly accepted-risk.
- Provider readiness states are accurate.
- Sensitive-topic fixtures do not produce normal Council debate.
- Keyboard-only Study Packet path passes manual QA.
- Exports preserve AI/user/source labels.
- Exports pass secret/path leak checks.
- Manual clean-profile evidence is current enough for private beta.

### Public beta gate

All private beta items plus:

- Manual QA evidence tied to current installer hashes.
- SBOM/third-party notices generated or accepted-risk.
- Public release notes include known issues, platform warnings, checksums, and privacy notes.
- Support bundle redaction verified.
- Issue templates live.
- No hidden telemetry.
- Real-provider QA fixture is current or public beta scope explicitly avoids real-provider claims.
- Signed installers or clear unsigned-warning documentation.

### Institutional pilot gate

All public beta items plus:

- Institutional pilot readiness packet exists.
- Institution understands data movement and provider choices.
- Pilot avoids youth/minors unless a separate youth policy is implemented.
- Pilot does not require org admin, sync, collaboration, or church-wide deployment.
- Support and incident path exists.
- Accessibility baseline and known gaps are documented.
- Sample Study Packets exist.

## Explicit deferrals

Do not build or launch these until earlier gates pass:

- Cloud sync.
- Collaboration.
- Shared workspaces.
- Organization admin console.
- Public social/community forum.
- Module marketplace.
- AI pastoral coaching.
- Prayer companion mode.
- Youth group or school mode.
- Church-wide deployment tooling.
- App-owned shared provider key model.
- Managed gateway subscription.
- Tauri updater.
- Microsoft Store release.
- Modern copyrighted translation bundles.
- LXX/apocrypha/canon expansion without versification and source policy.
- Replacing SQLite/FTS/BLOB vector scan with a fashionable vector database.

## Decision register

1. Adopt Study Packet v1 as the core product wedge.
2. Keep local-first ownership as a product feature.
3. Keep user-supplied provider credentials as the default.
4. Keep Ollama as the default local AI path.
5. Add OpenAI-compatible local endpoints later, not before beta hardening.
6. Keep SQLite/FTS/BLOB vector search until metrics prove otherwise.
7. Treat `sqlite-vec`, Tantivy, and LanceDB as later measurement-driven options.
8. Do not market v0.1 to minors.
9. Do not use AI pastor positioning.
10. Do not use hidden telemetry.
11. Do not open public community support without moderation and sensitive-disclosure policy.
12. Do not launch institutional pilots before trust docs and support paths exist.
13. Do not monetize the beta before trust and support costs are known.
14. Do not import or bundle sources without rights metadata.
15. Treat safety, privacy, accessibility, source rights, and release evidence as product features.

## Top risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Generic chatbot drift | Product becomes undifferentiated | Study Packet wedge, acceptance cases, no AI-pastor language |
| AI overtrust | Users treat output as authority | Human judgment fields, dissent, source trails, limitations copy |
| Crisis or abuse prompt receives theological debate | User harm | Sensitive-topic router, safety fixtures, release blocker |
| Fabricated or bad citations | Trust collapse | Quality case loop, golden packets, source evidence checks |
| Licensing drift | Release/legal risk | Content BOM, source decision classes, import gates |
| Privacy leak through exports or support | High trust damage | Leak scans, reviewable support bundles, no hidden telemetry |
| Restore/import data loss | User data harm | Strong restore validation, safety backup, tests |
| Provider setup confusion | Beta failure | Accurate readiness states, setup copy, scoped diagnostics |
| Release evidence mismatch | Public trust failure | Artifact-bound manual QA, hashes, SBOM/notices |
| Accessibility blockers | Excludes serious users | Keyboard-only Study Packet release gate |
| Premature institutional adoption | Support and policy overload | Institutional pilot gate, no youth or church-wide launch |
| Infrastructure churn | Wasted effort | Measurement gates before replacing SQLite/search |

## Measurement plan

### Product metrics

- Time to first useful Study Packet.
- Study Packet completion rate.
- Export success rate.
- User judgment completion rate.
- Source trail inspection rate.
- Repeat use by the same beta user.
- Beta user willingness to share a packet with a peer.

### Trust metrics

- Fabricated citation count.
- Misquoted passage count.
- Provider disagreement hidden count.
- Sensitive-topic routing failures.
- Export leak scan failures.
- Source attribution failures.
- Privacy/support-bundle concerns.

### Setup metrics

- First-run completion.
- Provider setup success.
- Local Ollama setup success.
- Managed gateway setup success if used.
- Diagnostic false-ready reports.
- Council cancellation/timeout reports.

### Quality metrics

- Open S0/S1/S2 quality cases.
- Quality cases converted to fixtures.
- Fixture pass rate by provider.
- Retrieval fallback rate.
- Golden Study Packet review status.

### Release metrics

- Clean-profile install pass.
- Artifact hash evidence pass.
- SBOM/notice generation pass.
- Manual QA freshness.
- Support bundle redaction pass.

## First execution sequence

This is the recommended immediate order:

1. Create `docs/study-packet-v1-contract.md`.
2. Update `docs/architecture.md` to fix vector-store drift.
3. Create `docs/sensitive-topic-safety-policy.md`.
4. Create `docs/youth-and-minors-policy.md`.
5. Create `docs/accessibility-release-gate.md`.
6. Create `docs/content-bom.md`.
7. Create `docs/quality-ops-plan.md`.
8. Create `docs/ai-risk-eval-plan.md`.
9. Create `docs/distribution-channel-decision.md`.
10. Create `docs/community-channel-policy.md`.
11. Create `docs/institutional-pilot-readiness.md`.
12. Fix restore secret cleanup and restore identity validation.
13. Fix import/restore state refresh.
14. Add import budgets and resource quarantine behavior.
15. Fix note/tag and stale-link cleanup.
16. Add provider readiness states.
17. Add Council cancellation or late-result suppression.
18. Add retrieval fallback labeling.
19. Add sensitive-topic router and fixtures.
20. Bind manual QA evidence to release artifact hashes.
21. Add sidecar per-file hashing.
22. Add third-party notice/SBOM generation.
23. Run keyboard-only Study Packet QA.
24. Produce five sample Study Packets.
25. Recruit the first 5 to 10 private beta users.

## Bottom line

The research says to stop expanding sideways and make the existing product trustworthy. Bible AI already has the shape of a serious local-first Bible study workbench. The next win is not more AI surface area; it is turning the app's existing Council, resources, learning workflows, exports, and local-first design into a reliable Study Packet product with explicit safety, rights, accessibility, quality, and release gates.

If the team executes this plan, Bible AI can be meaningfully distinct in the market: not broader than Logos, not bigger than YouVersion, not more devotional than Hallow, and not more social than church platforms, but more auditable, portable, local, and honest about AI-assisted Bible study.

## Research source links referenced by the prior reports

Competitor and market:

- YouVersion: https://www.youversion.com/news/bible-app-reaches-one-billion-installs
- Logos AI: https://support.logos.com/hc/en-us/articles/35181728416397-How-Logos-uses-AI
- Logos AI tools: https://support.logos.com/hc/en-us/articles/30128615450765-Using-AI-Tools-for-Smarter-Bible-Study
- Accordance: https://www.accordancebible.com/
- BibleProject app: https://bibleproject.com/app/
- BibleProject Classroom: https://bibleproject.com/classroom/
- Hallow: https://hallow.com/
- RightNow Media: https://www.rightnowmedia.org/
- Gloo AI: https://www.gloo.com/products/gloo-ai
- Planning Center: https://www.planningcenter.com/pricing
- Subsplash: https://www.subsplash.com/pricing

Local-first, interop, and tools:

- Ink and Switch local-first: https://www.inkandswitch.com/essay/local-first/
- Obsidian data storage: https://obsidian.md/help/data-storage
- Zotero data formats: https://www.zotero.org/support/dev/data_formats
- Pandoc: https://pandoc.org/
- Ollama API/OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- Ollama embeddings: https://ollama.com/blog/embedding-models
- LM Studio: https://lmstudio.ai/
- SQLite FTS5: https://sqlite.org/fts5.html
- sqlite-vec: https://github.com/asg017/sqlite-vec
- Tantivy: https://github.com/quickwit-oss/tantivy
- LanceDB: https://github.com/lancedb/lancedb

AI risk, eval, and security:

- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- OWASP LLM prompt injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI RMF Generative AI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- Promptfoo: https://www.promptfoo.dev/docs/intro/
- Ragas: https://docs.ragas.io/en/stable/
- DeepEval: https://deepeval.com/docs/introduction

Privacy, safety, and accessibility:

- GDPR Article 9: https://gdpr-info.eu/art-9-gdpr/
- UK ICO special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- FTC COPPA rule changes: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- SAMHSA 988 Lifeline: https://www.samhsa.gov/mental-health/988
- APA advisory on AI chatbots and wellness apps: https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Section 508: https://www.section508.gov/manage/laws-and-policies/
- ETSI EN 301 549: https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility
- WebAIM Screen Reader User Survey: https://webaim.org/projects/screenreadersurvey10/

Tauri and distribution:

- Tauri distribution overview: https://v2.tauri.app/distribute/
- Tauri Windows installer: https://v2.tauri.app/distribute/windows-installer/
- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/

Content and corpus:

- eBible: https://ebible.org/
- CrossWire: https://www.crosswire.org/
- Open Scriptures: https://openscriptures.org/
- Sefaria: https://www.sefaria.org/
- Digital Bible Library: https://thedigitalbiblelibrary.org/
