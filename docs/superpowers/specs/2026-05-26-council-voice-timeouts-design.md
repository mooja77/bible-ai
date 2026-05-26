# Council Per-Voice Timeouts — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `council-voice-timeouts`)
- **Theme:** B — Council AI trust/UX, sub-project 3
- **Owner:** John Moore

## Problem

The Council runs every available provider in parallel (`Promise.all` over `runOneVoice`). Each
provider already does its own retries (up to 3×) with a generous per-attempt timeout (OpenAI:
`DEFAULT_TIMEOUT_MS = 600_000` = 600s; the other HTTP providers are comparable), all under a single
**1800s global** sidecar timeout. So one slow or hung provider can consume close to the entire
30-minute budget while the other voices finished in seconds — and the user waits the whole time,
or the whole run times out. There is no wall-clock cap on an individual voice.

## Goals

1. Cap how long any single voice can hold up the Council, so it returns promptly with the voices
   that completed.
2. Make a timed-out voice legible: it shows as a failed voice with a `timeout` category + a clear
   hint, not a silent loss or a misleading "network" error.
3. Integrate with the existing Council features (error clarity, synthesis honesty) rather than
   duplicating their machinery.

## Non-goals (YAGNI)

- No request cancellation. `Promise.race` doesn't abort the underlying fetch; the orphaned request
  finishes in the background and its result is discarded (harmless). Abort-on-timeout would require
  threading an `AbortSignal` through every provider — deferred.
- No per-provider timeout/retry tuning (option 2) — the wall-clock cap is uniform and simpler.
- No frontend change — timed-out voices render through the existing error-voice card (category
  badge + hint), and `synthesis_mode` already covers "some voices dropped."
- No Rust change; no schema/migration.

## Approach

**Wrap each voice in a per-voice wall-clock timeout.** A pure `withTimeout(promise, ms, label)`
races the voice's `analyze` against a timer; on timeout it rejects with a labeled error, which the
existing `runOneVoice` `catch` turns into a classified error voice. A new `timeout` category in
`classifyProviderError` gives it an accurate hint.

## Sidecar design

### `withTimeout(promise, ms, label)` (pure, exported, `council.mjs`)

```js
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
```

(The `.finally(clearTimeout)` prevents the timer from keeping the event loop alive after the
promise settles.)

### Per-voice timeout value (`council.mjs`)

```js
const DEFAULT_VOICE_TIMEOUT_MS = 300_000; // 5 min — generous for slow reasoning models,
                                          // but bounds the ~30-min retry pathology.
function voiceTimeoutMs(env = process.env) {
  const parsed = Number(env.BIBLE_AI_VOICE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VOICE_TIMEOUT_MS;
}
```

### `runOneVoice` wiring

Hoist `displayName` to the top (it's currently computed in both branches), then wrap `analyze`:

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
    return { provider: provider.name, display_name: displayName, status: "ok", result, error: null, duration_ms: Date.now() - started };
  } catch (err) {
    const error = redactSecrets(err?.message ?? String(err), env);
    log(`voice ${provider.name} failed:`, error);
    const { category, hint } = classifyProviderError(error, displayName);
    return { provider: provider.name, display_name: displayName, status: "error", result: null, error, error_category: category, error_hint: hint, duration_ms: Date.now() - started };
  }
}
```

A timed-out voice becomes a `status: "error"` voice whose message contains "timed out", so it flows
through the existing partial-fail / all-fail / `synthesis_mode` logic with no other changes.

### `classifyProviderError` — add a `timeout` category (`providers/_shared.mjs`)

Add a branch **before** `network`, and remove the timeout needles from the `network` branch:

```js
if (has("timed out", "timeout", "etimedout")) {
  return {
    category: "timeout",
    hint: `${provider} took too long and was skipped — it may be overloaded; try again.`,
  };
}
```

(The `network` branch keeps `econnrefused`, `enotfound`, `fetch failed`, `network`, `ollama serve`,
`not reachable`, `socket hang up`.)

## Data flow

```
runCouncil → Promise.all(runOneVoice ...)
  runOneVoice: withTimeout(provider.analyze(...), voiceTimeoutMs, displayName)
    → resolves in time  → ok voice
    → exceeds timeout    → rejects "… timed out after 300s" → catch → error voice
        (classifyProviderError → category "timeout" + hint)
  → ok voices ≥ 2 → consensus; == 1 → single_voice banner; 0 → all-fail throw enumerates them
```

## Error handling / edge cases

- Timed-out voice = normal error voice; no special-casing downstream.
- All voices time out → existing all-fail throw enumerates each (`• {voice}: timeout — {hint}`).
- Orphaned request after a race loss: completes/errs in the background, result discarded; the
  sidecar process is long-lived, so no leak accumulates per run beyond the orphan itself.
- `voiceTimeoutMs` guards non-numeric/zero/negative env values → falls back to the default.
- Mock mode returns before `runOneVoice`, so it's unaffected (no timeouts in tests/e2e).

## Testing

- **Sidecar unit tests** (`node --test`):
  - `council.test.mjs` — `withTimeout(Promise.resolve("x"), 1000, "L")` resolves to `"x"`;
    `withTimeout(new Promise(() => {}), 10, "OpenAI")` rejects with a message matching `/timed out/`.
  - `shared.test.mjs` — `classifyProviderError("OpenAI timed out after 300s", "OpenAI")` →
    `category: "timeout"`, hint mentions the provider; confirm an existing network case (e.g.
    ECONNREFUSED) still → `network`.
- **Frontend:** none. `npm run build` is unaffected (no TS change), but the full gate still runs it.
- No e2e — a provider can't be made to hang deterministically in the mocked env (mock bypasses
  `runOneVoice`).
- Full `npm run check` green before merge.

## Risks & mitigations

- **Timeout too low kills legit slow voices** → default 300s is generous for current reasoning
  models and well under the 1800s global; env-overridable (`BIBLE_AI_VOICE_TIMEOUT_MS`) if a
  deployment needs longer.
- **Orphaned in-flight request** → harmless (discarded; process is long-lived). Abort-on-timeout
  deferred as a noted future improvement.
- **Classifier change touches the prior feature** → it's an additive category + a needle move with
  a new test; the existing network/ollama test still passes (ECONNREFUSED stays network).

## Rollout

Single feature branch `council-voice-timeouts`. Changes confined to `sidecar/council.mjs`,
`sidecar/providers/_shared.mjs`, `sidecar/tests/council.test.mjs`, and
`sidecar/tests/shared.test.mjs`. Verify with `npm run check` (+ optional manual smoke: set
`BIBLE_AI_VOICE_TIMEOUT_MS=1` and run the Council to see voices time out and the run still return)
before merge to `main`.
