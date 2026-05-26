# Council Per-Voice Timeouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap each Council voice with a per-voice wall-clock timeout so one slow/hung provider can't hold up the whole run.

**Architecture:** A pure `withTimeout(promise, ms, label)` in the sidecar races each voice's `analyze` against a per-voice timer (default 300s, env-overridable); on timeout the voice becomes a normal error voice via the existing `runOneVoice` catch. A new `timeout` category in `classifyProviderError` gives it an accurate hint. No frontend/Rust/schema change — timed-out voices reuse the error-voice card and `synthesis_mode` machinery already shipped.

**Tech Stack:** Node sidecar (ESM, `node:test`).

**Spec:** `docs/superpowers/specs/2026-05-26-council-voice-timeouts-design.md`

**Verification note:** A provider can't be made to hang deterministically in the mocked e2e env (mock bypasses `runOneVoice`), so `withTimeout` and the new category are covered by sidecar unit tests; no e2e.

---

## File Structure

- `app/sidecar/council.mjs` — add `withTimeout` (export) + `voiceTimeoutMs`; wrap `provider.analyze` in `runOneVoice`. *(Task 1)*
- `app/sidecar/tests/council.test.mjs` — unit tests for `withTimeout`. *(Task 1)*
- `app/sidecar/providers/_shared.mjs` — add a `timeout` category to `classifyProviderError`. *(Task 2)*
- `app/sidecar/tests/shared.test.mjs` — unit test for the `timeout` category. *(Task 2)*

No frontend/Rust change.

---

## Task 1: `withTimeout` + per-voice timeout in `runOneVoice`

**Files:**
- Modify: `app/sidecar/council.mjs` (add helpers near the top after `const log = ...`; replace `runOneVoice` ~line 30–58).
- Test: `app/sidecar/tests/council.test.mjs` (import + 2 tests).

- [ ] **Step 1: Write the failing tests**

In `council.test.mjs`, change the import to `import { runCouncil, resolveSynthesisMode, withTimeout } from "../council.mjs";` and append:

```js
test("withTimeout: resolves with the value when the promise is fast", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 1000, "X"), "ok");
});

test("withTimeout: rejects with a timeout error when the promise is too slow", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 10, "OpenAI"),
    /timed out after/,
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `app/sidecar`): `node --test tests/council.test.mjs`
Expected: FAIL — `withTimeout is not a function` / not exported.

- [ ] **Step 3: Add `withTimeout` + `voiceTimeoutMs`**

In `council.mjs`, after `const log = (...args) => console.error("[council]", ...args);`, add:

```js
/**
 * Race a promise against a wall-clock timeout. On timeout, rejects with a
 * labeled Error. Does NOT cancel the underlying work (the loser keeps running
 * in the background and its result is discarded). The `.finally` clears the
 * timer so it can't keep the event loop alive after the race settles.
 */
export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const DEFAULT_VOICE_TIMEOUT_MS = 300_000; // 5 min — generous for slow models, bounds the retry pathology.
function voiceTimeoutMs(env = process.env) {
  const parsed = Number(env.BIBLE_AI_VOICE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VOICE_TIMEOUT_MS;
}
```

- [ ] **Step 4: Wrap `provider.analyze` in `runOneVoice`**

Replace the entire current `runOneVoice` function:

```js
async function runOneVoice(provider, { question, evidence, env, model }) {
  const started = Date.now();
  try {
    const result = await provider.analyze({ question, evidence, env, model });
    return {
      provider: provider.name,
      display_name: provider.displayName?.({ env, model }) ?? provider.display_name,
      status: "ok",
      result,
      error: null,
      duration_ms: Date.now() - started,
    };
  } catch (err) {
    const displayName =
      provider.displayName?.({ env, model }) ?? provider.display_name;
    const error = redactSecrets(err?.message ?? String(err), env);
    log(`voice ${provider.name} failed:`, error);
    const { category, hint } = classifyProviderError(error, displayName);
    return {
      provider: provider.name,
      display_name: displayName,
      status: "error",
      result: null,
      error,
      error_category: category,
      error_hint: hint,
      duration_ms: Date.now() - started,
    };
  }
}
```

with (hoist `displayName`; wrap `analyze` in `withTimeout`):

```js
async function runOneVoice(provider, { question, evidence, env, model }) {
  const started = Date.now();
  const displayName = provider.displayName?.({ env, model }) ?? provider.display_name;
  try {
    const result = await withTimeout(
      provider.analyze({ question, evidence, env, model }),
      voiceTimeoutMs(env),
      displayName,
    );
    return {
      provider: provider.name,
      display_name: displayName,
      status: "ok",
      result,
      error: null,
      duration_ms: Date.now() - started,
    };
  } catch (err) {
    const error = redactSecrets(err?.message ?? String(err), env);
    log(`voice ${provider.name} failed:`, error);
    const { category, hint } = classifyProviderError(error, displayName);
    return {
      provider: provider.name,
      display_name: displayName,
      status: "error",
      result: null,
      error,
      error_category: category,
      error_hint: hint,
      duration_ms: Date.now() - started,
    };
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run (from `app/sidecar`): `node --check council.mjs && node --test tests/`
Expected: `node --check` clean; ALL sidecar tests pass (the 2 new `withTimeout` tests + existing). A timed-out voice currently classifies as `network` (the dedicated `timeout` category arrives in Task 2) — that's fine for this task.

- [ ] **Step 6: Commit**

```bash
git add app/sidecar/council.mjs app/sidecar/tests/council.test.mjs
git commit -m "feat(council): per-voice wall-clock timeout (withTimeout)"
```

---

## Task 2: `timeout` category in `classifyProviderError`

**Files:**
- Modify: `app/sidecar/providers/_shared.mjs` (`classifyProviderError` — add a branch before `network`; remove timeout needles from `network`).
- Test: `app/sidecar/tests/shared.test.mjs` (1–2 tests).

- [ ] **Step 1: Write the failing test**

In `shared.test.mjs`, append:

```js
test("classifyProviderError: timed out → timeout (not network)", () => {
  const { category, hint } = classifyProviderError("OpenAI timed out after 300s", "OpenAI");
  assert.equal(category, "timeout");
  assert.match(hint, /OpenAI/);
});

test("classifyProviderError: ECONNREFUSED still → network", () => {
  assert.equal(
    classifyProviderError("Gemini: fetch failed ECONNREFUSED", "Gemini").category,
    "network",
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `app/sidecar`): `node --test tests/shared.test.mjs`
Expected: FAIL — the first test gets `network` (current behavior), not `timeout`.

- [ ] **Step 3: Add the `timeout` category and remove its needles from `network`**

In `classifyProviderError`, the current `network` branch is:

```js
  if (
    has("econnrefused", "enotfound", "fetch failed", "network", "timeout", "timed out",
      "etimedout", "socket hang up", "ollama serve", "not reachable")
  ) {
    const hint = m.includes("ollama")
      ? "Start Ollama (run `ollama serve`) and make sure the model is pulled."
      : `Couldn't reach ${provider} — check your internet connection.`;
    return { category: "network", hint };
  }
```

Insert a `timeout` branch **immediately before** it, and **remove** `"timeout", "timed out", "etimedout"` from the `network` branch's needles, so the two branches read:

```js
  if (has("timed out", "timeout", "etimedout")) {
    return {
      category: "timeout",
      hint: `${provider} took too long and was skipped — it may be overloaded; try again.`,
    };
  }
  if (
    has("econnrefused", "enotfound", "fetch failed", "network", "socket hang up",
      "ollama serve", "not reachable")
  ) {
    const hint = m.includes("ollama")
      ? "Start Ollama (run `ollama serve`) and make sure the model is pulled."
      : `Couldn't reach ${provider} — check your internet connection.`;
    return { category: "network", hint };
  }
```

(Priority becomes auth → quota → timeout → network → server → parse → unknown.)

- [ ] **Step 4: Run to verify pass**

Run (from `app/sidecar`): `node --check providers/_shared.mjs && node --test tests/`
Expected: `node --check` clean; ALL sidecar tests pass — the 2 new tests, plus the pre-existing `classifyProviderError` tests (the existing Ollama/ECONNREFUSED case still resolves to `network` since `econnrefused`/`ollama serve` stay there).

- [ ] **Step 5: Commit**

```bash
git add app/sidecar/providers/_shared.mjs app/sidecar/tests/shared.test.mjs
git commit -m "feat(council): dedicated timeout category for provider errors"
```

---

## Task 3: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, node `--check`, sidecar tests including the new `withTimeout` + `timeout`-category tests).

- [ ] **Step 2: Manual smoke (optional)**

Set `BIBLE_AI_VOICE_TIMEOUT_MS=1` in the app's environment and run a real Council with at least one provider configured; confirm voices time out, render as failed voices with a `timeout` badge + "took too long and was skipped" hint, and the run still returns promptly (rather than waiting the global 30-min timeout). Unset it afterward.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-26-council-voice-timeouts-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-council-voice-timeouts-design.md
git commit -m "docs(council): mark per-voice-timeouts spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** cap each voice's wall-clock time (Task 1 `withTimeout` + wrap, default 300s via `voiceTimeoutMs`, env override `BIBLE_AI_VOICE_TIMEOUT_MS`) ✓; timed-out voice legible as a `timeout` category + hint (Task 2) ✓; integrates with error-voice/`synthesis_mode` machinery (timed-out voice = normal error voice; no frontend change) ✓; no cancellation / no Rust / no schema (only the four sidecar files) ✓; mock unaffected (returns before `runOneVoice`) ✓; unit tests for `withTimeout` + the category, no e2e ✓.
- **Type consistency:** `withTimeout(promise, ms, label)` signature matches its call in `runOneVoice` and its tests; `voiceTimeoutMs(env)` returns ms used by the wrap; the `timeout` category string matches the test assertion; needles moved (not duplicated) from `network` to the new branch, and `network` retains `econnrefused`/`ollama serve` so the existing Ollama test still passes.
- **Placeholder scan:** every step has complete code + exact commands; no TBD/vague steps.
