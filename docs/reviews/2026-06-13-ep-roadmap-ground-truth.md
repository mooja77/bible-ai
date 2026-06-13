# EP roadmap — ground-truthed against current code

- **Date:** 2026-06-13
- **Method:** 32 read-only agents (one per remaining EP) verified each packet's
  premise against the current code/docs; a synthesis pass ordered them into
  WIP-aware waves. Source plan: `docs/development-implementation-plan.md` (Codex).
- **Premise tallies:** 3 fully true, 22 partially-true, 7 false — i.e. the source
  plan substantially overstates the engineering gap. 13 packets are fully
  automatable, 19 partial (need human judgment / credentials / manual QA).
- EP-006 (restore secret cleanup) is already merged (`9096202`).

## Executive summary

The plan claims 33 packets. EP-006 is already merged, leaving **32 in scope**. But the audits show the real shape is very different from "33 features to build":

- **Almost everything verifiable is missing exactly as audited.** All 10 Gate-1-to-5 canonical docs are absent on disk (`study-packet-v1-contract.md`, `content-bom.md`, `sensitive-topic-safety-policy.md`, etc.), `docs/beta/` does not exist, `.github/ISSUE_TEMPLATE/` does not exist, `docs/samples/study-packets/` does not exist. The three code premises I spot-checked are also real gaps: import does call `BEGIN IMMEDIATE` (line 7454) right after `validate_import_payload` with no budget check (EP-013), and `retrieval_fallback_reason` does not exist anywhere (EP-010).
- **The true remaining scope is ~18 docs + ~9 code/release packets**, but a huge fraction is *content-reorganization*, not net-new thinking — the research already exists in `docs/reviews/`.

Counts (of the 32 live packets):
- **Already done / N/A: 1** (EP-006, merged — excluded from the 32; effectively the only "done" one).
- **Premise wrong → rescope or drop: 4** (EP-001, EP-013, EP-020, EP-028, EP-029, EP-030, EP-033 are flagged `false`, but only EP-013/EP-020 change *engineering* scope; the rest are just "file doesn't exist yet," which is the normal state). Net materially-rescoped: **2** (EP-013 sequence-of-operations bug; EP-020 is blocked-not-feature).
- **Automatable now (no human gate, deps met): 9.**
- **Needs human (judgment / credentials / manual QA / live providers): 6.**
- **Blocked purely on doc/code predecessors: ~15** (unblock automatically as waves complete).

Honest bottom line: this is **~60% documentation** (much of it copy-distill from existing research docs) and **~25% small, well-scoped code fixes**, with a thin layer of release-evidence plumbing and one genuine manual-QA gate (EP-027). The "33 packets" framing overstates engineering risk; the real risk is doc-discipline and serialization on two hot Rust files.

## Status buckets

### Already done or N/A
- **EP-006** — Restore secret cleanup — merged (commit 9096202); excluded.

### Premise wrong or overstated (rescope or drop)
- **EP-001** — Study Packet v1 Contract — premise "false" only because the file is absent; infra exists. **Rescope to: document what the code already does.** Not a feature.
- **EP-013** — Import budgets / quarantine — premise false in the load-bearing way: `BEGIN IMMEDIATE` (user_db.rs:7454) runs before any size validation. **Real fix = reorder + add `validate_import_budgets()`.** Drop the resource-quarantine half until EP-003 defines decision classes.
- **EP-020** — Sensitive-Topic Router — premise "false" = it's *blocked*, not built; correct. **Keep as a real code packet but hard-gated behind EP-004 + EP-012.**
- **EP-028 / EP-029 / EP-030 / EP-033** — premise "false" = "files don't exist yet." That's expected, not a defect. **No rescope; treat as ordinary doc/assembly work in their wave.**

### Automatable now (deps already satisfied)
- **EP-002** — Architecture vector-store doc correction — pure doc fix, no deps.
- **EP-003** — Content BOM — doc, transcribe from existing data-sources/research, no deps.
- **EP-004** — Sensitive-topic safety policy — doc, research already drafted, no code deps.
- **EP-007** — Restore identity validation — small Rust fix + tests, dep EP-006 done.
- **EP-008** — Import/restore state refresh — 2-line SettingsPanel fix, no deps.
- **EP-014** — Tag + stale-link integrity — 3 small user_db.rs cleanups + tests, no deps.
- **EP-012** — Quality Ops + AI Risk docs — doc extraction from existing research pass.
- **EP-005** — Youth/minors policy — short doc, deps (EP-001/004) are also doc-only.
- **EP-009** — Provider readiness honesty — UI-only TS change, backend diagnostics already work.

### Needs human (judgment / credentials / manual QA / live providers)
- **EP-019** — Council cancellation — needs live-sidecar timing test to prove stale result isn't persisted.
- **EP-020** — Sensitive-topic router — conservative-classifier policy calls require human review of false-negative risk.
- **EP-023 / EP-024 / EP-025** — Release manifest / hashing / SBOM — need a real Windows release build + license judgment.
- **EP-027** — Keyboard-only Study Packet QA — explicit manual gate; a human must walk the path keyboard-only.
- **EP-026** — Support-bundle redaction UX — redaction is tested, but the "user reviews before sending" UX needs design + manual QA.

## Execution sequence

Dependency-ordered waves. **WIP rule honored:** never more than ~2-3 code packets active; the two hot Rust files (`lib.rs`, `user_db.rs`) are serialized.

> **Conflict-prone clusters (MUST be sequential, never parallel):**
> - **`app/src-tauri/src/lib.rs`**: EP-007 → EP-010 → EP-019 → EP-020 (all edit ask_council / validation / response building).
> - **`app/src-tauri/src/user_db.rs`**: EP-014 → EP-010 → EP-013 (schema + insert_session + import path).
> - **`SettingsPanel.tsx`**: EP-008 → EP-009 → EP-026 (module refresh, ready-count, support bundle).
> - **Release scripts**: EP-023 → EP-024 → EP-025 (manifest schema is shared, backward-incompatible).

**Wave 0 — doc foundations + zero-dep code (parallel docs, ≤2 code) — START NOW**
- EP-002 — Architecture vec-store correction — risk low, effort S — quick truth-fix, no deps.
- EP-001 — Study Packet v1 contract — risk low, effort M — unblocks the entire packet chain (EP-015/16/17/18).
- EP-003 — Content BOM — risk low, effort S — unblocks EP-013 quarantine half.
- EP-004 — Sensitive-topic safety policy — risk low, effort S — unblocks EP-020/EP-012.
- EP-008 — Import/restore module refresh — risk low, effort S — isolated SettingsPanel fix (code slot 1).
- EP-014 — Tag + stale-link integrity — risk low, effort S — isolated user_db.rs, no overlap yet (code slot 2).

**Wave 1 — second doc tier + serialized Rust**
- EP-005 — Youth/minors policy — risk low, effort S — dep EP-001/004 now met.
- EP-012 — Quality Ops + AI Risk docs — risk low, effort S — dep EP-001/004 met; gates EP-020/22/31.
- EP-007 — Restore identity validation — risk low, effort S — lib.rs slot; must precede EP-010 on lib.rs.
- EP-009 — Provider readiness honesty — risk low, effort S — SettingsPanel slot (after EP-008).

**Wave 2 — packet-export code chain + retrieval**
- EP-015 — Export audit vs contract — risk med, effort M — dep EP-001; defines metadata gaps.
- EP-010 — Retrieval fallback visibility — risk low, effort M — **lib.rs + user_db.rs**; run after EP-007 (lib.rs) and EP-014 (user_db.rs), before EP-013.
- EP-011 — Accessibility release gate doc — risk low, effort M — dep EP-001; gates EP-027.

**Wave 3 — manifest/leak/quarantine (serialized on user_db/export)**
- EP-016 — Packet manifest — risk med, effort M — dep EP-001/015.
- EP-017 — Packet leak scan + sanitizer — risk med, effort M — dep EP-015/16; consolidates sanitizer.
- EP-013 — Import budgets + quarantine — risk med, effort M — **user_db.rs last in cluster**; dep EP-003.
- EP-022 — Quality case schema + runner — risk med, effort M — dep EP-012.

**Wave 4 — sensitive router + samples + cancellation**
- EP-020 — Sensitive-topic router — risk high, effort M — **lib.rs last**; dep EP-004/012; human-reviewed.
- EP-019 — Council cancellation — risk med, effort M — lib.rs/sidecar; after EP-020 settles lib.rs.
- EP-018 — Sample Study Packets — risk high, effort L — dep EP-001/15/16/17.
- EP-021 — Distribution/community/institutional docs — risk low, effort M — dep EP-001/04/05/11/12.

**Wave 5 — release evidence + beta intake**
- EP-023 → EP-024 → EP-025 — manifest evidence / per-file hashing / SBOM — med risk, M effort — serialized on release scripts; need Windows build.
- EP-026 — Support-bundle redaction UX — risk low, effort M — SettingsPanel (after EP-009).
- EP-028 / EP-029 / EP-030 / EP-031 / EP-032 — beta docs + issue templates — low risk, S-M — dep EP-021/012.

**Wave 6 — gates (human)**
- EP-027 — Keyboard-only Study Packet QA — risk med, effort M — dep EP-011/EP-018; manual.
- EP-033 — Private beta gate evidence bundle — risk high, effort M — dep everything; assembly + go/no-go decision.

## Start here

1. **EP-002 (Architecture vec-store correction)** — lowest-risk possible win; deletes a self-contradicting `vec0`/`FLOAT[768]` sketch, fully verifiable by grep returning zero matches.
2. **EP-001 (Study Packet v1 contract)** — the single highest-leverage doc; it unblocks the entire EP-015→018 export chain and is just formalizing what the export code already does.
3. **EP-008 (Import/restore module refresh)** — two function calls in SettingsPanel, verified by `npm run check:full`; real user-visible bug, isolated file, no deps.
4. **EP-014 (Tag + stale-link integrity)** — three small `user_db.rs` cleanups with three new cargo tests; correctness fix that prevents tag counts disagreeing with visible items, no file conflicts in Wave 0.
5. **EP-004 (Sensitive-topic safety policy)** — research already drafted; writing it now unblocks both EP-012 and the high-risk EP-020 router so they're never on the critical path later.

Relevant absolute paths confirmed this session: `C:\JM Programs\BibleApp\app\src-tauri\src\user_db.rs` (line 7454 `BEGIN IMMEDIATE`, line 15 `USER_TABLES`), `C:\JM Programs\BibleApp\app\src-tauri\src\lib.rs` (line 2071 `validate_user_sqlite_source`), `C:\JM Programs\BibleApp\app\src\lib\bible.ts` (no `retrieval_fallback_reason`). All 10 gate docs, `docs\beta\`, `.github\ISSUE_TEMPLATE\`, and `docs\samples\study-packets\` are confirmed absent.