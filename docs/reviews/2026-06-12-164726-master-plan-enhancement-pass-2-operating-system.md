# Bible AI master plan enhancement pass 2: execution operating system

Generated: 2026-06-12 16:47:25 +01:00

Filename timestamp: 2026-06-12-164726

Enhances:

- `docs/reviews/2026-06-12-163356-comprehensive-research-synthesis-and-master-plan.md`
- `docs/reviews/2026-06-12-164417-master-plan-enhancement-pass.md`

Repository: C:\JM Programs\BibleApp

Purpose: Add a stricter execution operating system around the master plan: dependency DAG, PR slicing, WIP limits, evidence requirements, readiness definitions, test matrix, decision rules, and 30-day execution board.

## What this pass adds

The previous enhancement pass made the plan executable. This pass makes it harder to mis-execute.

The plan now needs an operating layer with:

1. A single north-star artifact.
2. A dependency graph.
3. A board structure.
4. Definition of Ready and Definition of Done.
5. PR sizing rules.
6. Evidence requirements.
7. WIP limits.
8. Scope-control rules.
9. A test matrix.
10. A 30-day execution board.

Without these controls, the plan can fail in a predictable way: every item is correct, but too many correct items are started at once.

## North-star artifact

The north-star artifact is:

> A Study Packet created from a clean install, with user-authored judgment, source-attributed evidence, visible retrieval behavior, no leaked secrets, safe handling of sensitive prompts, keyboard-only completion, and exportable Markdown that remains useful outside the app.

Everything in the next phase should support that artifact.

## Operating rule

Use this rule for every task:

> No task enters active work unless it has a direct path to Study Packet trust, data trust, safety, accessibility, content rights, release evidence, or beta learning.

If the path is indirect or speculative, the task goes to `Later`.

## Dependency DAG

### Root dependency

`D0: Study Packet v1 contract`

Everything depends on this because it defines the product unit being hardened.

### Dependency graph

| ID | Work item | Depends on | Unlocks |
| --- | --- | --- | --- |
| D0 | Study Packet v1 contract | none | export audit, sample packets, beta task script |
| D1 | Architecture drift correction | none | accurate technical docs, search decisions |
| D2 | Content BOM | none | resource import rules, source release gate |
| D3 | Sensitive-topic policy | none | safety router, safety fixtures |
| D4 | Youth/minors policy | none | beta/institutional boundary |
| D5 | Accessibility gate | D0 | keyboard-only packet QA |
| D6 | Quality ops plan | D0, D3 | quality cases, eval fixtures |
| D7 | Distribution decision doc | D0 | release evidence, beta package |
| D8 | Community channel policy | D3, D6 | issue templates, support intake |
| D9 | Institutional readiness doc | D0, D3, D4, D5, D7 | institutional pilot later |
| C1 | Restore secret cleanup | none | data trust gate |
| C2 | Restore identity validation | none | data trust gate |
| C3 | Import/restore refresh | none | data trust gate |
| C4 | Import budgets | D2 | resource/data trust gate |
| C5 | Resource quarantine | D2 | content trust gate |
| C6 | Tag/stale-link cleanup | none | data integrity |
| A1 | Provider readiness model | none | AI trust gate |
| A2 | Retrieval fallback visibility | D0 | packet audit |
| A3 | Council cancellation/late-result suppression | none | AI lifecycle trust |
| A4 | Sensitive-topic router | D3, D6 | safety gate |
| A5 | Safety fixtures | D3, D6 | release blocker |
| R1 | Artifact-bound manual QA | D7 | release gate |
| R2 | Sidecar per-file hashes | D7 | release gate |
| R3 | SBOM/third-party notices | D7 | release gate |
| R4 | Support-bundle redaction verification | D7, D8 | support trust |
| B1 | Sample hard passage packet | D0, A2 | beta proof |
| B2 | Sample word study packet | D0 | beta proof |
| B3 | Sample resource critique packet | D0, D2, C5 | content/safety proof |
| B4 | Sample teaching packet | D0 | beta proof |
| B5 | Sample Theology update packet | D0, C6 | learning proof |

### Critical path

The shortest useful path to private beta is:

1. D0: Study Packet v1 contract.
2. D1: Architecture drift correction.
3. D2: Content BOM.
4. D3: Sensitive-topic policy.
5. C1/C2/C3: restore/import trust.
6. A1/A2: provider and retrieval honesty.
7. A4/A5: safety router and fixtures.
8. D5: accessibility gate.
9. R1/R4: release evidence and support redaction.
10. B1 to B5: sample packets.

## Board structure

Use these columns:

1. `Inbox`
2. `Needs shaping`
3. `Ready`
4. `Active`
5. `Review`
6. `Verification`
7. `Done`
8. `Blocked`
9. `Later`
10. `Explicitly rejected`

Column meanings:

- `Inbox`: captured idea, no commitment.
- `Needs shaping`: valuable but missing acceptance criteria or dependencies.
- `Ready`: has owner, scope, acceptance, tests, and dependencies satisfied.
- `Active`: currently being worked.
- `Review`: code/doc written, needs review.
- `Verification`: review done, tests/evidence pending.
- `Done`: merged, verified, evidence attached.
- `Blocked`: cannot proceed without a named dependency.
- `Later`: intentionally deferred.
- `Explicitly rejected`: conflicts with strategy or trust gates.

## WIP limits

Use strict WIP limits until private beta:

- `Active`: maximum 3 total.
- Code-changing `Active`: maximum 2.
- Release/security-sensitive `Active`: maximum 1.
- Canonical-doc `Active`: maximum 2.
- AI/safety code `Active`: maximum 1.

Reason:

- The app is trust-sensitive.
- Half-finished safety or restore changes are worse than deferred work.
- The plan already has enough breadth; the risk is starting too much.

## Definition of Ready

A task is ready only if all are true:

- It maps to one execution gate.
- It has an explicit dependency list.
- It has a bounded file/code area.
- It has acceptance criteria.
- It has verification steps.
- It has an evidence artifact.
- It states whether it changes user data, exports, provider calls, release packaging, or safety behavior.
- It states rollback or recovery considerations if it touches data or release paths.

## Definition of Done

A task is done only if all are true:

- Implementation or doc change is complete.
- Acceptance criteria are satisfied.
- Tests or manual verification are run and recorded.
- Any release gate affected by the task is updated.
- Any canonical doc affected by the task is updated.
- Any new risk is added to a known-risk or accepted-risk location.
- No unrelated changes were included.

## Evidence requirements by task type

| Task type | Required evidence |
| --- | --- |
| Canonical doc | New/updated file, source cross-links, ASCII check |
| Architecture doc drift | Doc diff plus code/source reference confirming current behavior |
| Restore/import code | Rust tests or E2E, before/after behavior, failure message |
| Credential handling | Test showing no secret remains in SQLite after path completes |
| Export/packet | Sample export, leak scan, source/user/AI labeling check |
| Content/source | Source assessment, BOM entry, attribution/export rule |
| Safety router | Fixture set with expected route, release-blocking result |
| Provider readiness | UI state test and diagnostic-state test |
| Retrieval visibility | Session/export includes retrieval mode and fallback reason |
| Release evidence | Manifest hash match, installer identity, package scan |
| Accessibility | Keyboard-only walkthrough evidence and known gaps |
| Beta ops | Invite script, task script, feedback template, triage checklist |

## PR slicing rules

### Good PR sizes

- One canonical doc plus link updates.
- One restore/import behavior plus tests.
- One provider-state behavior plus UI/test update.
- One export metadata addition plus leak test.
- One release script improvement plus verifier test.

### Bad PR sizes

- Multiple canonical docs plus code changes.
- Restore validation plus export changes plus provider UI.
- Safety router plus large prompt rewrites plus beta docs.
- Release packaging plus app UI changes.
- Anything that requires more than one unrelated manual QA path.

## First 10 PR sequence

### PR 1: Study Packet contract

Files:

- `docs/study-packet-v1-contract.md`
- Link from `docs/feature-roadmap.md`

Verification:

- ASCII scan.
- Contract includes layout, manifest, required metadata, forbidden data, five acceptance cases.

### PR 2: Architecture drift correction

Files:

- `docs/architecture.md`
- Optional link to `docs/data-sources.md`

Verification:

- No canonical doc claims `sqlite-vec` is current runtime.
- Current BLOB/cosine implementation is described.

### PR 3: Content BOM and source classes

Files:

- `docs/content-bom.md`
- `docs/data-sources.md`

Verification:

- Current bundled sources have BOM placeholders or entries.
- Release rule for missing BOM entries is explicit.

### PR 4: Sensitive-topic and youth boundaries

Files:

- `docs/sensitive-topic-safety-policy.md`
- `docs/youth-and-minors-policy.md`
- `docs/privacy-and-distribution.md`

Verification:

- Policy includes taxonomy, routing behavior, and explicit non-role claims.
- Youth/minors policy blocks v0.1 youth/classroom use.

### PR 5: Restore secret cleanup

Files:

- Rust restore path.
- Restore tests.

Verification:

- Legacy provider secret in restored DB is migrated/removed before success.
- Test fails before fix and passes after fix.

### PR 6: Restore identity validation

Files:

- Rust restore validation.
- Restore tests.

Verification:

- Minimal DB with only `app_settings` is rejected.
- App-generated backup still restores.

### PR 7: Import/restore state refresh

Files:

- Settings/app refresh path.
- E2E or integration test.

Verification:

- Data Sources updates immediately after import/restore.

### PR 8: Quality ops and AI risk plan

Files:

- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- Links from `docs/testing-and-release-plan.md`

Verification:

- Quality case schema and fixture conversion rules are defined.

### PR 9: Provider readiness honesty

Files:

- Provider diagnostics UI/state code.
- Tests.

Verification:

- `ready` requires verified diagnostic success.
- Unsaved test cannot imply saved runtime readiness.

### PR 10: Retrieval fallback visibility

Files:

- Retrieval/session metadata.
- Council UI/export rendering.
- Tests.

Verification:

- Semantic fallback reason is visible in UI and exported packet.

## 30-day execution board

This is a practical schedule, not a guarantee.

### Days 1 to 3

- PR 1: Study Packet contract.
- PR 2: architecture drift correction.
- Shape PR 3 and PR 4.

Expected evidence:

- Contract file exists.
- Architecture doc is no longer misleading.

### Days 4 to 7

- PR 3: content BOM.
- PR 4: sensitive-topic and youth boundaries.
- Start PR 5 restore secret cleanup.

Expected evidence:

- Source decision classes exist.
- Safety policy exists before router work starts.

### Days 8 to 12

- PR 5: restore secret cleanup.
- PR 6: restore identity validation.
- Start PR 7 import/restore refresh.

Expected evidence:

- Restore path cannot reintroduce secrets.
- Wrong/minimal DB is rejected.

### Days 13 to 16

- PR 7: import/restore refresh.
- PR 8: quality ops and AI risk plan.
- Shape provider readiness work.

Expected evidence:

- Settings state refreshes after data operations.
- Quality case schema exists.

### Days 17 to 21

- PR 9: provider readiness honesty.
- PR 10: retrieval fallback visibility.
- Create accessibility gate doc.

Expected evidence:

- Provider UI is less optimistic.
- Retrieval fallback appears in sessions/exports.

### Days 22 to 26

- Implement sensitive-topic router and fixtures.
- Add first Study Packet sample.
- Add import budgets/resource quarantine if not already done.

Expected evidence:

- Sensitive prompts do not run normal Council path.
- One sample packet exists.

### Days 27 to 30

- Add keyboard-only Study Packet QA.
- Add release evidence binding plan or first verifier patch.
- Create remaining sample packet outlines.
- Run private-beta gate scorecard.

Expected evidence:

- The team can honestly say which gate blocks beta.

## Test matrix by gate

### Gate 1 tests

- ASCII scan for new docs.
- Link check by `rg` for required doc names.
- `rg "sqlite-vec"` review to confirm it is not described as current runtime.

### Gate 2 tests

- Restore legacy secret migration test.
- Restore wrong DB rejection test.
- Restore app-generated backup success test.
- Import oversized JSON rejection test.
- Resource unreviewed import quarantine/rejection test.
- Data Sources immediate refresh E2E.

### Gate 3 tests

- Packet sample generation.
- Packet leak scan.
- Packet Markdown opens outside app.
- Packet contains user/AI/source labels.
- Packet contains retrieval mode and fallback reason.

### Gate 4 tests

- Sensitive-topic fixture suite.
- Provider readiness UI tests.
- Retrieval fallback tests.
- Cancellation/late-result test.
- Quality case fixture conversion test.

### Gate 5 tests

- Artifact-bound manual QA verifier.
- Sidecar per-file hash verifier.
- SBOM/notice generation check.
- Support-bundle redaction check.
- Keyboard-only Study Packet manual QA.

### Gate 6 tests

- Beta dry-run with one internal tester.
- Feedback form dry-run.
- Bad AI output triage dry-run.
- Known issues review.

## Decision scoring

Use this score for any proposed task:

| Question | Points |
| --- | --- |
| Directly improves Study Packet v1 | 3 |
| Reduces user data loss or secret leakage | 3 |
| Blocks unsafe AI behavior | 3 |
| Improves export/source trust | 2 |
| Improves release evidence | 2 |
| Improves accessibility of packet path | 2 |
| Improves beta learning quality | 1 |
| Adds a non-essential feature | -2 |
| Adds support burden before beta | -2 |
| Requires cloud/sync/account assumptions | -3 |
| Touches minors/youth use before policy | -5 |

P0 requires score 3 or higher and no negative hard blocker.

## Hard blockers

Any one of these blocks private beta:

- No Study Packet contract.
- Restore can accept wrong/minimal DB.
- Restored legacy secrets can remain in SQLite after success.
- Export leak scan fails.
- Sensitive-topic prompt enters normal Council flow.
- Provider readiness remains misleading.
- No safe bad-AI-output intake path.
- Keyboard-only user cannot complete the core packet path.

## Accepted-risk rules

An accepted risk must include:

- Risk statement.
- User impact.
- Why it is acceptable now.
- Expiration date or revisit trigger.
- Mitigation.
- Owner.

Do not accept risks silently inside PR discussion. Put them in a doc or release evidence file.

## Beta issue taxonomy

Every beta issue should be tagged as one of:

- `data-trust`
- `secret-handling`
- `study-packet`
- `ai-quality`
- `sensitive-topic`
- `retrieval`
- `source-rights`
- `accessibility`
- `provider-setup`
- `release-install`
- `support-bundle`
- `documentation`
- `deferred-feature`

This prevents beta feedback from turning into a general feature request pool.

## User story map for private beta

### Backbone

1. Install.
2. Configure provider or local model.
3. Open passage.
4. Ask/research.
5. Review evidence.
6. Add judgment.
7. Export packet.
8. Report issue if needed.

### P0 user stories

- As a serious learner, I can produce a packet for a hard passage and see why positions differ.
- As a small-group teacher, I can export a packet that is readable without the app.
- As a privacy-conscious user, I can understand what leaves my machine.
- As a user with keyboard-only navigation needs, I can complete the packet path.
- As a beta tester, I can report a bad AI output without exposing secrets or unnecessary private content.

### Non-P0 user stories

- As a church admin, I can manage users.
- As a group, we can collaborate on shared packets.
- As a mobile user, I can read packets on my phone in-app.
- As a user, I can sync packets through the cloud.
- As a user, I can access modern copyrighted translations bundled in the app.

## Operating cadence

### Daily

- Check active WIP limit.
- Confirm each active task still maps to a gate.
- Move blocked items out of active quickly.

### Twice weekly

- Review gate scorecard.
- Review newly discovered risks.
- Review any accepted-risk proposals.

### Weekly

- Run verification for completed code changes.
- Update known issues.
- Update sample packet status.
- Re-rank next tasks using decision scoring.

### Before any beta invite

- Run the red/yellow/green check.
- Confirm hard blockers are absent.
- Confirm known issues are honest.
- Confirm support intake is ready.

## Anti-patterns to avoid

- Writing all canonical docs in one huge PR.
- Starting safety router before writing safety policy.
- Starting beta before restore hardening.
- Treating source attribution as export polish.
- Treating accessibility as post-beta cleanup.
- Treating provider setup confusion as user error.
- Adding more content before content BOM rules.
- Fixing prompts without fixtures.
- Building public release scripts without clean-profile evidence.
- Starting institutional conversations before sample packets exist.

## Final pass 2 recommendation

The next concrete action should be PR 1: create `docs/study-packet-v1-contract.md`.

After that, do PR 2 and PR 3 before touching larger code paths. This order gives the team a stable definition of the product artifact, fixes known architecture drift, and creates the rights framework needed for export trust.

This second enhancement pass makes the plan operational: one artifact, one gate sequence, strict WIP limits, small PRs, required evidence, and hard blockers. The work should now move from research and planning into controlled execution.
