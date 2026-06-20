# P1 — Real-time Council Progress Channel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream the real Council pipeline's progress to the frontend in real time — safety check, retrieval (+ fallback), each voice starting/finishing/failing, synthesis (+ fallback), the judgment, and completion — without changing what the final `ask_council` call returns.

**Architecture:** Progress is additive. Pre-sidecar stages (safety, retrieval) are emitted directly by Rust onto a per-invocation `tauri::ipc::Channel`. The Node sidecar emits voice/synthesis/judgment events as extra `{type:"council_progress"}` NDJSON lines *before* its terminal `council_result` line; Rust's read loop classifies each line with a pure function, forwards progress events onto the same channel (re-stamping a single monotonic `seq`), and returns the final result exactly as today.

**Tech Stack:** Node ESM sidecar (`node --test`), Rust/Tauri 2 (`cargo test`, `tauri::ipc::Channel`), TypeScript transport wrapper (`@tauri-apps/api/core` `Channel`).

**Spec:** `docs/superpowers/specs/2026-06-20-ui-ux-overhaul-design.md` §5. This plan is P1 only; P2 (the animated map) consumes this channel.

**Event taxonomy (the contract this plan delivers):** each event is `{ seq:int, ts:int, kind:string, ...payload }`. Kinds and origins:
- Rust-origin: `run_started`{`evidence_strategy`}, `safety_checked`{`status`,`category?`}, `retrieval_started`{`strategy`}, `retrieval_fallback`{`reason`}, `retrieval_done`{`count`,`mode`}, `run_complete`{`session_id?`,`synthesis_mode?`}.
- Sidecar-origin (forwarded): `voice_started`{`provider`,`display_name`}, `voice_done`{`provider`,`ms`,`position_count`}, `voice_failed`{`provider`,`category?`,`hint?`}, `synthesis_started`{`voice_count`}, `synthesis_fallback`{`reason`}, `judged`{`leader_label`,`leader_weight`,`confidence`}.

> Note: "conflict" is **not** an event — it is derived in P2 from multiple positions / `evidence_classification`. Do not invent a conflict event.

---

## File Structure

- `app/sidecar/council.mjs` — add `onEvent` plumbing + an exported pure `emitMockSequence` (mock path) and real-path emit points.
- `app/sidecar/index.mjs` — thread `onEvent` into `runCouncil`; export a pure `councilProgressLine` builder.
- `app/sidecar/tests/council.test.mjs` — extend with event-sequence tests.
- `app/sidecar/tests/index-progress.test.mjs` — **create**; tests the `councilProgressLine` builder.
- `app/src-tauri/src/sidecar.rs` — add `SidecarLine` enum + pure `classify_sidecar_line`; add `Sidecar::request_streaming` and `SidecarState::request_streaming`; refactor `request` to delegate; add `#[cfg(test)]` module.
- `app/src-tauri/src/lib.rs` — `ask_council` gains a `Channel` param + emits Rust-origin events + uses `request_streaming`.
- `app/src/lib/bible.ts` — `askCouncil` accepts an optional `onProgress` callback via a `Channel`; add `CouncilProgressEvent` type.

---

## Task 1: Sidecar emits a deterministic event sequence in mock mode

**Files:**
- Modify: `app/sidecar/council.mjs` (the `runCouncil` signature + mock branch ~line 416–442; add exported `emitMockSequence`)
- Test: `app/sidecar/tests/council.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `app/sidecar/tests/council.test.mjs`:

```js
test("mock mode emits an ordered progress event sequence", async () => {
  const events = [];
  await withMockMode(() =>
    runCouncil({
      question: "What does grace mean?",
      evidence: EVIDENCE,
      model: "sonnet",
      onEvent: (e) => events.push(e),
    }),
  );

  const kinds = events.map((e) => e.kind);
  // Voices first, then synthesis lifecycle, then the judgment.
  assert.ok(kinds.includes("voice_started"), "expected a voice_started event");
  assert.ok(
    kinds.includes("voice_done") || kinds.includes("voice_failed"),
    "expected a voice outcome event",
  );
  assert.equal(kinds[kinds.length - 1], "judged", "judged must be last");

  // seq is strictly increasing and ts is present.
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].seq > events[i - 1].seq, "seq must strictly increase");
  }
  assert.ok(events.every((e) => typeof e.ts === "number"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && node --test sidecar/tests/council.test.mjs`
Expected: FAIL — `onEvent` is never called, so `events` is empty (`expected a voice_started event`).

- [ ] **Step 3: Implement the minimal code to pass**

In `app/sidecar/council.mjs`, add an exported pure helper near the other helpers:

```js
/**
 * Emit a progress-event sequence that exactly mirrors a finished council
 * result, so the stream can never diverge from what is returned. Pure: all
 * effects go through `emit`. Used by mock mode and unit tests; the live path
 * (Task 2) emits the same kinds at their real moments.
 */
export function emitMockSequence(result, emit) {
  for (const v of result.voices ?? []) {
    emit("voice_started", { provider: v.provider, display_name: v.display_name });
    if (v.status === "ok") {
      emit("voice_done", {
        provider: v.provider,
        ms: v.duration_ms ?? 0,
        position_count: v.result?.positions?.length ?? 0,
      });
    } else {
      emit("voice_failed", {
        provider: v.provider,
        category: v.error_category ?? null,
        hint: v.error_hint ?? null,
      });
    }
  }
  const okCount = (result.voices ?? []).filter((v) => v.status === "ok").length;
  if (okCount > 1) {
    emit("synthesis_started", { voice_count: okCount });
    if (result.synthesis_mode === "synthesis_failed") {
      emit("synthesis_fallback", { reason: "synthesis failed; using the lead voice" });
    }
  }
  const positions = [...(result.synthesis?.positions ?? [])].sort(
    (a, b) => b.weight - a.weight,
  );
  const leader = positions[0];
  if (leader) {
    emit("judged", {
      leader_label: leader.label,
      leader_weight: leader.weight,
      confidence: result.synthesis?.confidence ?? null,
    });
  }
}
```

Change the `runCouncil` signature to accept `onEvent` and create a seq-stamping `emit`, then drive the mock sequence. Replace the function header and the mock `return` (lines ~416, ~441):

```js
export async function runCouncil({ question, evidence, model, settings, onEvent }) {
  let seq = 0;
  const emit = (kind, payload = {}) =>
    onEvent?.({ seq: ++seq, ts: Date.now(), kind, ...payload });
```

and in the mock branch, replace `return mockCouncilResult({ question, evidence, model });` with:

```js
    const mock = mockCouncilResult({ question, evidence, model });
    emitMockSequence(mock, emit);
    return mock;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && node --test sidecar/tests/council.test.mjs`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add app/sidecar/council.mjs app/sidecar/tests/council.test.mjs
git commit -m "feat(council): emit a deterministic progress-event sequence in mock mode"
```

---

## Task 2: Emit the same events at the real (live) pipeline points

**Files:**
- Modify: `app/sidecar/council.mjs` (`runOneVoice` ~53–85, `synthesise` ~87–99, `runCouncil` real branch ~444–496)
- Test: `app/sidecar/tests/council.test.mjs` (assert the live emit helper shape)

The live providers cannot run under `node --test`, so we make the live path call the **same** `emit` at real moments and unit-test the one piece of pure logic we add: deriving a `judged` payload from a synthesis object.

- [ ] **Step 1: Write the failing test**

Add to `app/sidecar/tests/council.test.mjs`:

```js
import { judgedEventPayload } from "../council.mjs";

test("judgedEventPayload picks the highest-weighted position", () => {
  const synthesis = {
    confidence: "medium",
    positions: [
      { label: "Minority", weight: 0.3 },
      { label: "Leader", weight: 0.7 },
    ],
  };
  assert.deepEqual(judgedEventPayload(synthesis), {
    leader_label: "Leader",
    leader_weight: 0.7,
    confidence: "medium",
  });
});

test("judgedEventPayload is null-safe for empty synthesis", () => {
  assert.equal(judgedEventPayload(null), null);
  assert.equal(judgedEventPayload({ positions: [] }), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && node --test sidecar/tests/council.test.mjs`
Expected: FAIL — `judgedEventPayload` is not exported (`SyntaxError`/`undefined`).

- [ ] **Step 3: Implement**

In `app/sidecar/council.mjs` add the exported helper:

```js
/** Derive the `judged` event payload from a synthesis result, or null. */
export function judgedEventPayload(synthesis) {
  const positions = [...(synthesis?.positions ?? [])].sort(
    (a, b) => b.weight - a.weight,
  );
  const leader = positions[0];
  if (!leader) return null;
  return {
    leader_label: leader.label,
    leader_weight: leader.weight,
    confidence: synthesis?.confidence ?? null,
  };
}
```

Refactor `emitMockSequence`'s leader block to reuse it (DRY):

```js
  const judged = judgedEventPayload(result.synthesis);
  if (judged) emit("judged", judged);
```

Thread `emit` into the live path. Change `runOneVoice` to accept and call `emit`:

```js
async function runOneVoice(provider, { question, evidence, env, model, emit }) {
  const started = Date.now();
  const displayName = provider.displayName?.({ env, model }) ?? provider.display_name;
  emit?.("voice_started", { provider: provider.name, display_name: displayName });
  try {
    const result = await withTimeout(
      provider.analyze({ question, evidence, env, model }),
      voiceTimeoutMs(env),
      displayName,
    );
    emit?.("voice_done", {
      provider: provider.name,
      ms: Date.now() - started,
      position_count: result?.positions?.length ?? 0,
    });
    return { provider: provider.name, display_name: displayName, status: "ok", result, error: null, duration_ms: Date.now() - started };
  } catch (err) {
    const error = redactSecrets(err?.message ?? String(err), env);
    log(`voice ${provider.name} failed:`, error);
    const { category, hint } = classifyProviderError(error, displayName);
    emit?.("voice_failed", { provider: provider.name, category, hint });
    return { provider: provider.name, display_name: displayName, status: "error", result: null, error, error_category: category, error_hint: hint, duration_ms: Date.now() - started };
  }
}
```

In `runCouncil`'s live branch, pass `emit` into the voices and bracket synthesis (replace lines ~456–490):

```js
  const voices = await Promise.all(
    available.map((p) => runOneVoice(p, { question, evidence, env, model, emit })),
  );

  const ok = voices.filter((v) => v.status === "ok" && v.result);
  if (ok.length === 0) {
    const lines = voices.map((v) => `• ${v.display_name}: ${v.error_category ?? "unknown"} — ${v.error_hint ?? v.error ?? "failed"}`);
    throw new Error("Every Council voice failed:\n" + lines.join("\n"));
  }

  let synthesis;
  let synthesisFailed = false;
  if (ok.length === 1) {
    synthesis = ok[0].result;
  } else {
    emit("synthesis_started", { voice_count: ok.length });
    try {
      synthesis = await synthesise({ question, successfulVoices: ok, model, env });
    } catch (err) {
      log("synthesis failed, falling back to first voice:", redactSecrets(err?.message ?? String(err), env));
      synthesis = ok[0].result;
      synthesisFailed = true;
      emit("synthesis_fallback", { reason: "synthesis failed; using the lead voice" });
    }
  }
  synthesis = ensurePositionEvidence(synthesis, evidence);
  const judged = judgedEventPayload(synthesis);
  if (judged) emit("judged", judged);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && node --test sidecar/tests/council.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/sidecar/council.mjs app/sidecar/tests/council.test.mjs
git commit -m "feat(council): emit voice/synthesis/judged events on the live path"
```

---

## Task 3: Sidecar forwards events as `council_progress` NDJSON lines

**Files:**
- Modify: `app/sidecar/index.mjs` (council case ~168–176; add exported `councilProgressLine`)
- Test: `app/sidecar/tests/index-progress.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `app/sidecar/tests/index-progress.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { councilProgressLine } from "../index.mjs";

test("councilProgressLine wraps an event with id and type", () => {
  const msg = councilProgressLine("r7", { seq: 1, ts: 123, kind: "voice_started" });
  assert.deepEqual(msg, {
    id: "r7",
    type: "council_progress",
    event: { seq: 1, ts: 123, kind: "voice_started" },
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && node --test sidecar/tests/index-progress.test.mjs`
Expected: FAIL — `councilProgressLine` is not exported.

- [ ] **Step 3: Implement**

In `app/sidecar/index.mjs`, add the exported builder near the top (after `send`):

```js
/** Build a progress line correlated to a request id. Exported for testing. */
export function councilProgressLine(id, event) {
  return { id, type: "council_progress", event };
}
```

In the `case "council"` block, pass an `onEvent` that emits progress lines:

```js
      case "council": {
        const result = await runCouncil({
          question: msg.question,
          evidence: msg.evidence ?? [],
          model: msg.model ?? "sonnet",
          settings: msg.settings ?? {},
          onEvent: (event) => send(councilProgressLine(id, event)),
        });
        return { id, type: "council_result", result };
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && node --test sidecar/tests/index-progress.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add the new test file to the `check` script**

`app/package.json` runs sidecar tests via the `"test:sidecar"` glob `node --test "sidecar/tests/*.test.mjs"`, which already includes the new file. Also add a `node --check` for `index.mjs`'s new export by confirming the existing `node --check sidecar/index.mjs` in `"check"` still passes:

Run: `cd app && node --check sidecar/index.mjs && node --test sidecar/tests/index-progress.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/sidecar/index.mjs app/sidecar/tests/index-progress.test.mjs
git commit -m "feat(sidecar): forward council events as council_progress lines"
```

---

## Task 4: Pure `classify_sidecar_line` in Rust

**Files:**
- Modify: `app/src-tauri/src/sidecar.rs` (add enum + fn + `#[cfg(test)]`)

- [ ] **Step 1: Write the failing test**

Append to `app/src-tauri/src/sidecar.rs`:

```rust
#[cfg(test)]
mod classify_tests {
    use super::{classify_sidecar_line, SidecarLine};

    #[test]
    fn progress_line_is_progress() {
        let line = r#"{"id":"r1","type":"council_progress","event":{"kind":"voice_started","seq":1}}"#;
        match classify_sidecar_line(line, "r1") {
            SidecarLine::Progress(ev) => {
                assert_eq!(ev.get("kind").and_then(|v| v.as_str()), Some("voice_started"));
            }
            _ => panic!("expected Progress"),
        }
    }

    #[test]
    fn result_line_is_result() {
        let line = r#"{"id":"r1","type":"council_result","result":{"ok":true}}"#;
        assert!(matches!(classify_sidecar_line(line, "r1"), SidecarLine::Result(_)));
    }

    #[test]
    fn error_line_is_app_error() {
        let line = r#"{"id":"r1","type":"error","error":"boom"}"#;
        match classify_sidecar_line(line, "r1") {
            SidecarLine::AppError(m) => assert_eq!(m, "boom"),
            _ => panic!("expected AppError"),
        }
    }

    #[test]
    fn wrong_id_is_mismatch() {
        let line = r#"{"id":"r2","type":"council_result","result":{}}"#;
        assert!(matches!(classify_sidecar_line(line, "r1"), SidecarLine::IdMismatch));
    }

    #[test]
    fn bad_json_is_malformed() {
        assert!(matches!(classify_sidecar_line("not json", "r1"), SidecarLine::Malformed(_)));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app/src-tauri && cargo test classify_tests`
Expected: FAIL to compile — `classify_sidecar_line` / `SidecarLine` not found.

- [ ] **Step 3: Implement**

In `app/src-tauri/src/sidecar.rs` (after the `SidecarError` impl, before `struct Sidecar`):

```rust
/// One classified line from the sidecar's stdout, relative to an expected id.
pub enum SidecarLine {
    /// An interleaved `council_progress` event payload.
    Progress(Value),
    /// The terminal result payload (may be `Null` if the field is absent).
    Result(Value),
    /// A clean handler error — the process stays healthy.
    AppError(String),
    /// The line's `id` did not match the in-flight request.
    IdMismatch,
    /// The line was not valid JSON.
    Malformed(String),
}

/// Pure classification of a single stdout line. No I/O; unit-tested.
pub fn classify_sidecar_line(line: &str, expected_id: &str) -> SidecarLine {
    let v: Value = match serde_json::from_str(line.trim()) {
        Ok(v) => v,
        Err(e) => return SidecarLine::Malformed(e.to_string()),
    };
    if v.get("id").and_then(Value::as_str) != Some(expected_id) {
        return SidecarLine::IdMismatch;
    }
    match v.get("type").and_then(Value::as_str) {
        Some("council_progress") => {
            SidecarLine::Progress(v.get("event").cloned().unwrap_or(Value::Null))
        }
        Some("error") => SidecarLine::AppError(
            v.get("error")
                .and_then(Value::as_str)
                .unwrap_or("unknown sidecar error")
                .to_string(),
        ),
        _ => SidecarLine::Result(v.get("result").cloned().unwrap_or(Value::Null)),
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app/src-tauri && cargo test classify_tests`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/sidecar.rs
git commit -m "feat(sidecar-rs): pure classify_sidecar_line for streamed lines"
```

---

## Task 5: `request_streaming` read loop (and refactor `request` to delegate)

**Files:**
- Modify: `app/src-tauri/src/sidecar.rs` (`Sidecar::request` ~189–244; `SidecarState::request` ~259–287)

This is integration code over a live child process — not unit-testable in `cargo test`; it is verified by `cargo check`/`clippy` here and by the e2e map spec in P2. Keep `request`'s public behavior identical (DRY: it becomes `request_streaming` with a no-op closure).

- [ ] **Step 1: Replace `Sidecar::request` with a streaming version + thin wrapper**

In `app/src-tauri/src/sidecar.rs`, replace the whole `pub async fn request(...)` body with:

```rust
    /// Send a request and read interleaved progress lines until the terminal
    /// result/error. `on_progress` is called for each `council_progress` event.
    pub async fn request_streaming<F: FnMut(Value)>(
        &mut self,
        kind: &str,
        mut body: Value,
        mut on_progress: F,
    ) -> Result<Value, SidecarError> {
        self.next_id += 1;
        let id = format!("r{}", self.next_id);
        body["id"] = Value::String(id.clone());
        body["type"] = Value::String(kind.to_string());

        let line = serde_json::to_string(&body)
            .map_err(|e| SidecarError::Transport(format!("sidecar request encode: {e}")))?;
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| SidecarError::Transport(format!("sidecar stdin write: {e}")))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| SidecarError::Transport(format!("sidecar stdin newline: {e}")))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| SidecarError::Transport(format!("sidecar stdin flush: {e}")))?;

        loop {
            let mut buf = String::new();
            let n = self
                .reader
                .read_line(&mut buf)
                .await
                .map_err(|e| SidecarError::Transport(format!("sidecar stdout read: {e}")))?;
            if n == 0 {
                return Err(SidecarError::Transport(
                    "sidecar closed stdout before responding".to_string(),
                ));
            }
            match classify_sidecar_line(buf.trim(), &id) {
                SidecarLine::Progress(event) => {
                    on_progress(event);
                    continue;
                }
                SidecarLine::AppError(msg) => return Err(SidecarError::App(msg)),
                SidecarLine::IdMismatch => {
                    return Err(SidecarError::Transport(format!(
                        "sidecar response id mismatch: {buf}"
                    )));
                }
                SidecarLine::Malformed(e) => {
                    return Err(SidecarError::Transport(format!(
                        "sidecar: malformed response `{}`: {e}",
                        buf.trim()
                    )));
                }
                SidecarLine::Result(Value::Null) => {
                    return Err(SidecarError::Transport(
                        "sidecar response missing `result`".to_string(),
                    ));
                }
                SidecarLine::Result(v) => return Ok(v),
            }
        }
    }

    /// Non-streaming request: ignores progress events.
    pub async fn request(&mut self, kind: &str, body: Value) -> Result<Value, SidecarError> {
        self.request_streaming(kind, body, |_| {}).await
    }
```

- [ ] **Step 2: Add a streaming method on `SidecarState`**

In `app/src-tauri/src/sidecar.rs`, add to `impl SidecarState` (mirror `request`, threading the closure). Place it after the existing `request` method:

```rust
    pub async fn request_streaming<F: FnMut(Value)>(
        &self,
        app: &AppHandle,
        kind: &str,
        body: Value,
        on_progress: F,
    ) -> Result<Value, String> {
        let mut guard = self.inner.lock().await;
        if guard.is_none() {
            *guard = Some(Sidecar::spawn(app).await?);
        }
        let Some(sidecar) = guard.as_mut() else {
            return Err("sidecar was not initialized".to_string());
        };
        match tokio::time::timeout(
            SIDECAR_REQUEST_TIMEOUT,
            sidecar.request_streaming(kind, body, on_progress),
        )
        .await
        {
            Ok(Ok(value)) => Ok(value),
            Ok(Err(err @ SidecarError::App(_))) => Err(err.into_message()),
            Ok(Err(err @ SidecarError::Transport(_))) => {
                *guard = None;
                Err(err.into_message())
            }
            Err(_) => {
                *guard = None;
                Err(format!(
                    "sidecar request `{kind}` timed out after {}s",
                    SIDECAR_REQUEST_TIMEOUT.as_secs()
                ))
            }
        }
    }
```

- [ ] **Step 3: Verify it compiles and existing tests pass**

Run: `cd app/src-tauri && cargo check && cargo test && cargo clippy --no-deps -- -D warnings`
Expected: PASS, no warnings. (The `request` refactor preserves behavior for all existing callers.)

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/sidecar.rs
git commit -m "feat(sidecar-rs): request_streaming read loop; request delegates to it"
```

---

## Task 6: `ask_council` accepts a Channel and emits Rust-origin + forwarded events

**Files:**
- Modify: `app/src-tauri/src/lib.rs` (`ask_council` ~2879–3026)

Integration code; verified by `cargo check`/`clippy` here and the P2 e2e map spec. The command's return value is unchanged.

- [ ] **Step 1: Add the Channel param and an emit helper**

In `app/src-tauri/src/lib.rs`, add the import near the top (with the other `use` lines):

```rust
use tauri::ipc::Channel;
```

Change the `ask_council` signature to add the channel parameter (after `app`):

```rust
async fn ask_council(
    app: AppHandle,
    on_progress: Channel<serde_json::Value>,
    state: tauri::State<'_, SidecarState>,
    user_state: tauri::State<'_, UserDbState>,
    question: String,
    model: Option<String>,
    evidence_limit: Option<i64>,
    retrieval_translation: Option<String>,
    retrieval_strategy: Option<String>,
    include_cross_refs: Option<bool>,
    book_id: Option<i64>,
    testament: Option<String>,
    start_verse_id: Option<i64>,
    end_verse_id: Option<i64>,
) -> Result<serde_json::Value, String> {
```

At the very start of the body (after the empty/too-long checks, before sensitive routing), add a monotonic emitter:

```rust
    let seq = std::cell::Cell::new(0u64);
    let emit = |kind: &str, payload: serde_json::Value| {
        seq.set(seq.get() + 1);
        let mut ev = serde_json::json!({
            "seq": seq.get(),
            "ts": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            "kind": kind,
        });
        if let Some(obj) = payload.as_object() {
            for (k, v) in obj {
                ev[k] = v.clone();
            }
        }
        let _ = on_progress.send(ev);
    };
```

- [ ] **Step 2: Emit the Rust-origin stage events**

In the sensitive-topic branch, emit before returning:

```rust
    if let Some(category) = classify_sensitive_topic(&question) {
        emit("safety_checked", serde_json::json!({ "status": "blocked", "category": category }));
        return Ok(serde_json::json!({
            "sensitive_topic": { "category": category, "message": SENSITIVE_TOPIC_MESSAGE }
        }));
    }
    emit("safety_checked", serde_json::json!({ "status": "clear" }));
```

After `retrieval_options` is built and before `retrieve_evidence`, emit `run_started` + `retrieval_started`:

```rust
    emit("run_started", serde_json::json!({ "evidence_strategy": retrieval_options.strategy }));
    emit("retrieval_started", serde_json::json!({ "strategy": retrieval_options.strategy }));
```

After `retrieve_evidence` returns (and after the empty check), emit fallback (if any) + done:

```rust
    if let Some(reason) = &retrieval_fallback_reason {
        emit("retrieval_fallback", serde_json::json!({ "reason": reason }));
    }
    emit("retrieval_done", serde_json::json!({ "count": evidence_json.len(), "mode": retrieval_mode }));
```

- [ ] **Step 3: Forward sidecar events and emit completion**

Replace `let mut result = state.request(&app, "council", body).await?;` with a streaming call that forwards each sidecar event through the same emitter:

```rust
    let mut result = state
        .request_streaming(&app, "council", body, |event| {
            // Re-stamp seq via emit so the channel carries one monotonic order.
            let kind = event
                .get("kind")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            emit(&kind, event);
        })
        .await?;
```

> Note: `emit` overwrites `seq`/`ts` keys on the forwarded event, giving a single authoritative ordering; other payload keys (provider, ms, …) are preserved.

At the end of the function, just before `Ok(result)`, emit completion (after `session_id` may have been set):

```rust
    emit(
        "run_complete",
        serde_json::json!({
            "session_id": result.get("session_id").cloned().unwrap_or(serde_json::Value::Null),
            "synthesis_mode": result.get("synthesis_mode").cloned().unwrap_or(serde_json::Value::Null),
        }),
    );
    Ok(result)
```

- [ ] **Step 4: Verify it compiles, is lint-clean, and tests pass**

Run: `cd app/src-tauri && cargo fmt && cargo check && cargo test && cargo clippy --no-deps -- -D warnings`
Expected: PASS, no warnings. (`ask_council` is already in the `invoke_handler!` list at lib.rs ~4562; the new Channel arg needs no registration change.)

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/lib.rs
git commit -m "feat(council): stream safety/retrieval/voice/synthesis/judged progress over a Channel"
```

---

## Task 7: Typed frontend transport — `askCouncil(onProgress)`

**Files:**
- Modify: `app/src/lib/bible.ts` (`askCouncil` ~268–284; add `CouncilProgressEvent`)

- [ ] **Step 1: Add the event type and channel-based progress to the wrapper**

In `app/src/lib/bible.ts`, add the import at the top (with the other imports):

```ts
import { Channel } from "@tauri-apps/api/core";
```

Add the type (near `CouncilResponse`):

```ts
export interface CouncilProgressEvent {
  seq: number;
  ts: number;
  kind:
    | "run_started"
    | "safety_checked"
    | "retrieval_started"
    | "retrieval_fallback"
    | "retrieval_done"
    | "voice_started"
    | "voice_done"
    | "voice_failed"
    | "synthesis_started"
    | "synthesis_fallback"
    | "judged"
    | "run_complete";
  [key: string]: unknown;
}
```

Replace the `askCouncil` export with an optional progress callback wired through a `Channel`:

```ts
export const askCouncil = (
  question: string,
  model?: string,
  options: CouncilRetrievalOptions = {},
  onProgress?: (event: CouncilProgressEvent) => void,
) => {
  const channel = new Channel<CouncilProgressEvent>();
  if (onProgress) channel.onmessage = onProgress;
  return invoke<CouncilResponse>("ask_council", {
    onProgress: channel,
    question,
    model,
    retrievalStrategy: options.strategy,
    includeCrossRefs: options.include_cross_refs,
    retrievalTranslation: options.translation_code,
    bookId: options.book_id,
    testament: options.testament,
    startVerseId: options.start_verse_id,
    endVerseId: options.end_verse_id,
    evidenceLimit: options.evidence_limit,
  });
};
```

> The Tauri arg key `onProgress` maps to the Rust parameter `on_progress`. Existing callers pass no fourth argument and are unaffected.

- [ ] **Step 2: Verify the frontend type-checks and builds**

Run: `cd app && npm run build`
Expected: PASS (tsc + vite). No call sites break (the new parameter is optional).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/bible.ts
git commit -m "feat(council): typed askCouncil onProgress channel transport"
```

---

## Task 8: Full green check

- [ ] **Step 1: Run the whole verification suite**

Run: `cd app && npm run check`
Expected: PASS — vite build, `cargo fmt --check`, `cargo check`, `cargo test` (incl. `classify_tests`), `cargo clippy -D warnings`, all `node --check`, the quality/leak gates, and `test:sidecar` (incl. the new event-sequence + `index-progress` tests).

- [ ] **Step 2: Commit any formatting fixups**

```bash
git add -A
git commit -m "chore: P1 realtime council progress — full check green" || echo "nothing to commit"
```

---

## Self-Review

- **Spec coverage (§5):** event taxonomy → Tasks 1/2/6 (all kinds emitted); sidecar `onEvent` + `index.mjs` wiring → Tasks 1–3; Rust Channel + read-loop forwarding → Tasks 4–6; final result unchanged → Task 6 (return value untouched); deterministic mock path → Task 1 (`emitMockSequence` mirrors the mock result). `useCouncilRun` + the animated map are **intentionally deferred to P2** (noted in the plan header), since they need a UI to be testable.
- **Placeholder scan:** none — every code step shows complete code; every run step shows the exact command + expected outcome.
- **Type consistency:** `emit(kind, payload)` shape, the `{seq,ts,kind,...}` event object, `classify_sidecar_line`/`SidecarLine`, `request_streaming`, and the JS `CouncilProgressEvent.kind` union all match across Node, Rust, and TS. The Tauri arg `onProgress` ↔ Rust `on_progress` mapping is called out.
- **Risk note:** Tasks 5/6 are integration-level (live child process / Tauri command) and are compile-and-lint verified here; their runtime behavior is asserted by the P2 `council-run-map.spec` against the deterministic mock from Task 1.
