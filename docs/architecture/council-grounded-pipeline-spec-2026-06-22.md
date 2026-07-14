# The Grounded Council — Engineering Spec (TRIANGULON-grade)

**A SOTA grounded, verified, multi-stage deliberation pipeline for the BibleApp Council.**

- **Status:** BUILDABLE. Grounded in the verified reuse-map of the current Council (2026-06-22).
- **Model source:** TRIANGULON (`C:/JM Programs/jmsdevlab-website/docs/architecture/triangulon-engineering-spec-2026-06-20.md`) — its two-channel trust model, adapted to a FIXED local verse corpus + multiple provider families.
- **Repo:** `C:/JM Programs/BibleApp/` (paths repo-relative).

---

## 0. Why this exists

Today's Council is a **2–3 LLM-call prompt-chain** (parallel voices → one Claude synthesis). Grounding is only *requested* in the prompt ("cite only verse_ids in the evidence"); nothing **enforces** it, nothing **verifies** it, and the same family that writes the synthesis is the only one that "checks" it. So it finishes in seconds and can silently ship an ungrounded or self-flattering answer.

The Grounded Council adopts TRIANGULON's **two-channel** model:

- **Channel A — the GROUNDING FLOOR. The ONLY thing allowed to HARD-FAIL / force a regen.** Deterministic: every cited `verse_id` and every asserted scripture reference in the synthesis must be a *member* of the retrieved evidence set. A position citing a verse that was never retrieved is a hallucinated citation → fail. On fail, a bounded **regen** re-runs synthesis against the flagged citations; adopted only if strictly fewer violations (never weaker).
- **Channel B — the SOFT LAYER. May only RANK or FLAG, never hard-fail.** A **cross-family judge** (a different provider family than the synthesizer scores faithfulness/balance/grounding), an **evidence-route diversity grapher** (agreement that echoes the same proof-text is correlated), **confidence adjustment** (bands read down by distinct support), a **kill-test** skeptic, **semantic-entropy** stability, and a standing evaluation loop.

The lifecycle becomes genuinely multi-stage — `scope → breadth → depth → synthesize → adversarial → ground` — so it does real work and takes real time, and the existing live "watch it think" canvas + cinematic hero visualize the real stages.

| Stage | Name | Channel | Can hard-fail? |
|---|---|---|---|
| 0 | Cross-family judge selection | de-biaser foundation | no |
| 1 | Grounding floor (verse_id membership) + regen | A | **YES (sole authority)** |
| 2 | Multi-stage lifecycle (scope→breadth→depth→synth→adversarial) | substrate | no |
| 3 | Independence grapher (interpretive-lineage) | B (deterministic) | no |
| 4 | Soft layer (kill-test, confidence adjustment, semantic-entropy, TICK) | B | no |
| 5 | Calibration + learning | B (proves the rest) | no |

**Build order ≠ value order.** Stage 1 (floor+regen) and Stage 0 (cross-family judge) are the load-bearing trust gains and ship first; the lifecycle (2) makes it deep; 3–5 add rigor.

---

## 1. Verified reuse-map (current Council)

| Component | File:line | Shape | Reuse role |
|---|---|---|---|
| `runCouncil` | `app/sidecar/council.mjs:500` | `({question,evidence,model,settings,onEvent}) => CouncilResponse` | Orchestrator. Floor inserts after `ensurePositionEvidence` (`:615`); regen wraps `synthesise` (`:603-613`) |
| `synthesise` | `app/sidecar/council.mjs:96` | `({question,successfulVoices,model,env}) => CouncilResult` | Wrapped by regen; re-invoked with flagged citations |
| `ensurePositionEvidence` | `app/sidecar/council.mjs:615` | repair pass | Floor runs immediately after |
| `normaliseResult` | `app/sidecar/providers/_shared.mjs:267-359` | structural coercion only | Extend with deterministic membership (NEW fn, not here) |
| `VOICE_/SYNTHESIS_SYSTEM_PROMPT` | `_shared.mjs:8-84 / 86-106` | prompts | Add numeric/citation discipline + regen prompt |
| provider registry | `app/sidecar/providers/index.mjs:6` | `[claude,gateway,gemini,openai]` + `availableProviders(env)` | Stage 0 picks a judge whose family ≠ synthesizer |
| families | claude=Anthropic, openai=gpt-5, gemini=2.5-flash, gateway=any | per adapter `isAvailable(env)` | **3 genuinely distinct families** — cross-family judge needs no local model |
| `retrieve_evidence` | `app/src-tauri/src/lib.rs:3816` | semantic+FTS+xref → `RetrievedEvidence[]` | Stage 2 calls per-crux; corpus the floor checks against |
| `verse_id` identity | `lib.rs:16-17` | `book*1e6+ch*1e3+v` | The floor's membership key (deterministic) |
| `council_sessions` + `insert_session` | `app/src-tauri/src/user_db.rs:74,1667`; `USER_SCHEMA_VERSION=14 (:13)` | persistence | Add grounding/judge/independence tables; bump version; add to `USER_TABLES` |
| event stream | sidecar emits (`council.mjs`), Rust passes through (`lib.rs:2904 emit()`), `classify_sidecar_line` (`sidecar.rs:58`), `reduceRunEvent` (`councilRun.ts:55`), `kind` union (`bible.ts:270-284`), `StageId` (`councilRun.ts:3`) | NDJSON | New kinds: `scope_*`, `breadth_*`, `depth_*`, `grounding_*`, `judge_*`, `regen_*`, `independence_*` |
| transport | `app/sidecar/index.mjs:174` `case "council"` → `runCouncil`; sidecar timeout 1800s (`sidecar.rs:20`) | one-shot NDJSON | 30-min budget is ample for a multi-stage run |

**NET-NEW (sidecar `app/sidecar/grounded/`):** `evidence-set.mjs` (build the membership corpus of verse_ids from `retrieved_evidence`), `grounding-floor.mjs` (the deterministic gate), `claim-decompose.mjs` (split synthesis prose into atomic claims + their referenced verse_ids), `cross-family-judge.mjs` (pick + run a different-family judge with permutation), `independence.mjs` (interpretive-lineage overlap), `calibrated-confidence.mjs`, `kill-test.mjs`, `semantic-entropy.mjs`, `lifecycle.mjs` (scope/breadth/depth orchestration). **NET-NEW (Rust):** new `council_*` tables in `USER_SCHEMA`. **NET-NEW (frontend):** event kinds + `reduceRunEvent` cases + canvas bands for the new stages.

---

## 2. Per-stage specs

### STAGE 1 — Grounding floor (verse_id membership) + regen  *(ship first)*

**Goal.** After synthesis, deterministically verify every cited `verse_id` is a member of the retrieved evidence set; on any miss, regen ≤2 and adopt only a strictly-cleaner result; if still failing, mark the run `grounding_failed` and surface it honestly (never silently ship).

**Algorithm (`grounding-floor.mjs`):**
1. `buildEvidenceSet(retrieved_evidence)` → `Set<verse_id>` (the corpus) + a `Map<verse_id, row>`.
2. Collect every cited verse_id from the synthesis: each position's `evidence[].verse_id`, `supporting_evidence_ids`, `challenging_evidence_ids`, `argument_map.nodes[].verse_ids`, and `evidence_classification[].verse_id`.
3. `decomposeClaims(synthesis.synthesis + positions[].summary)` → atomic claims; for any claim that names a scripture reference, resolve to a verse_id and require membership.
4. **HARD FAIL** if: any cited verse_id ∉ corpus (hallucinated citation), OR `citation_accuracy = cited-and-resolvable / cited < floor` (default 0.95), OR a position has zero in-corpus citations.
5. Produce `GroundingReport { hard_fail, violations: [{position,verse_id,reason}], citation_accuracy, claim_verdicts }`.

**Regen (wraps `synthesise`):** on `hard_fail`, re-invoke `synthesise` with the original prompt + the explicit list of out-of-corpus verse_ids + "remove or replace these; cite ONLY verse_ids present in the evidence". Loop `MAX_REGEN=2`; accept an attempt only if it has strictly fewer violations (monotonic). If never clean → keep the least-bad, set `synthesis_mode='grounding_failed'`, emit honest UI state.

**Acceptance:** (1) a synthesis citing a fabricated verse_id → `hard_fail=true`; (2) a fully-grounded synthesis → `hard_fail=false` (0 FP); (3) regen recovers a one-bad-citation synthesis to clean within ≤2; (4) deterministic — no LLM in the membership check (works judge-down); (5) result persisted with a `council_grounding_claims` audit; (6) e2e: mock path stays green (floor is a no-op on the all-grounded mock).

**Files:** NEW `app/sidecar/grounded/{evidence-set,grounding-floor,claim-decompose}.mjs`; MODIFY `council.mjs` (insert after `:615`, wrap `:603-613`); MODIFY `_shared.mjs` (regen prompt); Rust `user_db.rs` (`council_grounding_claims` table + version bump). New events `grounding_started/done`, `regen_started/done`.

### STAGE 0 — Cross-family judge

**Goal.** A provider family **different** from the synthesizer (Claude) scores the synthesis for grounding-faithfulness, balance (dissent preserved?), and overreach. Channel B — flags only.
**Selection:** `selectCrossFamilyJudge(synthesizerFamily='anthropic', available)` → prefer `openai` then `gemini` (then gateway if its backend family differs); if only Claude is configured, judge is skipped (flag, not block). **Permutation** guard against position bias (judge the positions in 2 orders; disagreement → downgrade to 'mixed'). Persist `council_judge_audit`.
**Acceptance:** judge family ≠ synthesizer; null/parse-fail → fail-soft (no block); a seeded ungrounded synthesis is flagged; a clean one is not; audit row written.

### STAGE 2 — Multi-stage lifecycle

**Goal.** Replace the single retrieval+fan-out with `scope → breadth → depth → synthesize → adversarial`. **Scope:** a pass enumerates the candidate positions before evidence (so retrieval targets each). **Breadth:** retrieve per-position evidence (supporting + challenging), not one global pass — call the Rust `retrieve_evidence` per crux. **Depth:** each voice analyses per-position with the targeted evidence. **Synthesize:** cluster/weight/preserve dissent (current). **Adversarial:** Stage-4 kill-test on the leader. State flows via the response object (single sidecar run; no D1 needed — local SQLite + in-memory). Emits real per-stage events the canvas already renders.
**Acceptance:** scope yields 2–5 candidate positions; breadth retrieves distinct evidence per position; depth voices see targeted evidence; total run is minutes not seconds; events drive the live canvas through real stages.

### STAGE 3 — Independence grapher (interpretive-lineage)

**Goal.** Deterministic: distinguish provider agreement supported by substantially disjoint cited evidence routes from agreement that repeats the same proof-text. This measures evidence-route diversity, not statistical or institutional independence.
**Acceptance:** two voices citing identical verse_ids → counted as 1 independent; disjoint → 2; confidence uses independent count.

### STAGE 4 — Soft layer

Kill-test (cross-family skeptic tries to refute the leader; survives?), semantic-entropy (resample synthesis N=3, measure position stability), TICK (each position: ≥1 in-corpus citation + weakest_link + what_would_change present), calibrated-confidence (band gated on independent non-single-text support). All rank/flag only.

### STAGE 5 — Calibration

A human-labelled set of disputed questions with expected position-structure; measure cross-family judge agreement (Brier/ECE); trust gate stays closed until measured. Mirrors TRIANGULON Stage 5.

---

## 3. Data model (Rust `user_db.rs`, bump `USER_SCHEMA_VERSION`→15, add to `USER_TABLES`)

```sql
CREATE TABLE IF NOT EXISTS council_grounding_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
  position_label TEXT, verse_id INTEGER NOT NULL,
  status TEXT NOT NULL,            -- 'in_corpus' | 'out_of_corpus' | 'unresolved'
  note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS council_judge_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL UNIQUE REFERENCES council_sessions(id) ON DELETE CASCADE,
  judge_provider TEXT, judge_model TEXT, grounding_score REAL,
  permutation_agreement INTEGER, audit_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS council_independence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
  position_label TEXT, independent_voice_count INTEGER, raw_voice_count INTEGER,
  detail_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
```
`response_json` also carries a `grounding`, `judge`, `independence` block so the frontend renders without extra queries.

---

## 4. Events (extend the existing stream)
Add `kind`s: `scope_started/done`, `breadth_started/done`, `depth_started/done`, `grounding_started/done`, `regen_started/done`, `judge_started/done`, `independence_done`. Extend `StageId` (`councilRun.ts:3`) to `'safety'|'scope'|'retrieval'|'voices'|'synthesis'|'grounding'|'judge'|'verdict'` and add `reduceRunEvent` cases + canvas bands. The cinematic hero gains real beats (gather → voices → converge → **ground/verify** → judge → ignite).

---

## 5. Risks
- **Latency/cost:** per-crux retrieval + depth + judge + regen → minutes + more provider calls. Keep a cost cap; scope is cheap (1 call); judge is 1 extra family call; regen ≤2. Acceptable for an infrequent, high-value action.
- **Single-provider users:** cross-family judge + multi-voice independence degrade gracefully (flag "no cross-family check available"), never block.
- **Claim→verse_id resolution** (Stage 1 step 3) is the precision risk — start with the **deterministic cited-id membership** (high certainty) and treat prose-reference resolution as advisory until tuned (mirrors TRIANGULON: deterministic-first, NLI/novelty fail-soft).
- **e2e:** the mock path must stay green — floor is a no-op when all mock citations are in-corpus; gate new stages so `BIBLE_AI_MOCK_COUNCIL=1` keeps deterministic timing.

---

## 6. Build sequence
1. **Stage 1** (floor + regen) — biggest trust gain, deterministic, e2e-safe. ← start here.
2. **Stage 0** (cross-family judge) — 1 extra call, big credibility gain.
3. **Stage 2** (lifecycle) — makes it genuinely deep + drives the canvas.
4. **Stage 3 / 4 / 5** — independence, soft layer, calibration.

Each stage: build via subagent-driven-development, e2e-verified (full suite green in isolation), committed, then merged — same discipline as the rest of this app and as TRIANGULON itself.
