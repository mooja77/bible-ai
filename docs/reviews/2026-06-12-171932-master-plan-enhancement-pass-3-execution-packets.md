# Bible AI master plan enhancement pass 3: execution packets

Generated: 2026-06-12 17:19:36 +01:00

Filename timestamp: 2026-06-12-171932

Enhances:

- `docs/reviews/2026-06-12-163356-comprehensive-research-synthesis-and-master-plan.md`
- `docs/reviews/2026-06-12-164417-master-plan-enhancement-pass.md`
- `docs/reviews/2026-06-12-164726-master-plan-enhancement-pass-2-operating-system.md`

Repository: C:\JM Programs\BibleApp

Purpose: Convert the plan into concrete execution packets that can be picked up one at a time. This pass defines the first work packets, review checklists, verification evidence, artifact names, issue labels, and triage rules needed to begin execution without reopening strategic debate.

## Summary

The prior plan artifacts are now strong enough. The remaining improvement is to package the work so it can actually start.

This pass adds:

1. Execution packet format.
2. First 12 ready-to-shape packets.
3. Exact artifact naming.
4. Review checklists.
5. Verification bundles.
6. Risk and blocker triage rules.
7. Suggested issue labels.
8. Change-control rules for the plan itself.
9. A first-week checklist.

The practical next action remains: create `docs/study-packet-v1-contract.md`.

## Execution packet format

Each execution packet should have this shape:

```text
Packet ID:
Title:
Gate:
Why now:
Dependencies:
Files likely touched:
Scope:
Out of scope:
Acceptance criteria:
Verification:
Evidence artifact:
Rollback/recovery:
Risks:
Follow-up tickets:
```

Rules:

- One packet should fit in one PR unless explicitly marked as a larger milestone.
- A packet must have a gate.
- A packet must name evidence.
- A packet that touches user data, credentials, provider calls, exports, release packaging, or safety must include rollback/recovery notes.

## Artifact naming conventions

### Canonical docs

Use stable names without timestamps:

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

### Review and planning docs

Use timestamped names under `docs/reviews/`, as done in this research sequence.

Format:

```text
YYYY-MM-DD-HHMMSS-short-topic.md
```

### Evidence bundles

Use timestamped evidence folders when generated:

```text
app/release/evidence/YYYY-MM-DD-HHMMSS-private-beta-gate/
app/release/evidence/YYYY-MM-DD-HHMMSS-public-release-gate/
app/release/evidence/YYYY-MM-DD-HHMMSS-study-packet-samples/
```

### Sample packets

Use deterministic names:

```text
docs/samples/study-packets/001-hard-passage/
docs/samples/study-packets/002-word-study/
docs/samples/study-packets/003-resource-critique/
docs/samples/study-packets/004-small-group-teaching/
docs/samples/study-packets/005-theology-update/
```

## First 12 execution packets

### EP-001: Study Packet v1 contract

Gate: Canonical source of truth.

Why now: This defines the north-star artifact and prevents export, QA, beta, and safety work from aiming at different targets.

Dependencies: none.

Files likely touched:

- `docs/study-packet-v1-contract.md`
- `docs/feature-roadmap.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define packet purpose.
- Define folder layout.
- Define required Markdown files.
- Define `manifest.json` fields.
- Define required metadata.
- Define AI/source/user labeling rules.
- Define forbidden data.
- Define the five acceptance cases.

Out of scope:

- Code changes.
- Export renderer changes.
- Sample packet generation.

Acceptance criteria:

- Contract names every required packet section.
- Contract names required metadata: app version, corpus version, provider/model summary, retrieval mode, fallback reason, source rights, user/AI labels.
- Contract states forbidden data: provider keys, gateway tokens, local paths, build paths, environment variables, machine identifiers.
- Contract defines five acceptance cases.
- Roadmap links to the contract.

Verification:

- ASCII scan.
- `rg "study-packet-v1-contract" docs` shows expected links.
- Manual review against master plan.

Evidence artifact:

- The created doc and command transcript summary.

Rollback/recovery:

- Doc-only change; revert by removing the doc and link edits.

Risks:

- Overdesigning packet schema before implementation. Keep v1 minimal and explicit.

Follow-up tickets:

- Export audit against contract.
- Sample packet creation.

### EP-002: Architecture vector-store correction

Gate: Canonical source of truth.

Why now: Current docs still imply `sqlite-vec` is the vector store; implementation uses SQLite BLOB embeddings and Rust cosine scan.

Dependencies: none.

Files likely touched:

- `docs/architecture.md`
- optionally `docs/data-sources.md`

Scope:

- Replace current vector-store claim.
- State actual runtime behavior.
- List `sqlite-vec` as future feature-flag option only.
- Preserve local-first search thesis.

Out of scope:

- Search implementation changes.
- Benchmarking.
- New vector dependencies.

Acceptance criteria:

- No canonical doc describes `sqlite-vec` as current runtime.
- Current BLOB/cosine path is documented.
- Future search options are framed as measurement-driven.

Verification:

- `rg -n "sqlite-vec|BLOB|cosine" docs`
- Manual check against current implementation references.

Evidence artifact:

- Doc diff and search output summary.

Rollback/recovery:

- Doc-only change.

Risks:

- Accidentally implying current search is lower quality. Phrase as deliberate simplicity until metrics justify change.

Follow-up tickets:

- Search measurement plan.

### EP-003: Content BOM and source decision classes

Gate: Content rights and source trust.

Why now: Study Packet exports are only trustworthy if sources and attribution rules are explicit.

Dependencies: none.

Files likely touched:

- `docs/content-bom.md`
- `docs/data-sources.md`
- `docs/open-resource-ingestion-plan.md`

Scope:

- Define source decision classes.
- Define BOM fields.
- Add current bundled source table or placeholder entries.
- State release rule: bundled sources must exist in BOM.
- State user-imported resource handling.

Out of scope:

- Code-level manifest validation.
- New content import.

Acceptance criteria:

- BOM includes current bundled translations/resources or a table ready to be completed.
- Decision classes match master plan.
- Export attribution implications are stated.

Verification:

- ASCII scan.
- `rg "content-bom|source decision|bundled_redistributable" docs`

Evidence artifact:

- Content BOM doc.

Rollback/recovery:

- Doc-only change.

Risks:

- Too much legal detail. Keep this as engineering/source governance, not legal advice.

Follow-up tickets:

- Resource manifest validation update.
- Release gate for missing BOM entries.

### EP-004: Sensitive-topic safety policy

Gate: Trust and safety.

Why now: Safety router implementation should not begin until the policy exists.

Dependencies: none.

Files likely touched:

- `docs/sensitive-topic-safety-policy.md`
- `docs/privacy-and-distribution.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define app non-roles.
- Define sensitive-topic taxonomy.
- Define routing behavior before Council generation.
- Define response posture for crisis, abuse, child safety, medical/mental health, legal/financial, and pastoral emergency prompts.
- Define fixture requirement.

Out of scope:

- Router code.
- Legal advice.
- Locale-specific crisis resource database.

Acceptance criteria:

- Policy explicitly says app is not pastor, counselor, emergency service, doctor, lawyer, or financial advisor.
- Policy defines release-blocking fixture behavior.
- Policy states sensitive prompts do not enter normal Council generation.

Verification:

- ASCII scan.
- Manual review against trust/safety research.

Evidence artifact:

- Safety policy doc.

Rollback/recovery:

- Doc-only change.

Risks:

- Overpromising safety. Policy should define conservative behavior and limitations.

Follow-up tickets:

- Rule-based router.
- Safety fixtures.

### EP-005: Youth and minors policy

Gate: Trust and institutional boundary.

Why now: Prevents accidental youth/classroom positioning before data and consent rules exist.

Dependencies: none.

Files likely touched:

- `docs/youth-and-minors-policy.md`
- `docs/institutional-pilot-readiness.md` later

Scope:

- State v0.1 is not child-directed.
- Block youth group and classroom pilots.
- Define future review requirements.

Out of scope:

- Age gates.
- Consent implementation.
- Youth features.

Acceptance criteria:

- Policy blocks youth/minor marketing for v0.1.
- Policy says no under-13 path.
- Policy says future youth use requires separate data-flow and consent review.

Verification:

- ASCII scan.
- Link from institutional readiness later.

Evidence artifact:

- Youth policy doc.

Rollback/recovery:

- Doc-only change.

Risks:

- Adding age collection prematurely. Avoid it unless implementation requires it.

Follow-up tickets:

- Institutional pilot readiness doc.

### EP-006: Restore secret cleanup

Gate: Data integrity and local trust.

Why now: Restored legacy provider secrets must not remain in active SQLite after success.

Dependencies: none.

Files likely touched:

- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/user_db.rs`
- Rust tests in the existing test location

Scope:

- After restore opens restored DB, run shared credential migration and secret cleanup before success.
- Add regression test.

Out of scope:

- Full restore UI redesign.
- Import budgets.
- Schema validation beyond what is needed for secret cleanup.

Acceptance criteria:

- Test restores DB with legacy secret rows.
- After restore success, active DB has no provider secret rows.
- Vault migration behavior remains intact.

Verification:

- Targeted Rust test.
- `cargo test` for relevant module if practical.

Evidence artifact:

- Test output summary.

Rollback/recovery:

- Restore creates safety backup before replacement; ensure cleanup failure leaves clear error or safe state.

Risks:

- Credential migration side effects. Keep helper shared with normal settings load behavior.

Follow-up tickets:

- Restore identity validation.

### EP-007: Restore identity validation

Gate: Data integrity and local trust.

Why now: Restore should reject unrelated SQLite files that only resemble app DBs.

Dependencies:

- Prefer after EP-006, but can be parallel if scoped carefully.

Files likely touched:

- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/user_db.rs`
- Restore tests

Scope:

- Require app-specific schema markers/tables/version identity.
- Reject minimal DB with only `app_settings`.
- Keep app-generated backup restore passing.

Out of scope:

- Native file picker.
- Selective restore.

Acceptance criteria:

- Wrong/minimal DB test fails restore.
- App-generated backup test passes.
- Error message is clear.

Verification:

- Targeted Rust tests.

Evidence artifact:

- Test output summary.

Rollback/recovery:

- Validation happens before replacement.

Risks:

- Rejecting older legitimate backups. Include version compatibility rule.

Follow-up tickets:

- Restore file picker.

### EP-008: Import/restore refresh

Gate: Data integrity and local trust.

Why now: After import/restore, Settings-owned data can be stale, which makes users distrust data operations.

Dependencies: none.

Files likely touched:

- `app/src/features/settings/SettingsPanel.tsx`
- `app/src/App.tsx`
- E2E test file

Scope:

- Refresh Settings resource/module state after JSON import and SQLite restore.
- Ensure active app state updates where relevant.
- Add test checking Data Sources updates immediately.

Out of scope:

- Import budgets.
- Restore validation.

Acceptance criteria:

- Data Sources view updates without leaving Settings.
- Existing import/restore tests still pass.

Verification:

- E2E or integration test.
- `npm run check:full` if feasible.

Evidence artifact:

- Test output summary.

Rollback/recovery:

- Frontend refresh-only change; revert if it causes lifecycle issues.

Risks:

- Double refresh or stale race. Keep refresh helper explicit.

Follow-up tickets:

- App DB generation/remount key if needed.

### EP-009: Provider readiness honesty

Gate: AI trust.

Why now: Users scan readiness summaries, not diagnostic details. Optimistic readiness damages trust.

Dependencies: none.

Files likely touched:

- Settings provider UI.
- Council pre-submit preview.
- Sidecar diagnostics wrappers if needed.
- Tests.

Scope:

- Split states: `configured`, `will_try`, `verified`.
- Count ready/tested only from diagnostics success.
- Handle unsaved draft tests without implying runtime readiness.

Out of scope:

- New providers.
- Gateway pricing.
- Provider prompt changes.

Acceptance criteria:

- Missing/invalid provider is not shown ready.
- Unsaved key test does not make Council preview ready.
- UI copy distinguishes configured vs verified.

Verification:

- UI tests or E2E.
- Manual Settings path review.

Evidence artifact:

- Test output and before/after screenshot if useful.

Rollback/recovery:

- UI/state labeling change; keep underlying provider config unchanged.

Risks:

- Confusing users with too many states. Use plain labels.

Follow-up tickets:

- Scoped provider test buttons.

### EP-010: Retrieval fallback visibility

Gate: Study Packet audit and AI trust.

Why now: A packet must disclose whether semantic retrieval worked or degraded.

Dependencies:

- EP-001 preferred.

Files likely touched:

- Council retrieval/session metadata.
- Council UI.
- Workspace/packet export renderer.
- Tests.

Scope:

- Persist retrieval mode.
- Persist fallback reason when semantic search degrades.
- Render fallback in UI and export.

Out of scope:

- New search engine.
- Search quality tuning.

Acceptance criteria:

- Semantic unavailable path records fallback reason.
- UI shows fallback clearly.
- Export includes fallback metadata.

Verification:

- Mock or fixture test for fallback.
- Export text check.

Evidence artifact:

- Test output and sample export excerpt.

Rollback/recovery:

- Metadata/display change; keep retrieval behavior unchanged.

Risks:

- Making fallback look like failure when it is graceful degradation. Wording should be factual.

Follow-up tickets:

- Search measurement plan.

### EP-011: Accessibility release gate doc

Gate: Accessibility.

Why now: Accessibility must be tested around the whole Study Packet path, not only component fixes.

Dependencies:

- EP-001 preferred.

Files likely touched:

- `docs/accessibility-release-gate.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define keyboard-only Study Packet workflow.
- Define focus, label, overlay, contrast, text scaling checks.
- Define known-gaps table.

Out of scope:

- UI code changes.
- Automated axe setup.

Acceptance criteria:

- A manual tester can follow the script.
- Release blocker is explicit.

Verification:

- ASCII scan.
- Manual doc review.

Evidence artifact:

- Accessibility gate doc.

Rollback/recovery:

- Doc-only change.

Risks:

- Making the standard too vague. Keep workflow steps explicit.

Follow-up tickets:

- Keyboard-only QA run.
- Accessibility bug fixes.

### EP-012: Quality ops and AI risk docs

Gate: AI quality and support.

Why now: Bad AI outputs need a path into regression fixtures before beta starts.

Dependencies:

- EP-001 and EP-004 preferred.

Files likely touched:

- `docs/quality-ops-plan.md`
- `docs/ai-risk-eval-plan.md`
- `docs/testing-and-release-plan.md`

Scope:

- Define severity taxonomy.
- Define quality case schema.
- Define fixture conversion rule.
- Define failure classes.
- Define release blockers.

Out of scope:

- Eval runner implementation.
- Prompt rewrites.

Acceptance criteria:

- S0/S1/repeated S2 issues require fixture or accepted risk.
- Sensitive-topic, citation, retrieval, attribution, and tradition/lens failures are included.

Verification:

- ASCII scan.
- Manual review against research reports.

Evidence artifact:

- Quality docs.

Rollback/recovery:

- Doc-only change.

Risks:

- Creating a process too heavy for beta. Keep severity-based.

Follow-up tickets:

- Quality case JSON schema.
- Fixture runner.

## First-week execution checklist

Day 1:

- Create EP-001.
- Link it from roadmap/testing docs.
- Do ASCII scan and link search.

Day 2:

- Create EP-002.
- Run `rg` for `sqlite-vec`, `BLOB`, and `cosine`.
- Confirm architecture now matches implementation.

Day 3:

- Create EP-003.
- Add source decision classes and current source table.
- Link from data sources.

Day 4:

- Create EP-004 and EP-005.
- Add privacy/distribution links.

Day 5:

- Shape EP-006 and EP-007 into code tasks.
- Identify exact restore tests to add.
- Do not start unrelated UI work.

End-of-week evidence:

- Study Packet contract exists.
- Architecture drift is fixed.
- Content BOM exists.
- Safety and youth policies exist.
- Restore hardening work is shaped and ready.

## Review checklists

### Canonical doc review checklist

- Does it state scope and non-scope?
- Does it link to the master plan or relevant canonical docs?
- Does it create clear release gates?
- Does it avoid overpromising?
- Does it avoid legal/medical/pastoral advice beyond product boundaries?
- Is it ASCII clean?
- Is it stable-name canonical doc, not timestamped?

### Data trust PR checklist

- Does it include a regression test?
- Does it fail safely before replacing or mutating user data?
- Does it preserve backups?
- Does it avoid leaking secrets into logs/errors?
- Does it update release/privacy docs if behavior changes?
- Does it have rollback notes?

### AI trust PR checklist

- Does it distinguish configured, attempted, verified, skipped, failed?
- Does it avoid hiding provider disagreement or retrieval fallback?
- Does it avoid new authoritative spiritual language?
- Does it include fixtures or tests?
- Does it update packet/export metadata if relevant?

### Safety PR checklist

- Does it follow the policy?
- Does it route before Council generation?
- Does it have fixtures?
- Does it keep crisis responses concise?
- Does it avoid theological debate as the primary response to crisis prompts?
- Does it avoid collecting unnecessary sensitive data?

### Release PR checklist

- Does it bind evidence to exact artifacts?
- Does it scan for secrets/local paths?
- Does it avoid bundling local profiles or manual evidence?
- Does it update release notes/checklists?
- Does it keep private beta and public beta gates separate?

## Suggested labels

Use these issue/board labels:

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

## Plan change-control rules

The plan can change, but changes should be controlled.

Change the plan when:

- A hard blocker is discovered.
- A task is proven unnecessary.
- A beta user finding invalidates an assumption.
- A dependency is wrong.
- A release gate is too weak.

Do not change the plan when:

- A new feature sounds useful but does not support Study Packet v1.
- A competitor has an appealing feature outside the wedge.
- A technical tool is fashionable.
- A code path is merely more interesting than current trust work.

Any plan change should state:

- What changed.
- Why it changed.
- Which gate it affects.
- Which tasks move in or out.
- Whether beta criteria changed.

## Failure triage

### If a code task gets bigger than expected

Do this:

1. Stop and split the task.
2. Keep the smallest safety-preserving fix active.
3. Move the rest to `Needs shaping`.
4. Update the packet with the discovered dependency.

### If a doc task gets too broad

Do this:

1. Preserve the release gate.
2. Move background explanation to an appendix.
3. Avoid trying to solve implementation in the policy doc.

### If a release gate cannot pass

Do this:

1. Mark the exact failed criterion.
2. Decide if it blocks private beta or public beta only.
3. Add accepted risk only if user impact is bounded and documented.
4. Add revisit trigger.

### If beta feedback asks for deferred features

Do this:

1. Tag as `defer:post-beta`.
2. Link to the current wedge.
3. Ask whether the missing feature blocks Study Packet use.
4. Do not promote unless it blocks packet creation, export, trust, or support.

## Hard no list for the next execution cycle

Do not start:

- Mobile app work.
- Cloud sync.
- Collaborative workspaces.
- Church admin features.
- Public community forum.
- Youth/classroom mode.
- Pricing implementation.
- Public marketing site.
- Module marketplace.
- Modern translation licensing implementation.
- Tauri updater.
- New vector database migration.
- AI prayer/devotional companion.

These are not bad ideas forever. They are wrong for the next execution cycle.

## Implementation handoff

The next person implementing should start here:

1. Open this file.
2. Open `2026-06-12-164726-master-plan-enhancement-pass-2-operating-system.md`.
3. Create EP-001 exactly as scoped.
4. Do not touch app code in EP-001.
5. Verify with ASCII scan and link search.
6. Then do EP-002.

The first code work should be EP-006 or EP-007, not AI feature work.

## Bottom line

The plan is now ready to leave research mode. This pass defines the packets needed to execute the first work cleanly. The correct next move is not another broad plan; it is EP-001, the Study Packet v1 contract, followed by architecture drift correction and content BOM creation.
