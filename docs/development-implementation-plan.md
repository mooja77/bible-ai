# Bible AI Development And Implementation Plan

Generated: 2026-06-12 19:50:57 +01:00

Enhanced: 2026-06-12 21:35:19 +01:00

Status: canonical execution plan

Repository: `C:\JM Programs\BibleApp`

Primary inputs:

- `docs/reviews/2026-06-12-163356-comprehensive-research-synthesis-and-master-plan.md`
- `docs/reviews/2026-06-12-164417-master-plan-enhancement-pass.md`
- `docs/reviews/2026-06-12-164726-master-plan-enhancement-pass-2-operating-system.md`
- `docs/reviews/2026-06-12-171932-master-plan-enhancement-pass-3-execution-packets.md`

## Purpose

This document turns the research and planning stack into a development plan that can be executed by engineers. It defines the product spine, phases, implementation packets, likely code and doc touchpoints, verification requirements, gate criteria, and beta readiness rules.

This is not another research report. It is the working plan for moving from analysis into implementation.

This enhancement pass adds the execution details that make the plan usable without reopening strategy:

- Implementation principles.
- Quickstart workflow.
- Repository touchpoint map.
- Dependency locks.
- Outcome traceability.
- Gate ownership by role.
- Milestone deliverables.
- Go/no-go checklists.
- PR workflow.
- Evidence bundle structure.
- Test data and fixture strategy.
- Decision points.
- Expanded beta packet detail.

## Quickstart

Use this sequence when starting work:

1. Read `Product Spine`, `Dependency Locks`, and `Implementation Start`.
2. Pick the next packet in order, starting with `EP-001`.
3. Confirm the packet maps to exactly one gate.
4. Confirm dependencies are satisfied.
5. Create or update only the files named by the packet unless code search proves another file is required.
6. Run the packet's verification commands.
7. Record evidence and any accepted risk.
8. Move to the next packet only after the current one meets Definition of Done.

Fast rule:

> If you cannot name the gate, the evidence, and the rollback/recovery path, the task is not ready.

## Product Spine

The north-star artifact is `Study Packet v1`.

A Study Packet is a portable, auditable Bible study artifact created from a clean install. It contains:

- The passage and translation/source metadata.
- The user's question and optional starting view.
- Retrieved evidence and retrieval behavior.
- Council reasoning, dissent, confidence rationale, and unresolved tensions.
- User-authored judgment and follow-up questions.
- Source rights and attribution.
- Provider/model and corpus metadata.
- Export formats that remain useful outside the app.

The plan uses this rule:

> If a task does not make Study Packet v1 more trustworthy, portable, safe, testable, accessible, or releasable, it is not P0.

## Outcome Traceability

This table ties product outcomes to gates, packets, and evidence.

| Outcome | Gate | Packets | Evidence |
| --- | --- | --- | --- |
| Contributor knows what blocks beta | Gate 1 | EP-001 to EP-005, EP-011, EP-012, EP-021 | Canonical docs and link checks |
| App docs match runtime architecture | Gate 1 | EP-002 | `rg` proof for vector-store language |
| Bundled and exported sources are rights-aware | Gate 1, Gate 3 | EP-003, EP-013, EP-015 to EP-018 | Content BOM, source rules, packet source appendix |
| User data survives restore/import safely | Gate 2 | EP-006 to EP-008, EP-013, EP-014 | Restore/import tests and state-refresh evidence |
| Study Packet can be audited outside the app | Gate 3 | EP-001, EP-015 to EP-018 | Sample packets, manifest, leak scan |
| AI status is honest | Gate 4 | EP-009, EP-010, EP-019 | Provider state tests, fallback metadata, cancellation test |
| Sensitive prompts are routed safely | Gate 4 | EP-004, EP-012, EP-020 | Safety fixtures and routing evidence |
| Release artifacts can be trusted | Gate 5 | EP-023 to EP-026 | Hash-bound QA, sidecar hashes, SBOM, redaction checks |
| Keyboard-only user can complete core flow | Gate 5 | EP-011, EP-027 | Manual keyboard QA evidence |
| Beta feedback becomes useful work | Gate 6 | EP-028 to EP-033 | Issue templates, beta scripts, quality case mapping |

If an implementation task cannot be placed in this table, it should not be P0.

## Implementation Principles

Use these rules while implementing this plan:

1. Prefer the existing app architecture over new infrastructure.
2. Keep changes scoped to one gate and one packet at a time.
3. Treat user data, credentials, exports, provider calls, and release packaging as high-risk paths.
4. Add regression tests before or with high-risk fixes.
5. Promote behavior changes into canonical docs in the same PR.
6. Do not add new AI surfaces until Study Packet v1 is trustworthy.
7. Do not add new content sources until source decision classes and content BOM rules exist.
8. Do not add public/community/institutional surfaces until support and safety policy exists.
9. Prefer explicit accepted-risk records over implicit "we know about it" notes.
10. Keep private beta and public release gates separate.

## Product Boundaries

Bible AI should be:

- A local-first Bible study workbench.
- A serious-study tool for auditable research.
- A portable Study Packet generator.
- A source-attributed Council and learning workflow.
- A privacy-conscious desktop app.

Bible AI should not be:

- A generic Bible chatbot.
- An AI pastor.
- A counselor or crisis service.
- A devotional habit app.
- A prayer companion.
- A church management platform.
- A youth ministry product.
- A public community answer marketplace.
- A Logos or Accordance library replacement.

## Current Implementation Baseline

The app already has:

- Tauri 2 desktop shell.
- React, TypeScript, Vite, and Tailwind frontend.
- Rust/Tauri backend with `rusqlite`.
- Read-only bundled `data/corpus.sqlite`.
- Per-user local `user.sqlite`.
- Node sidecar for Council/provider workflows.
- Reader, Search, Workspaces, Theology, Settings, Resources, and Council flows.
- Markdown, HTML, and PDF exports.
- Provider setup for user-owned credentials and managed gateway mode.
- OS credential-vault storage for provider keys and gateway tokens.
- Backup and restore.
- Resource/module import.
- Council transparency and audit surfaces.
- Learning workflows with user judgment separated from AI.
- Release packaging and verification scripts.

The next phase is hardening and packaging, not broad feature expansion.

## Repository Touchpoint Map

Use this map to find likely implementation surfaces. Confirm with code search before editing.

| Area | Likely files or folders | Notes |
| --- | --- | --- |
| App shell and modes | `app/src/App.tsx`, `app/src/features/*` | Cross-mode refresh and navigation usually start here. |
| Settings and provider setup | `app/src/features/settings/SettingsPanel.tsx` | Provider readiness, data sources, backup/restore UI, and setup status live here. |
| Frontend command wrappers | `app/src/lib/bible.ts` | Add typed wrappers for new Tauri commands or changed payloads. |
| Rust command boundary | `app/src-tauri/src/lib.rs` | Restore, backup, provider setup, retrieval, export, and command registration paths often pass through here. |
| User data | `app/src-tauri/src/user_db.rs` | Schema, migrations, imports, tags, Theology links, resource data, and user tables. |
| Credential handling | `app/src-tauri/src/credentials.rs` | Use shared helpers for provider/gateway secret migration and cleanup. |
| Corpus/search | `app/src-tauri/src/db.rs`, `app/src-tauri/src/ollama.rs` | Corpus reads, FTS, semantic retrieval, and embedding behavior. |
| Sidecar AI | `app/sidecar/index.mjs`, `app/sidecar/council.mjs`, `app/sidecar/providers/*` | Provider diagnostics, Council lifecycle, prompt behavior, and sidecar fixtures. |
| Workspace/export | workspace and Theology feature folders | Confirm exact renderer files before edits; preserve AI/user/source separation. |
| Resource ingestion | `app/scripts/resources/*`, `docs/open-resource-ingestion-plan.md` | Source assessment and import validation. |
| Release scripts | `app/scripts/*release*`, `app/scripts/*manual*`, `app/release/*` | Artifact identity, manual evidence, manifest, archive, and package gates. |
| E2E tests | `app/tests/e2e/*` | Use for user-visible flows crossing React, Rust, SQLite, and sidecar boundaries. |
| Canonical docs | `docs/*.md` | Stable execution docs live here. Research history remains in `docs/reviews/`. |

## Dependency Locks

These dependencies are mandatory:

- Do not implement Study Packet export changes before `docs/study-packet-v1-contract.md` exists.
- Do not implement sensitive-topic routing before `docs/sensitive-topic-safety-policy.md` exists.
- Do not implement youth, classroom, or institutional flows before `docs/youth-and-minors-policy.md` and `docs/institutional-pilot-readiness.md` exist.
- Do not add content sources or loosen resource import rules before `docs/content-bom.md` exists.
- Do not open public support channels before `docs/community-channel-policy.md` exists.
- Do not mark private beta ready before restore/import trust, export leak checks, and provider readiness honesty are complete.
- Do not mark public beta ready with manual QA evidence that is not bound to current artifact hashes.

## Development Gates

### Gate 1: Canonical Source Of Truth

Goal: Move decisions out of timestamped research docs into stable docs under `docs/`.

Required outputs:

- `docs/study-packet-v1-contract.md`
- `docs/content-bom.md`
- `docs/sensitive-topic-safety-policy.md`
- `docs/youth-and-minors-policy.md`
- `docs/accessibility-release-gate.md`
- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- `docs/distribution-channel-decision.md`
- `docs/community-channel-policy.md`
- `docs/institutional-pilot-readiness.md`

Required edits:

- `docs/architecture.md`: correct vector-store drift.
- `docs/feature-roadmap.md`: point to Study Packet v1 as the next arc.
- `docs/testing-and-release-plan.md`: add Study Packet, safety, accessibility, quality, content, and release evidence gates.
- `docs/privacy-and-distribution.md`: add diagnostics, support-bundle, sensitive religious data, and gateway boundaries.
- `docs/data-sources.md`: link to content BOM and source decision classes.

Exit criteria:

- A contributor can understand beta blockers from canonical docs.
- Review docs are historical evidence, not the only source of live decisions.
- No canonical doc describes `sqlite-vec` as the current runtime vector implementation.

### Gate 2: Data Integrity And Local Trust

Goal: Make backup, restore, import, credentials, tags, links, and user data safe enough for private beta.

Required work:

- Restore legacy secret cleanup before returning success.
- Stronger SQLite restore identity validation.
- Native restore file picker or dialog-issued path token.
- Full state refresh after JSON import and SQLite restore.
- Import size, row-count, and text-field budgets.
- Resource import quarantine or rejection for unreviewed source metadata.
- Note/tag cleanup.
- Stale Theology/workspace link cleanup or clear "source missing" rendering.
- Schema drift guard.

Exit criteria:

- Wrong or minimal SQLite files cannot silently become valid user DBs.
- Restored legacy secrets are migrated and removed before the user resumes work.
- Import/restore updates Settings and resource/module state without remount.
- Oversized imports fail early with clear messages.
- Resource entries cannot bypass source review in release paths.

### Gate 3: Study Packet v1

Goal: Make the packet the core product artifact.

Required work:

- Define Study Packet v1 contract.
- Audit current workspace and Theology exports against the contract.
- Add missing metadata to exports.
- Add packet manifest.
- Add leak checks for packet outputs.
- Create five sample packets.

Exit criteria:

- A packet is useful outside the app.
- A packet labels Scripture, source, AI, and user-authored content separately.
- A packet includes retrieval mode and fallback reason.
- A packet includes source rights and attribution.
- A packet contains no provider keys, gateway tokens, local paths, build paths, environment variables, or machine identifiers.
- Five acceptance packets can be produced manually.

### Gate 4: AI Safety And Quality

Goal: Prevent predictable AI harm and create a regression loop for AI failures.

Required work:

- Sensitive-topic safety policy.
- Rule-based pre-Council sensitive-topic router.
- Sensitive response mode.
- Safety fixture set.
- Quality case schema.
- App-specific fixture runner.
- Retrieval fallback transparency.
- Provider readiness state correction.
- Council cancellation or late-result suppression.

Exit criteria:

- Sensitive-topic prompts do not enter normal Council generation.
- Provider UI does not say "ready" unless the provider is verified.
- Retrieval degradation is visible in UI and exports.
- Timeout/cancel cannot persist confusing late results.
- S0, S1, and repeated S2 AI failures require a linked fixture or accepted-risk entry.

### Gate 5: Release Evidence And Accessibility

Goal: Make clean installs, release packages, support reports, and the core workflow verifiable.

Required work:

- Artifact-bound manual QA evidence.
- Per-file sidecar hashing.
- Third-party notices and SBOM.
- Support-bundle redaction verification.
- Keyboard-only Study Packet QA.
- Issue templates.
- Release notes template with platform warnings and checksums.

Exit criteria:

- Manual QA evidence matches current installer hashes.
- Release package contains no secrets, local DB, `.env`, or manual evidence.
- Support bundle is user-initiated, reviewable, and redacted.
- Keyboard-only user can complete the Study Packet path.
- Public issue templates guide reports without soliciting sensitive disclosures.

### Gate 6: Private Beta

Goal: Validate the Study Packet wedge with 5 to 10 serious-study users.

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
- At least five packets are created across the cohort.
- Every serious AI failure is triaged into a quality case.
- Every safety or privacy concern has a documented decision.
- The team knows whether to continue, narrow, or change the wedge.

## Gate Ownership By Role

Use roles even if one person fills several of them.

| Gate | Accountable role | Required reviewers | Notes |
| --- | --- | --- | --- |
| Gate 1: Canonical source of truth | Product/tech lead | Engineering, safety/privacy, release | Docs must be stable before code work depends on them. |
| Gate 2: Data integrity and local trust | Backend lead | QA, privacy/security | Treat restore/import and credential behavior as high-risk. |
| Gate 3: Study Packet v1 | Product/UX lead | Engineering, content/source, QA | Packet must work outside the app. |
| Gate 4: AI safety and quality | AI quality lead | Safety/privacy, theology/content, QA | Safety fixtures are release blockers. |
| Gate 5: Release evidence and accessibility | Release lead | QA, accessibility, privacy/security | Private beta and public beta evidence must stay separate. |
| Gate 6: Private beta | Product lead | Support, AI quality, release | Beta should validate the packet, not collect generic feature requests. |

Reviewer rule:

- High-risk code paths need at least one reviewer who is not the implementer.
- Accepted risks need explicit owner and revisit trigger.
- Safety and privacy gates cannot be self-approved silently.

## Milestone Deliverables

| Milestone | Deliverables | Required proof |
| --- | --- | --- |
| M0: Plan locked | This file exists and points to EP-001 | ASCII scan and git status |
| M1: Canonical docs complete | P0 docs exist and architecture drift is fixed | Link checks and `rg` checks |
| M2: Data trust hardened | Restore/import/secret/resource integrity fixes | Tests and failure-path evidence |
| M3: Packet v1 works | Packet contract, manifest, leak scan, sample packet | Sample packet opens outside app |
| M4: AI safety ready | Provider honesty, fallback visibility, router, fixtures | Fixture pass/fail report |
| M5: Release/accessibility ready | Evidence bundle, support redaction, keyboard QA | Private beta evidence folder |
| M6: Private beta ready | Beta docs, known issues, accepted risks, task script | Go/no-go decision record |

## Implementation Phases

### Phase 0: Planning Lock

Objective: Make this development plan the execution source.

Tasks:

- Keep this file as the implementation index.
- Do not keep adding broad planning passes unless a new blocker appears.
- Use the packet IDs below for implementation work.
- Keep review files as evidence, not active backlog.

Definition of done:

- `docs/development-implementation-plan.md` exists.
- Next task is `EP-001`.

### Phase 1: Canonical Docs

Objective: Create stable product and release gates.

Packets:

- `EP-001`: Study Packet v1 contract.
- `EP-002`: Architecture vector-store correction.
- `EP-003`: Content BOM and source decision classes.
- `EP-004`: Sensitive-topic safety policy.
- `EP-005`: Youth and minors policy.
- `EP-011`: Accessibility release gate doc.
- `EP-012`: Quality ops and AI risk docs.
- `EP-021`: Distribution, community, and institutional docs.

Recommended order:

1. EP-001.
2. EP-002.
3. EP-003.
4. EP-004.
5. EP-005.
6. EP-011.
7. EP-012.
8. EP-021.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\study-packet-v1-contract.md docs\content-bom.md docs\sensitive-topic-safety-policy.md docs\youth-and-minors-policy.md docs\accessibility-release-gate.md docs\quality-ops-plan.md docs\ai-risk-eval-plan.md
rg -n "study-packet-v1-contract|content-bom|sensitive-topic-safety-policy|accessibility-release-gate" docs
rg -n "sqlite-vec|BLOB|cosine" docs
```

Phase exit:

- All P0 canonical docs exist.
- Architecture doc is accurate.
- Testing and release docs point to the new gates.

### Phase 2: Data Trust Hardening

Objective: Make user data operations safe enough for beta.

Packets:

- `EP-006`: Restore secret cleanup.
- `EP-007`: Restore identity validation.
- `EP-008`: Import/restore refresh.
- `EP-013`: Import budgets and resource quarantine.
- `EP-014`: Tag and stale-link integrity.

Likely code touchpoints:

- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/user_db.rs`
- `app/src-tauri/src/credentials.rs`
- `app/src/features/settings/SettingsPanel.tsx`
- `app/src/App.tsx`
- Existing E2E and Rust test locations.

Implementation notes:

- Restore cleanup must run before success is returned.
- Restore identity validation must happen before active DB replacement.
- Import budgets must fail before large transactions start.
- Resource quarantine should preserve local user choice but prevent release-trust bypass.
- State refresh should update Settings-owned module/source data immediately.

Verification:

```powershell
cd app
npm run check
npm run check:full
cargo test
```

Use targeted test commands where the repo supports them. If `cargo test` is too broad or slow, document the narrower command that was run.

Phase exit:

- Wrong/minimal DB restore is rejected.
- Legacy secrets are cleaned after restore.
- Data Sources refreshes after import/restore.
- Oversized imports fail clearly.
- Resource import cannot bypass source review in release paths.

### Phase 3: Study Packet Implementation

Objective: Bring exports and sample artifacts up to the Study Packet v1 contract.

Packets:

- `EP-015`: Export audit against Study Packet contract.
- `EP-016`: Packet metadata and manifest.
- `EP-017`: Packet leak scan.
- `EP-018`: Sample Study Packets.

Likely code touchpoints:

- Workspace Markdown renderer.
- Theology export renderer.
- HTML/PDF export paths.
- Export sanitizers.
- Council session serialization.
- Source/resource attribution code.
- Tests covering export preview and saved exports.

Required packet sections:

- `README.md`
- `passage.md`
- `question.md`
- `evidence.md`
- `council.md`
- `judgment.md`
- `sources.md`
- `manifest.json`

Required metadata:

- App version.
- Export timestamp.
- Corpus version.
- Translation/source metadata.
- Embedding model and dimension where semantic retrieval contributed.
- Provider/model summary.
- Retrieval mode.
- Fallback reason.
- Source rights and attribution.
- AI/user/source labels.

Forbidden output:

- Provider API keys.
- Managed gateway tokens.
- Local app data paths.
- Build paths.
- Environment variables.
- Machine identifiers.

Sample packet targets:

- `docs/samples/study-packets/001-hard-passage/`
- `docs/samples/study-packets/002-word-study/`
- `docs/samples/study-packets/003-resource-critique/`
- `docs/samples/study-packets/004-small-group-teaching/`
- `docs/samples/study-packets/005-theology-update/`

Verification:

```powershell
cd app
npm run check
npm run check:full
```

Also run export-specific tests and leak scans as they are added.

Phase exit:

- One packet can be generated and reviewed outside the app.
- Five sample packet outlines or generated packets exist.
- Export leak checks pass.

### Phase 4: AI Safety, Retrieval, And Provider Honesty

Objective: Make AI behavior inspectable, bounded, and less misleading.

Packets:

- `EP-009`: Provider readiness honesty.
- `EP-010`: Retrieval fallback visibility.
- `EP-019`: Council cancellation or late-result suppression.
- `EP-020`: Sensitive-topic router and fixtures.
- `EP-022`: Quality case schema and fixture runner.

Likely code touchpoints:

- Settings provider status cards.
- Council pre-submit voice preview.
- Sidecar diagnostics.
- Council session metadata.
- Retrieval metadata.
- Council UI/export rendering.
- Sidecar request lifecycle.
- Test fixtures for Council and safety behavior.

Provider readiness states:

- `configured`: settings are present.
- `will_try`: app can attempt a call, but no verified success yet.
- `verified`: diagnostics succeeded.
- `skipped`: provider intentionally not used.
- `failed`: attempted and failed.

Sensitive-topic router:

- Rule-based first.
- Local and inspectable.
- Routes before normal Council generation.
- Conservative false positives are acceptable for beta.

Sensitive categories:

- Suicide and self-harm.
- Imminent harm to others.
- Domestic abuse.
- Sexual abuse.
- Child safety.
- Medical or mental health.
- Legal or financial decisions.
- Pastoral emergency.
- Spiritual abuse, coercion, manipulation, or threats.

Verification:

```powershell
cd app
npm run check
npm run check:full
node --check sidecar/index.mjs
node --check sidecar/council.mjs
```

Run sidecar and Council fixture tests as available.

Phase exit:

- Provider UI no longer overstates readiness.
- Retrieval fallback is visible in UI and packet/export metadata.
- Timeout/cancel cannot persist stale results as current.
- Sensitive prompts do not enter normal Council debate.

### Phase 5: Release Evidence, Accessibility, And Support

Objective: Make beta install, verification, reporting, and accessibility practical.

Packets:

- `EP-023`: Artifact-bound manual QA evidence.
- `EP-024`: Sidecar per-file hashing.
- `EP-025`: Third-party notices and SBOM.
- `EP-026`: Support-bundle redaction verification.
- `EP-027`: Keyboard-only Study Packet QA.
- `EP-028`: Issue templates and beta support intake.

Likely code and script touchpoints:

- `app/scripts/*release*`
- `app/scripts/*manual*`
- `app/release/*`
- `docs/testing-and-release-plan.md`
- `docs/privacy-and-distribution.md`
- `.github/ISSUE_TEMPLATE/*` if GitHub issue templates are added.

Release evidence must include:

- Installer names.
- Byte counts.
- SHA-256 hashes.
- Release manifest identity.
- Manual QA operator/profile metadata.
- Clean-profile install evidence.
- Credential-vault evidence without credential values.
- Export leak scan evidence.
- Support-bundle redaction evidence.

Accessibility QA must prove:

- Keyboard-only user can open passage.
- Keyboard-only user can search.
- Keyboard-only user can run Council or guided workflow.
- Keyboard-only user can review evidence.
- Keyboard-only user can enter judgment.
- Keyboard-only user can export packet.
- Focus order and focus return are coherent.

Verification:

```powershell
cd app
npm run release:check
npm run release:build
npm run release:manifest:verify
npm run release:package:verify
npm run qa:public-release:verify
```

Some public release commands may intentionally fail until clean-profile manual evidence exists. If they fail, record the exact failing gate.

Phase exit:

- Private beta evidence package can be assembled.
- Accessibility blocker list is known.
- Support intake is safe enough for beta users.

### Phase 6: Private Beta

Objective: Validate the Study Packet wedge with serious-study users.

Packets:

- `EP-029`: Beta invitation and criteria.
- `EP-030`: Beta task script.
- `EP-031`: Feedback and quality-case intake.
- `EP-032`: Known issues and accepted risks.
- `EP-033`: Private beta gate evidence bundle.

Beta cohort:

- Start with 5 to 10 users.
- Expand to 25 only after triage and support loops work.

Required beta tasks:

- Create a hard passage packet.
- Create a word study packet.
- Create a resource critique packet.
- Create a small-group teaching packet.
- Create or update a Theology packet.
- Report one confusing or bad output.

Beta metrics:

- Time to first useful packet.
- Packet completion rate.
- Export success rate.
- User judgment completion rate.
- Provider setup success.
- Retrieval fallback rate.
- Bad AI output classes.
- Sensitive-topic routing failures.
- Accessibility blockers.
- Support bundle usability.

Phase exit:

- Beta users created real packets.
- Feedback is triaged.
- Quality issues have fixtures or accepted-risk entries.
- Product direction is confirmed, narrowed, or changed based on evidence.

## Execution Packets

### EP-001: Study Packet v1 Contract

Gate: Canonical source of truth.

Files:

- `docs/study-packet-v1-contract.md`
- `docs/feature-roadmap.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define purpose and user stories.
- Define packet folder layout.
- Define required files.
- Define `manifest.json`.
- Define metadata.
- Define labels for Scripture/source/AI/user content.
- Define forbidden data.
- Define acceptance cases.

Out of scope:

- Code changes.
- Export implementation.

Acceptance:

- Contract names every required packet section.
- Contract includes required metadata and forbidden data.
- Roadmap/testing docs link to it.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\study-packet-v1-contract.md
rg -n "study-packet-v1-contract" docs
```

### EP-002: Architecture Vector-Store Correction

Gate: Canonical source of truth.

Files:

- `docs/architecture.md`
- optionally `docs/data-sources.md`

Scope:

- Document current SQLite BLOB embedding storage.
- Document Rust cosine scan.
- Move `sqlite-vec` to future option.

Acceptance:

- No canonical doc says `sqlite-vec` is current runtime.
- Current implementation is described accurately.

Verification:

```powershell
rg -n "sqlite-vec|BLOB|cosine" docs
```

### EP-003: Content BOM

Gate: Content rights and source trust.

Files:

- `docs/content-bom.md`
- `docs/data-sources.md`
- `docs/open-resource-ingestion-plan.md`

Scope:

- Define source decision classes.
- Define BOM fields.
- Add current source entries or placeholders.
- State release rule for missing BOM entries.

Acceptance:

- Current bundled sources are represented.
- User-imported source rules are explicit.

Verification:

```powershell
rg -n "content-bom|bundled_redistributable|source decision" docs
```

### EP-004: Sensitive-Topic Safety Policy

Gate: Trust and safety.

Files:

- `docs/sensitive-topic-safety-policy.md`
- `docs/privacy-and-distribution.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define non-role statement.
- Define taxonomy.
- Define pre-Council routing.
- Define fixture requirements.

Acceptance:

- Policy blocks normal Council generation for sensitive categories.
- Crisis response posture is bounded.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\sensitive-topic-safety-policy.md
```

### EP-005: Youth And Minors Policy

Gate: Trust and institutional boundary.

Files:

- `docs/youth-and-minors-policy.md`

Scope:

- State v0.1 is not child-directed.
- Block youth/classroom pilots.
- Define future review requirements.

Acceptance:

- No under-13 path.
- No youth marketing or pilots before separate review.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\youth-and-minors-policy.md
```

### EP-006: Restore Secret Cleanup

Gate: Data trust.

Files:

- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/user_db.rs`
- `app/src-tauri/src/credentials.rs`
- Rust tests.

Scope:

- Run credential migration and secret cleanup after restore opens restored DB and before success.
- Add regression test.

Acceptance:

- Legacy provider secret rows are removed from active DB after restore.
- Restore still succeeds for valid backup.

Verification:

```powershell
cd app
cargo test
```

### EP-007: Restore Identity Validation

Gate: Data trust.

Files:

- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/user_db.rs`
- Rust tests.

Scope:

- Reject unrelated/minimal SQLite DBs.
- Require app-specific identity markers or expected table set and schema metadata.

Acceptance:

- Minimal DB with only `app_settings` is rejected.
- App-generated backup passes.

Verification:

```powershell
cd app
cargo test
```

### EP-008: Import And Restore Refresh

Gate: Data trust.

Files:

- `app/src/features/settings/SettingsPanel.tsx`
- `app/src/App.tsx`
- E2E tests.

Scope:

- Refresh Settings module/source state after JSON import and SQLite restore.
- Add test for immediate Data Sources update.

Acceptance:

- Data Sources updates without leaving Settings.

Verification:

```powershell
cd app
npm run check:full
```

### EP-009: Provider Readiness Honesty

Gate: AI trust.

Files:

- Settings provider UI.
- Council pre-submit preview.
- Provider diagnostics wrappers if needed.
- Tests.

Scope:

- Add states: configured, will_try, verified, skipped, failed.
- Count ready only from verified diagnostics.

Acceptance:

- Unsaved key test does not imply Council readiness.
- Invalid or unreachable provider is not shown ready.

Verification:

```powershell
cd app
npm run check:full
```

### EP-010: Retrieval Fallback Visibility

Gate: Study Packet audit and AI trust.

Files:

- Council retrieval/session metadata.
- Council UI.
- Export renderer.
- Tests.

Scope:

- Persist retrieval mode.
- Persist fallback reason.
- Render fallback in UI and exports.

Acceptance:

- Semantic retrieval degradation is visible.
- Export includes retrieval mode and fallback reason.

Verification:

```powershell
cd app
npm run check:full
```

### EP-011: Accessibility Release Gate

Gate: Accessibility.

Files:

- `docs/accessibility-release-gate.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define keyboard-only Study Packet QA.
- Define focus, label, overlay, contrast, and text scaling checks.

Acceptance:

- Manual tester can follow the workflow.
- Beta blocker is explicit.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\accessibility-release-gate.md
```

### EP-012: Quality Ops And AI Risk Docs

Gate: AI safety and support.

Files:

- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define severity taxonomy.
- Define quality case schema.
- Define fixture conversion rules.
- Define release blockers.

Acceptance:

- S0, S1, and repeated S2 cases require fixture or accepted risk.
- Sensitive-topic, citation, retrieval, attribution, and tradition/lens failures are covered.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\quality-ops-plan.md docs\ai-risk-eval-plan.md
```

### EP-013: Import Budgets And Resource Quarantine

Gate: Data trust and content trust.

Dependencies:

- EP-003.

Files:

- Import code paths in Rust.
- Resource import scripts or validators.
- Tests.

Scope:

- Add JSON size, row count, body length, and field length budgets.
- Quarantine or reject unreviewed resource entries.
- Reject unknown or redistribution-negative release imports.

Acceptance:

- Oversized payload fails before transaction.
- Resource entries cannot bypass source review in release paths.

Verification:

```powershell
cd app
npm run check:full
cargo test
```

### EP-014: Tag And Stale-Link Integrity

Gate: Data integrity.

Files:

- `app/src-tauri/src/user_db.rs`
- Frontend renderers for Theology/workspace missing links if needed.
- Tests.

Scope:

- Clean note tag links on note deletion.
- Prevent tag counts from disagreeing with visible items.
- Render or clean stale Theology/workspace links.

Acceptance:

- Deleted note does not contribute to tag counts.
- Stale linked object displays clear missing-source state or is cleaned.

Verification:

```powershell
cd app
cargo test
npm run check:full
```

### EP-015: Export Audit Against Packet Contract

Gate: Study Packet v1.

Dependencies:

- EP-001.

Files:

- Workspace export renderer.
- Theology export renderer.
- Export tests.

Scope:

- Compare current export output to packet contract.
- Add missing labels and metadata.
- Record gaps as follow-up tickets.

Acceptance:

- Export audit checklist exists.
- Top export gaps are fixed or ticketed.

Verification:

```powershell
cd app
npm run check:full
```

### EP-016: Packet Manifest

Gate: Study Packet v1.

Dependencies:

- EP-001 and EP-015.

Files:

- Export renderer.
- Types.
- Tests.

Scope:

- Add `manifest.json` equivalent to folder export or embedded manifest section where folder export is not yet implemented.
- Include app, corpus, provider, retrieval, source, and export metadata.

Acceptance:

- Manifest includes required contract fields.
- Manifest contains no forbidden data.

Verification:

```powershell
cd app
npm run check:full
```

### EP-017: Packet Leak Scan

Gate: Study Packet v1 and release trust.

Files:

- Export sanitizer.
- Leak-scan script/test.

Scope:

- Scan packet exports for provider keys, gateway tokens, local paths, build paths, environment variables, and machine identifiers.

Acceptance:

- Leak scan fails on seeded bad fixture.
- Leak scan passes on sample packet.

Verification:

```powershell
cd app
npm run check:full
```

### EP-018: Sample Study Packets

Gate: Study Packet v1 and beta proof.

Dependencies:

- EP-001, EP-015, EP-016, EP-017.

Files:

- `docs/samples/study-packets/`

Scope:

- Create five sample packet folders or generated packet artifacts.
- Use deterministic sample names.

Acceptance:

- Five packet samples exist or have complete outlines.
- Each exercises a different core workflow.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\samples\study-packets
```

### EP-019: Council Cancellation Or Late-Result Suppression

Gate: AI lifecycle trust.

Files:

- Council frontend request lifecycle.
- Rust command path if applicable.
- Sidecar request lifecycle.
- Tests.

Scope:

- Add operation ids and stale result suppression at minimum.
- Add abort propagation where practical.

Acceptance:

- Timeout/cancel cannot persist stale result as current.

Verification:

```powershell
cd app
npm run check:full
node --check sidecar/index.mjs
node --check sidecar/council.mjs
```

### EP-020: Sensitive-Topic Router And Fixtures

Gate: AI safety.

Dependencies:

- EP-004 and EP-012.

Files:

- Council pre-submit routing.
- Safety fixtures.
- Tests.

Scope:

- Add local rule-based sensitive-topic classifier.
- Route sensitive prompts before normal Council generation.
- Add fixtures for sensitive categories.

Acceptance:

- Sensitive prompts do not run normal Council path.
- Fixture failures block release gate.

Verification:

```powershell
cd app
npm run check:full
```

### EP-021: Distribution, Community, And Institutional Docs

Gate: Release and beta ops.

Files:

- `docs/distribution-channel-decision.md`
- `docs/community-channel-policy.md`
- `docs/institutional-pilot-readiness.md`

Scope:

- Define private beta vs public beta distribution.
- Define community issue/support rules.
- Define institutional pilot readiness.

Acceptance:

- Public support does not solicit sensitive disclosures.
- Institutional pilots are blocked until beta and policy gates pass.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\distribution-channel-decision.md docs\community-channel-policy.md docs\institutional-pilot-readiness.md
```

### EP-022: Quality Case Schema And Fixture Runner

Gate: AI quality.

Dependencies:

- EP-012.

Files:

- Quality case schema file.
- Fixture runner script.
- Tests.

Scope:

- Add machine-readable quality case schema.
- Add fixture runner around the app's AI path where practical.

Acceptance:

- Quality case can be created from a bad AI report.
- Fixture can run in CI/local verification.

Verification:

```powershell
cd app
npm run check:full
```

### EP-023: Artifact-Bound Manual QA Evidence

Gate: Release evidence.

Files:

- Release scripts.
- Manual QA verifier.
- Release docs.

Scope:

- Manual evidence records installer names, byte counts, and SHA-256.
- Verifier compares evidence to current manifest.

Acceptance:

- Stale manual evidence fails verification.

Verification:

```powershell
cd app
npm run qa:manual-gates:verify
npm run qa:public-release:verify
```

### EP-024: Sidecar Per-File Hashing

Gate: Release evidence.

Files:

- Release manifest scripts.
- Release verifier.

Scope:

- Hash individual sidecar files, not only directory counts/totals.

Acceptance:

- File swap inside sidecar changes manifest verification result.

Verification:

```powershell
cd app
npm run release:manifest
npm run release:manifest:verify
```

### EP-025: Third-Party Notices And SBOM

Gate: Release evidence and compliance.

Files:

- Release scripts.
- Release package.
- Docs.

Scope:

- Generate notices/SBOM for bundled runtime and dependencies.
- Include Node runtime provenance.

Acceptance:

- Release package includes notices/SBOM or accepted-risk entry.

Verification:

```powershell
cd app
npm run release:package:verify
```

### EP-026: Support-Bundle Redaction Verification

Gate: Privacy and support trust.

Files:

- Support bundle script/code.
- Redaction tests.
- Privacy docs.

Scope:

- Ensure support bundles are user-initiated, reviewable, and redacted.

Acceptance:

- Seeded secret/local path fixture is redacted.
- User can inspect bundle before sending.

Verification:

```powershell
cd app
npm run check:full
```

### EP-027: Keyboard-Only Study Packet QA

Gate: Accessibility.

Dependencies:

- EP-011.

Files:

- QA docs.
- Playwright tests if added.
- Accessibility bug tickets if found.

Scope:

- Run keyboard-only Study Packet workflow.
- Record blockers and gaps.

Acceptance:

- User can complete packet path with keyboard only or blocker is documented.

Verification:

```powershell
cd app
npm run check:full
```

Manual QA evidence is required even if automated checks pass.

### EP-028: Issue Templates And Beta Support Intake

Gate: Private beta ops.

Dependencies:

- EP-021.

Files:

- `.github/ISSUE_TEMPLATE/*` if GitHub templates are used.
- `docs/community-channel-policy.md`
- Beta docs.

Scope:

- Bad AI output template.
- Source/license issue template.
- Privacy/export concern template.
- Accessibility issue template.
- Setup/provider issue template.

Acceptance:

- Templates warn users not to paste sensitive personal disclosures.

Verification:

```powershell
rg -n "sensitive|private|provider key|accessibility|source" .github docs
```

### EP-029: Beta Invitation And Criteria

Gate: Private beta.

Files:

- `docs/beta/invitation-criteria.md`

Scope:

- Define target users.
- Define non-target users.
- Define support expectations.
- Define tester prerequisites.
- Define privacy and AI limitations shown before invite acceptance.
- Define opt-out and feedback expectations.

Out of scope:

- Public marketing.
- Pricing.
- Church-wide or classroom recruitment.

Acceptance:

- Beta does not target minors, youth groups, or church-wide deployment.
- Invite criteria match the primary audience in this plan.
- Tester expectations include provider/local model setup reality.
- Tester understands the app is a study assistant, not pastoral/counseling/crisis support.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\beta
rg -n "minor|youth|church-wide|pastor|counselor|crisis|Study Packet" docs\beta
```

### EP-030: Beta Task Script

Gate: Private beta.

Files:

- `docs/beta/task-script.md`

Scope:

- Define five packet tasks.
- Define feedback prompts.
- Define issue reporting path.
- Define expected time box.
- Define what testers should not paste into reports.
- Define pass/fail observations for each task.

Required tasks:

- Hard passage packet.
- Word study packet.
- Resource critique packet.
- Small-group teaching packet.
- Theology update packet.

Out of scope:

- Open-ended feature survey.
- Pricing survey.
- Public testimonial collection.

Acceptance:

- Internal tester can complete a dry run.
- Each task maps to one sample packet type.
- Script includes "stop and report" instructions for safety, privacy, or accessibility blockers.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\beta\task-script.md
rg -n "hard passage|word study|resource critique|small-group|Theology" docs\beta\task-script.md
```

### EP-031: Feedback And Quality Intake

Gate: Private beta.

Files:

- `docs/beta/feedback-intake.md`
- `docs/beta/quality-case-mapping.md`

Scope:

- Convert beta feedback into issue types and quality cases.
- Define feedback categories.
- Define severity mapping.
- Define what becomes a fixture.
- Define when to redact, reject, or move sensitive content out of public channels.

Out of scope:

- Public community moderation tooling.
- Automated telemetry.

Acceptance:

- Bad AI report can become quality case fixture.
- Sensitive-topic reports have a safe handling path.
- Source/license reports have a source-review path.
- Accessibility reports map to accessibility gate checks.
- Setup/provider reports map to provider readiness work.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\beta\feedback-intake.md docs\beta\quality-case-mapping.md
rg -n "quality case|fixture|sensitive|source|accessibility|provider" docs\beta
```

### EP-032: Known Issues And Accepted Risks

Gate: Private beta.

Files:

- `docs/beta/known-issues.md`
- `docs/beta/accepted-risks.md`

Scope:

- List known beta limitations.
- Include accepted-risk format.
- Separate private-beta limitations from public-release blockers.
- List deferred features that testers may ask about.
- List current platform and provider caveats.

Out of scope:

- Hiding known issues to improve adoption.
- Treating hard blockers as accepted risks.

Acceptance:

- Every accepted risk has owner, revisit trigger, mitigation, and user impact.
- No hard blocker is accepted without explicit beta gate decision.
- Known issues are written in user-understandable language.

Verification:

```powershell
rg -n "[^\x00-\x7F]" docs\beta\known-issues.md docs\beta\accepted-risks.md
rg -n "owner|revisit|mitigation|user impact|hard blocker" docs\beta
```

### EP-033: Private Beta Gate Evidence Bundle

Gate: Private beta.

Files:

- `app/release/evidence/YYYY-MM-DD-HHMMSS-private-beta-gate/`

Scope:

- Assemble evidence from docs, tests, release checks, packet samples, and known issues.
- Record pass/fail for each beta readiness checklist item.
- Include command summaries.
- Include sample packet locations.
- Include accepted-risk links.
- Include manual QA notes.

Out of scope:

- Public release approval.
- Signing/notarization claims unless they are actually complete.

Acceptance:

- Gate pass/fail is clear.
- Every failed item has owner and next action.
- Evidence bundle contains no secrets or private user content.
- Private beta decision is explicitly `go`, `no-go`, or `go with accepted risks`.

Verification:

```powershell
rg -n "go|no-go|accepted risks|Study Packet|leak scan|keyboard" app\release\evidence
```

## First 30 Days

### Days 1 To 5

Work:

- EP-001.
- EP-002.
- EP-003.
- EP-004.
- EP-005.

Deliverables:

- Study Packet contract.
- Accurate architecture doc.
- Content BOM.
- Sensitive-topic policy.
- Youth/minors policy.

### Days 6 To 10

Work:

- EP-006.
- EP-007.
- EP-008.
- EP-011.
- EP-012.

Deliverables:

- Restore secret cleanup.
- Restore validation.
- Import/restore refresh.
- Accessibility gate.
- Quality ops and AI risk docs.

### Days 11 To 15

Work:

- EP-009.
- EP-010.
- EP-013.
- EP-014.

Deliverables:

- Provider readiness honesty.
- Retrieval fallback visibility.
- Import budgets/quarantine.
- Tag and stale-link integrity.

### Days 16 To 20

Work:

- EP-015.
- EP-016.
- EP-017.
- EP-019.
- EP-020.

Deliverables:

- Export audit.
- Packet manifest.
- Packet leak scan.
- Council lifecycle safety.
- Sensitive router and fixtures.

### Days 21 To 25

Work:

- EP-018.
- EP-021.
- EP-023.
- EP-024.
- EP-026.

Deliverables:

- Sample packets.
- Distribution/community/institutional docs.
- Artifact-bound QA.
- Sidecar per-file hashing.
- Support-bundle redaction verification.

### Days 26 To 30

Work:

- EP-025.
- EP-027.
- EP-028.
- EP-029.
- EP-030.
- EP-031.
- EP-032.
- EP-033.

Deliverables:

- SBOM/notices.
- Keyboard-only QA.
- Issue templates.
- Beta invite/task/feedback/known-issues docs.
- Private beta evidence bundle.

## WIP Limits

Before private beta:

- Maximum active tasks: 3.
- Maximum active code-changing tasks: 2.
- Maximum active release/security-sensitive tasks: 1.
- Maximum active AI/safety code tasks: 1.
- Maximum active canonical-doc tasks: 2.

If a task expands beyond one PR, split it before continuing.

## PR Workflow

Use this workflow for every implementation packet:

1. Confirm packet dependencies.
2. Re-read the relevant canonical docs.
3. Use `rg` to find current code paths before editing.
4. Edit the smallest file set that satisfies the packet.
5. Add or update tests for high-risk behavior.
6. Run the packet's verification commands.
7. Record evidence in the PR description or evidence folder.
8. Update canonical docs if behavior changed.
9. Leave unrelated files and pre-existing worktree changes alone.

PR description checklist:

- Packet ID.
- Gate.
- Files changed.
- User-visible behavior changed.
- Data/credential/export/provider/release/safety impact.
- Verification commands run.
- Evidence artifact.
- Known risk or accepted risk.
- Follow-up tickets.

Do not combine doc-only packets with high-risk code packets unless the code change cannot be understood without the doc change.

## Definition Of Ready

A task is ready when:

- It maps to exactly one gate.
- Dependencies are listed and satisfied.
- Likely files are named.
- Scope and out-of-scope are written.
- Acceptance criteria exist.
- Verification commands exist.
- Evidence artifact is named.
- Rollback or recovery notes exist if user data, credentials, provider calls, exports, release packaging, or safety behavior are touched.

## Definition Of Done

A task is done when:

- Implementation or doc change is complete.
- Acceptance criteria are satisfied.
- Tests or manual verification are run and recorded.
- Canonical docs are updated if behavior changed.
- Release gates are updated if affected.
- New risks are documented or accepted.
- No unrelated changes are included.

## Verification Matrix

| Area | Command or evidence |
| --- | --- |
| ASCII docs | `rg -n "[^\x00-\x7F]" docs\path.md` |
| TypeScript/frontend | `cd app; npm run check` |
| Full app checks | `cd app; npm run check:full` |
| Rust | `cd app; cargo test` |
| Sidecar syntax | `cd app; node --check sidecar/index.mjs; node --check sidecar/council.mjs` |
| Release build | `cd app; npm run release:build` |
| Release manifest | `cd app; npm run release:manifest:verify` |
| Release package | `cd app; npm run release:package:verify` |
| Public release gate | `cd app; npm run qa:public-release:verify` |
| Study Packet sample | Manual open outside app plus leak scan |
| Accessibility | Keyboard-only Study Packet walkthrough |

## Evidence Bundle Structure

When a gate requires collected evidence, use this folder layout:

```text
app/release/evidence/YYYY-MM-DD-HHMMSS-gate-name/
  README.md
  commands.txt
  results.md
  artifacts/
  screenshots/
  redaction-notes.md
  accepted-risks.md
```

`README.md` should include:

- Gate name.
- App version.
- Git commit or working-tree note.
- Operator.
- Machine/profile type.
- Date and timezone.
- Commands run.
- Pass/fail summary.
- Known gaps.

`commands.txt` should include the exact commands run.

`results.md` should include the significant output summary, not secrets or private content.

Evidence must never include:

- Provider API keys.
- Managed gateway tokens.
- Raw private notes.
- Raw pastoral, mental-health, legal, medical, or identifying user disclosures.
- Local profile DBs unless explicitly sanitized and intended for local-only QA.
- `.env` files.

## Test Data And Fixture Strategy

Use deterministic, small fixtures.

Fixture families:

- Restore fixtures:
  - valid app-generated backup
  - minimal wrong DB
  - legacy secret DB
  - newer schema DB
  - corrupted DB
- Import fixtures:
  - oversized JSON
  - oversized resource body
  - unknown license resource
  - redistribution-negative resource
  - accepted source resource
- Study Packet fixtures:
  - hard passage
  - word study
  - resource critique
  - small-group teaching
  - Theology update
- AI quality fixtures:
  - fabricated citation
  - hidden disagreement
  - missing primary passage
  - retrieval false positive
  - retrieval false negative
  - tradition/lens overclaim
- Sensitive-topic fixtures:
  - self-harm
  - abuse
  - child safety
  - medical or mental health
  - legal or financial
  - pastoral emergency
  - spiritual abuse or coercion

Fixture rules:

- Keep fixtures synthetic unless a real user explicitly consents to use sanitized content.
- Do not include private pastoral disclosures.
- Do not include real provider keys.
- Keep fixture names stable.
- Make expected behavior explicit.

## Decision Points

Some decisions should be revisited only after evidence exists.

| Decision | Revisit trigger | Default before trigger |
| --- | --- | --- |
| Add `sqlite-vec` | Measured vector search latency or scale problem | Do not add |
| Add Tantivy | SQLite FTS/resource search cannot meet target latency or ranking quality | Do not add |
| Add LanceDB | Resource/vector volume exceeds SQLite design comfort | Do not add |
| Add Tauri updater | Signed release, rollback, hosted update JSON, and support path are mature | Do not add |
| Add managed gateway subscription | Beta evidence shows demand plus cost/privacy/support model is understood | Do not add |
| Add public community forum | Moderation and sensitive-disclosure policy are ready | Do not add |
| Add institutional pilot | Private beta sample packets and support path are ready | Do not add |
| Add youth/classroom mode | Youth/minors policy, consent/data-flow review, and supervision model exist | Do not add |
| Add modern translations | Explicit redistribution rights are obtained | Do not add |

## Go/No-Go Checklists

### Private Beta Go/No-Go

Go only if:

- Gate 1 docs exist.
- Gate 2 restore/import hardening is complete or accepted-risk.
- One Study Packet sample exists.
- Export leak scan passes.
- Provider readiness is honest.
- Retrieval fallback is visible.
- Sensitive-topic router and fixtures pass.
- Keyboard-only Study Packet QA has been run.
- Support intake is ready.
- Known issues and accepted risks are documented.

No-go if:

- Any hard blocker is true.
- Evidence is missing for a completed gate.
- The beta task script is not ready.
- Support intake asks for private sensitive disclosures.
- The app cannot produce a useful packet outside the app.

Decision record:

```text
Decision: go | no-go | go with accepted risks
Date:
Operator:
Evidence folder:
Accepted risks:
Failed checks:
Next action:
```

### Public Beta Go/No-Go

Go only if all private beta criteria are satisfied plus:

- Manual QA evidence is tied to current artifact hashes.
- Release package verification passes.
- Third-party notices/SBOM are generated or accepted-risk.
- Public release notes include platform warnings, checksums, known issues, and privacy notes.
- Support-bundle redaction is verified.

No-go if:

- Manual evidence is stale.
- Release artifact identity is unclear.
- Packages include local secrets, `.env`, local profile DBs, or manual evidence.
- Public issue templates or support channels are not ready.

### Institutional Pilot Go/No-Go

Go only if all private beta criteria are satisfied plus:

- Institutional readiness doc exists.
- Sample packets exist.
- Accessibility baseline and known gaps are documented.
- Youth/minors use is explicitly out of scope unless separate review exists.
- Support and incident path exists.

No-go if:

- The pilot requires church-wide deployment, youth/classroom use, sync, collaboration, or admin features.
- Data movement cannot be explained clearly.
- Support ownership is unclear.

## Hard Blockers

Do not invite private beta users if any are true:

- No Study Packet contract.
- Restore can accept wrong/minimal DB.
- Restored legacy secrets can remain in SQLite after success.
- Export leak scan fails.
- Sensitive-topic prompt enters normal Council flow.
- Provider readiness remains misleading.
- No safe bad-AI-output intake path.
- Keyboard-only user cannot complete the core packet path.
- No known issues or accepted-risk record exists.

## Accepted Risk Format

Every accepted risk must include:

- Risk statement.
- User impact.
- Why it is acceptable now.
- Mitigation.
- Owner.
- Expiration date or revisit trigger.
- Gate affected.

Accepted risks must be documented. Do not bury them in PR comments.

## Issue Labels

Use these labels:

- `gate:source-of-truth`
- `gate:data-trust`
- `gate:study-packet`
- `gate:ai-safety-quality`
- `gate:release-accessibility`
- `gate:private-beta`
- `type:canonical-doc`
- `type:code-hardening`
- `type:test`
- `type:release`
- `type:sample-packet`
- `risk:secrets`
- `risk:data-loss`
- `risk:sensitive-topic`
- `risk:source-rights`
- `risk:accessibility`
- `status:blocked`
- `status:accepted-risk`
- `defer:post-beta`

## Stop List

Do not start these before private beta:

- Mobile app.
- Cloud sync.
- Collaboration.
- Church admin.
- Public community forum.
- Youth/classroom mode.
- Pricing implementation.
- Public marketing site.
- Module marketplace.
- Modern translation licensing implementation.
- Tauri updater.
- New vector database migration.
- AI prayer/devotional companion.

## Beta Readiness Checklist

Private beta requires:

- Study Packet v1 contract complete.
- Content BOM complete enough for bundled sources.
- Sensitive-topic policy complete.
- Youth/minors policy complete.
- Accessibility gate complete.
- Quality ops plan complete.
- Restore/import hardening complete or accepted-risk.
- Provider readiness honest.
- Retrieval fallback visible.
- Sensitive router and fixtures pass.
- Packet export leak scan passes.
- Sample packet exists.
- Keyboard-only Study Packet QA run.
- Support intake ready.
- Known issues and accepted risks documented.

## Implementation Start

Start with:

1. `EP-001`: create `docs/study-packet-v1-contract.md`.
2. `EP-002`: update `docs/architecture.md` for current vector implementation.
3. `EP-003`: create `docs/content-bom.md`.
4. `EP-004`: create `docs/sensitive-topic-safety-policy.md`.
5. `EP-005`: create `docs/youth-and-minors-policy.md`.

The first code work should be:

1. `EP-006`: restore secret cleanup.
2. `EP-007`: restore identity validation.
3. `EP-008`: import/restore refresh.

## Change Control

Change this plan only when:

- A hard blocker is discovered.
- A dependency is wrong.
- A beta user finding invalidates an assumption.
- A release gate is too weak.
- A task is proven unnecessary.

Each plan change should state:

- What changed.
- Why it changed.
- Which gate changed.
- Which packets moved.
- Whether beta criteria changed.

## Operating Cadence

Use this cadence until private beta:

Daily:

- Check WIP limits.
- Confirm each active item maps to a gate.
- Move blocked work out of active.

Twice weekly:

- Review hard blockers.
- Review accepted-risk proposals.
- Review evidence gaps.
- Re-rank next packets if a dependency changed.

Weekly:

- Update gate status.
- Run available verification for completed packets.
- Update known issues.
- Update sample packet progress.
- Confirm no deferred feature has drifted into active work.

Before any beta invite:

- Run the private beta go/no-go checklist.
- Confirm evidence folder exists.
- Confirm known issues and accepted risks are current.
- Confirm support intake and feedback triage are ready.

## Bottom Line

The next development cycle is not a feature sprint. It is a trust and implementation sprint around Study Packet v1.

Build the canonical docs first, then harden restore/import and provider/retrieval honesty, then implement packet export guarantees, then add safety and release gates, then run a narrow private beta.

The immediate next action is `EP-001`: create `docs/study-packet-v1-contract.md`.
