# Bible AI master plan enhancement pass

Generated: 2026-06-12 16:44:17 +01:00

Filename timestamp: 2026-06-12-164417

Enhances: `docs/reviews/2026-06-12-163356-comprehensive-research-synthesis-and-master-plan.md`

Repository: C:\JM Programs\BibleApp

Purpose: Tighten the comprehensive master plan into an execution-ready plan with a critical path, dependency ordering, first-ticket sequence, gate logic, doc templates, risk burndown, and beta operating model.

## Enhancement summary

The master plan is strategically correct and complete, but it is still too broad to execute without drift. This enhancement pass turns it into a stricter operating model:

1. Make Study Packet v1 the spine of every near-term decision.
2. Collapse the roadmap into six execution gates.
3. Run docs/policy, code hardening, and QA/eval work in parallel where safe.
4. Define dependency rules so features do not jump ahead of trust gates.
5. Create a first-PR sequence that reduces risk quickly.
6. Add concrete acceptance tests for each gate.
7. Add templates for the canonical docs that the plan requires.
8. Add stop conditions and kill criteria for distracting work.

The main correction is this: the next phase should not be "implement everything P0." It should be "prove that one Study Packet can be created, exported, audited, tested, and safely supported from a clean install."

## Plan v2 thesis

The plan should now be executed under one rule:

> If a task does not make Study Packet v1 more trustworthy, portable, safe, testable, or releasable, it is not P0.

This prevents the roadmap from turning into a general product backlog.

## Execution gates

### Gate 1: Canonical source of truth

Question: Can a contributor understand the beta blockers without reading 35 review reports?

Required outputs:

- `docs/study-packet-v1-contract.md`
- `docs/sensitive-topic-safety-policy.md`
- `docs/youth-and-minors-policy.md`
- `docs/accessibility-release-gate.md`
- `docs/content-bom.md`
- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- `docs/distribution-channel-decision.md`
- `docs/community-channel-policy.md`
- `docs/institutional-pilot-readiness.md`

Required edits:

- `docs/architecture.md`: fix vector store drift.
- `docs/testing-and-release-plan.md`: add Study Packet, safety, accessibility, quality, content, release evidence, and support-bundle gates.
- `docs/privacy-and-distribution.md`: add diagnostics, support-bundle, sensitive religious data, and gateway boundaries.
- `docs/data-sources.md`: link to content BOM and source decision classes.
- `docs/feature-roadmap.md`: promote Study Packet v1 and trust gates as the next arc.

Exit criteria:

- A new contributor can read only canonical docs and know the beta gate.
- Review docs become evidence, not the live plan.
- No canonical doc still claims `sqlite-vec` is the current vector implementation.

### Gate 2: Data integrity and local trust

Question: Can a beta user trust backup, restore, import, and credentials?

Required work:

- Restore legacy secret cleanup before returning success.
- Stronger SQLite restore identity validation.
- Native restore file picker or dialog-issued path token.
- Full state refresh after JSON import and SQLite restore.
- Import size and row-count budgets.
- Resource import quarantine/rejection for unreviewed or unclear rights.
- Note/tag cleanup.
- Stale Theology/workspace link cleanup or clear "source missing" rendering.
- Schema drift guard.

Exit criteria:

- A wrong or minimal SQLite file cannot silently become a valid user DB.
- Restored legacy secrets are migrated/cleaned before the user resumes work.
- Import/restore updates Settings and resource/module state without remount.
- Oversized imports fail early with clear messages.
- Resource entries cannot bypass source review in release paths.

### Gate 3: Study Packet v1

Question: Can the app produce the core artifact users actually want?

Required work:

- Define packet manifest.
- Audit current workspace/theology exports against packet contract.
- Add missing metadata: app version, corpus version, embedding model/dim, provider/model summary, retrieval mode, fallback reason, source rights, user/AI labels.
- Ensure Markdown, HTML, PDF, and any folder export preserve core sections.
- Add leak checks for packet outputs.
- Create five sample packets.

Exit criteria:

- A packet is useful outside the app.
- A packet can be reviewed without trusting the app UI.
- A packet labels Scripture/source/AI/user content separately.
- A packet contains no secrets, local paths, machine identifiers, or hidden provider data.
- The five acceptance cases pass manually.

### Gate 4: AI safety and quality

Question: Can likely AI failures be caught before they reach beta users?

Required work:

- Rule-based pre-Council sensitive-topic router.
- Sensitive response mode.
- Safety fixture set.
- Quality case schema.
- App-specific fixture runner through real sidecar boundaries where possible.
- Retrieval fallback transparency.
- Provider readiness state correction.
- Council cancellation or late-result suppression.

Exit criteria:

- Sensitive-topic prompts do not receive normal Council debate.
- Provider UI does not say "ready" unless the provider is verified.
- Retrieval degradation is visible in UI and export.
- Timeout or cancellation cannot create confusing late persisted results.
- S0/S1/repeated S2 failures require linked regression fixtures or accepted-risk entries.

### Gate 5: Release evidence and accessibility

Question: Can a clean tester install, operate, verify, and report issues safely?

Required work:

- Artifact-bound manual QA evidence.
- Per-file sidecar hashing.
- Third-party notices/SBOM.
- Support-bundle redaction verification.
- Keyboard-only Study Packet QA.
- Issue templates.
- Release notes template with platform warnings and checksums.

Exit criteria:

- Manual QA evidence matches current installer hashes.
- Release package contains no secrets, local DB, `.env`, or manual evidence.
- Support bundle is user-initiated, reviewable, and redacted.
- A keyboard-only user can complete the Study Packet path.
- Public issue templates guide reports without soliciting sensitive disclosures.

### Gate 6: Private beta

Question: Can 5 to 10 serious users validate the wedge without creating support or safety debt?

Required work:

- Beta invitation criteria.
- Beta task script.
- Feedback forms.
- Sample packets.
- Known issues list.
- Support triage workflow.
- Quality-case conversion workflow.

Exit criteria:

- Each beta user attempts at least one Study Packet.
- At least five packets are created across the beta cohort.
- Every serious AI failure is triaged into a quality case.
- Every safety or privacy concern has a documented decision.
- The team knows whether to continue, narrow, or change the wedge.

## Critical path

The fastest safe path is:

1. Fix the source-of-truth docs.
2. Harden restore/import/credential trust.
3. Define the Study Packet contract.
4. Bring current exports up to the contract.
5. Add sensitive-topic and AI-quality fixtures.
6. Add release evidence and accessibility gates.
7. Run a tiny beta.

Everything else is parallel or deferred.

## Parallel work lanes

### Lane A: Docs and policy

Can start immediately.

Outputs:

- Canonical docs.
- Gate checklists.
- Beta operating docs.
- Issue templates.

Risk:

- Low implementation risk.
- High value because it prevents engineering drift.

### Lane B: Data integrity hardening

Can start immediately after confirming current code paths.

Outputs:

- Restore validation.
- Secret cleanup.
- Import budgets.
- Resource quarantine.
- State refresh.
- Schema drift guard.

Risk:

- Medium because it touches backup/restore and persistence.
- Needs focused regression tests.

### Lane C: Packet contract and export

Can start after `docs/study-packet-v1-contract.md` draft exists.

Outputs:

- Packet metadata.
- Packet manifest.
- Export audit checks.
- Five sample packets.

Risk:

- Medium because it touches output formats and user trust.
- High product value.

### Lane D: AI quality and safety

Can start after sensitive-topic policy and quality case schema exist.

Outputs:

- Router.
- Fixtures.
- Provider readiness.
- Retrieval fallback labeling.
- Cancellation/late-result handling.

Risk:

- Medium/high because AI flows are complex and safety mistakes are visible.

### Lane E: Release and beta ops

Can start once Gate 1 docs exist.

Outputs:

- Artifact-bound QA evidence.
- SBOM/notices.
- Issue templates.
- Beta packet.

Risk:

- Medium because release automation can be brittle.

## Dependency rules

1. Do not implement the sensitive-topic router until `docs/sensitive-topic-safety-policy.md` exists.
2. Do not change packet exports until `docs/study-packet-v1-contract.md` defines the required sections.
3. Do not expand resources until `docs/content-bom.md` and source decision classes exist.
4. Do not add public support channels until `docs/community-channel-policy.md` exists.
5. Do not run private beta until restore/import trust and export leak checks pass.
6. Do not add institutional pilot materials until private beta produces sample packets.
7. Do not add managed gateway monetization until provider cost, privacy, abuse, support, and refund issues have beta evidence.
8. Do not add sync/collaboration until local export/import trust is boring.
9. Do not add `sqlite-vec`, Tantivy, or LanceDB until search metrics show a real bottleneck.
10. Do not add Tauri updater until signed release operations and rollback are real.

## First 15 execution tickets

### Ticket 1: Promote Study Packet v1 contract

Create `docs/study-packet-v1-contract.md`.

Acceptance:

- Defines packet sections.
- Defines `manifest.json`.
- Defines required metadata.
- Defines forbidden data.
- Defines five acceptance cases.

### Ticket 2: Correct architecture vector-store drift

Update `docs/architecture.md`.

Acceptance:

- Current vector implementation is described as SQLite BLOB embeddings plus Rust cosine scan.
- `sqlite-vec` is listed only as a future option.
- `docs/data-sources.md` remains consistent.

### Ticket 3: Add content BOM doc

Create `docs/content-bom.md`.

Acceptance:

- Defines source decision classes.
- Defines required BOM fields.
- States public release cannot include sources missing from BOM.

### Ticket 4: Add sensitive-topic policy

Create `docs/sensitive-topic-safety-policy.md`.

Acceptance:

- Includes taxonomy.
- Defines pre-Council routing.
- Defines crisis and abuse response posture.
- States app is not pastor/counselor/emergency/legal/medical/financial service.

### Ticket 5: Add youth/minors policy

Create `docs/youth-and-minors-policy.md`.

Acceptance:

- States v0.1 is not child-directed.
- Blocks youth/classroom pilots.
- Defines future review requirements.

### Ticket 6: Add accessibility gate

Create `docs/accessibility-release-gate.md`.

Acceptance:

- Defines keyboard-only Study Packet QA script.
- Defines focus, label, contrast, text scaling, overlay, and tablist checks.

### Ticket 7: Add quality ops and AI risk docs

Create `docs/quality-ops-plan.md` and `docs/ai-risk-eval-plan.md`.

Acceptance:

- Defines severity taxonomy.
- Defines quality case schema.
- Defines fixture requirements.
- Defines S0/S1/repeated S2 handling.

### Ticket 8: Harden SQLite restore secrets and identity

Code change.

Acceptance:

- Restore runs secret migration/cleanup before success.
- Wrong/minimal DB restore is rejected.
- Tests cover legacy secrets and wrong DB.

### Ticket 9: Fix import/restore refresh

Code change.

Acceptance:

- JSON import and SQLite restore refresh Settings resource/module state.
- E2E checks Data Sources immediately after import/restore without remount.

### Ticket 10: Add import budgets and resource quarantine

Code change.

Acceptance:

- Oversized backup/resource payloads fail before transaction.
- Unreviewed resource entries are quarantined or rejected.
- Unknown or redistribution-negative release imports fail.

### Ticket 11: Fix tag and stale-link integrity

Code change.

Acceptance:

- Note deletion cleans note tag links.
- Tag browser counts match visible items.
- Theology/workspace stale links render as missing or are cleaned.

### Ticket 12: Fix provider readiness model

Code change.

Acceptance:

- Provider states are `configured`, `will_try`, and `verified`.
- "Ready" uses diagnostic success only.
- Unsaved provider tests do not imply saved runtime readiness.

### Ticket 13: Add retrieval fallback visibility

Code change.

Acceptance:

- Council UI and exports show when semantic retrieval degrades.
- Fallback reason is stored with session/packet metadata.

### Ticket 14: Add Council cancellation or late-result suppression

Code change.

Acceptance:

- Timeout/cancel cannot persist or display stale results as current.
- Operation id or abort path is tested.

### Ticket 15: Add release evidence binding

Script/release change.

Acceptance:

- Manual QA evidence includes installer names, byte counts, and SHA-256 values.
- Public release verifier compares evidence to current manifest.
- Sidecar directory uses per-file hashes.

## First sprint recommendation

Do not start with AI features. Start with a mixed sprint that reduces ambiguity and user-data risk.

Sprint 1 scope:

1. Ticket 1: Study Packet contract.
2. Ticket 2: architecture vector-store correction.
3. Ticket 3: content BOM.
4. Ticket 4: sensitive-topic policy.
5. Ticket 8: restore secrets and identity.
6. Ticket 9: import/restore refresh.

Why this mix:

- It creates the product spine.
- It fixes known doc drift.
- It closes high-trust data paths.
- It prepares later export, safety, and content work.

Sprint 1 exit:

- `npm run check:full` passes if code changes are made.
- Targeted restore/import tests pass.
- The next sprint can safely work on packet export and safety fixtures.

## Second sprint recommendation

Sprint 2 scope:

1. Ticket 5: youth/minors policy.
2. Ticket 6: accessibility gate.
3. Ticket 7: quality ops and AI risk docs.
4. Ticket 10: import budgets and resource quarantine.
5. Ticket 12: provider readiness model.
6. Ticket 13: retrieval fallback visibility.

Sprint 2 exit:

- Safety and quality docs exist.
- Import paths are bounded.
- Provider readiness is honest.
- Retrieval degradation is visible.

## Third sprint recommendation

Sprint 3 scope:

1. Ticket 11: tag and stale-link integrity.
2. Ticket 14: Council cancellation or late-result suppression.
3. Ticket 15: release evidence binding.
4. Implement sensitive-topic router and fixtures.
5. Audit current exports against Study Packet contract.
6. Produce first sample Study Packet.

Sprint 3 exit:

- One Study Packet can be produced and audited end to end.
- Safety routing exists.
- Release evidence is tighter.

## Fourth sprint recommendation

Sprint 4 scope:

1. Add keyboard-only Study Packet QA.
2. Add support-bundle redaction verification.
3. Add issue templates.
4. Generate SBOM/third-party notices.
5. Produce remaining sample packets.
6. Run private-beta dry run.

Sprint 4 exit:

- Private beta gate can be assessed honestly.

## Canonical doc templates

### `docs/study-packet-v1-contract.md`

Required sections:

- Purpose.
- User stories.
- Packet folder layout.
- Required Markdown files.
- `manifest.json` schema.
- Required metadata.
- Source attribution rules.
- User/AI/source labeling rules.
- Forbidden data.
- Export formats.
- Acceptance cases.
- QA checklist.

### `docs/sensitive-topic-safety-policy.md`

Required sections:

- Scope.
- Non-scope.
- Limitations statement.
- Sensitive-topic taxonomy.
- Detection approach.
- Routing behavior.
- Response modes.
- Crisis resources.
- Eval fixtures.
- Release blockers.
- Support-channel handling.

### `docs/content-bom.md`

Required sections:

- Purpose.
- Source decision classes.
- Required source metadata.
- Current bundled sources.
- User-imported source policy.
- Deferred sources.
- Blocked sources.
- Export attribution rules.
- Release check.

### `docs/quality-ops-plan.md`

Required sections:

- Quality case schema.
- Severity taxonomy.
- Failure classes.
- Intake channels.
- Triage workflow.
- Fixture conversion rule.
- Release blockers.
- Dashboard fields.

### `docs/accessibility-release-gate.md`

Required sections:

- Workflow under test.
- Keyboard-only script.
- Focus requirements.
- Screen-reader label requirements.
- Overlay/dialog requirements.
- Contrast/text scaling requirements.
- Known gaps.
- Release decision rule.

## Gate scorecard

Use this scorecard before inviting beta users.

| Gate | Pass condition | Current expected status |
| --- | --- | --- |
| Canonical docs | Required docs exist and drift fixed | Not passed |
| Data trust | Restore/import/resource paths hardened | Not passed |
| Packet v1 | Contract implemented and sample packet exists | Not passed |
| Safety/quality | Sensitive router and fixtures exist | Not passed |
| Accessibility | Keyboard-only packet QA passes | Not passed |
| Release evidence | Artifact-bound QA and redaction checks pass | Not passed |
| Beta ops | Invite script, tasks, triage, known issues ready | Not passed |

## Beta readiness red/yellow/green rules

### Red

Do not invite beta users if any are true:

- Restore can accept unrelated/minimal DBs.
- Legacy secrets can remain in restored SQLite after success.
- Exports can leak provider keys, local paths, or machine identifiers.
- Sensitive-topic prompts enter normal Council generation.
- Provider UI says "ready" without verified diagnostics.
- No Study Packet contract exists.
- No way exists to collect bad AI output reports safely.

### Yellow

Private beta can proceed with clear known issues if:

- Some accessibility gaps remain but keyboard-only Study Packet path works.
- SBOM/third-party notices are incomplete but private beta release notes say so.
- Modern translation breadth is limited.
- Local model setup is rough but not required for every tester.
- Tauri updater is absent.

### Green

Private beta can proceed confidently if:

- One clean-profile install completes.
- Five acceptance packets can be produced.
- Safety fixtures pass.
- Export leak checks pass.
- Manual QA evidence is current.
- Support/quality triage is ready.

## Stop conditions

Stop or defer the work if:

- A proposed feature does not support Study Packet v1.
- A feature requires cloud accounts, sync, or shared workspaces before local export is reliable.
- A community feature requires moderation capacity the team does not have.
- A youth/minors use case appears before policy and consent/data-flow review.
- A provider or gateway change creates unclear data movement.
- A content source has unclear rights.
- A search infrastructure change is justified by preference rather than measured bottleneck.

## Better sequencing of beta artifacts

The master plan asks for five sample Study Packets. Build them in this order:

1. Hard passage packet.
   - Tests Council reasoning, dissent, and user judgment.

2. Word study packet.
   - Tests Strong's/original-language metadata and occurrence handling.

3. Resource critique packet.
   - Tests resource provenance, source attribution, and prompt-injection discipline.

4. Small-group teaching packet.
   - Tests practical export usefulness and non-technical readability.

5. Theology update packet.
   - Tests long-term learning record, Theology links, and user conclusion separation.

Reason for this order:

- The first packet validates the core wedge.
- The second validates original-language value.
- The third validates content-rights and untrusted-resource handling.
- The fourth validates beta audience utility.
- The fifth validates learning/theology depth.

## Enhanced quality loop

Quality should move through this path:

1. User or reviewer reports issue.
2. Triage assigns severity and failure class.
3. S0/S1/repeated S2 gets a quality case.
4. Quality case gets a minimal reproduction packet or fixture.
5. Fix is implemented.
6. Fixture proves regression protection.
7. Release notes say what changed.

Do not close serious AI issues with "prompt adjusted" alone. Close them with a linked fixture or an explicit accepted-risk entry.

## Enhanced support loop

Support should move through this path:

1. User starts from issue template or support bundle flow.
2. Template warns not to paste private pastoral, mental-health, legal, medical, or identifying content.
3. User chooses report type:
   - bad AI output
   - source/license issue
   - privacy/export issue
   - accessibility issue
   - setup/provider issue
   - crash/install issue
4. App or docs explain how to redact.
5. Support triage maps report to bug, quality case, source review, safety issue, docs issue, or accepted limitation.

## Enhanced release gate wording

Use this release rule:

> No public release artifact is valid unless the exact installer artifact was installed, tested, hashed, scanned, and tied to the manual QA evidence.

This avoids stale manual reports from passing against a different build.

## Enhanced risk burndown

Work should reduce these risks in this order:

1. User data loss or secret leakage.
2. Unsafe sensitive-topic AI behavior.
3. Export/source attribution trust failure.
4. Misleading provider or retrieval status.
5. Release artifact integrity failure.
6. Accessibility blocker in the core Study Packet path.
7. Beta support intake confusion.
8. Broader market or pricing uncertainty.

Market and pricing uncertainty should not outrank trust defects.

## What to remove from near-term thinking

Remove these from near-term planning boards unless they are explicitly marked deferred:

- Pricing tiers.
- Public marketing site.
- Mobile app.
- Sync.
- Collaboration.
- Church admin.
- Youth mode.
- Module marketplace.
- Modern translation licensing pursuit.
- Tauri updater.
- Alternative vector database migration.
- AI devotional/prayer companion features.

These can be revisited after the private beta validates Study Packet demand.

## Final enhanced plan

The comprehensive master plan remains the source strategy. This enhancement pass makes it executable:

1. Run Gate 1 immediately.
2. Fix data trust before inviting users.
3. Make Study Packet v1 the release spine.
4. Add safety, quality, content, accessibility, and release gates around that spine.
5. Validate with 5 to 10 serious-study beta users.
6. Defer everything that does not make that path safer, clearer, or more useful.

The practical next action is not another broad research pass. It is to create the canonical docs, correct architecture drift, and start the first hardening sprint.
