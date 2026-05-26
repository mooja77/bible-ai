# Council Provider Error Clarity — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `council-error-clarity`)
- **Theme:** B — Council AI trust/UX, sub-project 1
- **Owner:** John Moore

## Problem

When a Council voice (AI provider) fails, the user sees a raw, uncategorized message and often
can't tell what to do. Two concrete failure modes:

- **All voices fail:** `runCouncil` throws `"council: all voices failed — first error: " +
  voices[0].error` — a single, lossy line (only the *first* provider's raw error) shown in a
  `<pre>` in `CouncilPanel`. The other providers' errors are discarded.
- **Some voices fail (≥1 succeeds):** the council returns normally; the failed voices render in a
  `VoiceCard` showing the **raw** `voice.error` (e.g. `"Anthropic 401 Unauthorized: …"`), with no
  category or remediation.

The providers already throw recognizable, status-bearing messages (`"Anthropic 401 …"`,
`"Gemini 429 …"`, `"OpenAI 401 …"`, `"Managed Gateway 503 …"`, Ollama "is `ollama serve`
running?"), so failures are **classifiable** — the data is there; it just isn't turned into a
category + a fix hint.

## Goals

1. For each failed voice, tell the user **which** provider failed, **why** (a category), and **how
   to fix it** (an actionable hint).
2. Stop discarding information when *all* voices fail — enumerate every provider's failure.
3. Keep secrets redacted (classification runs on the already-redacted message).

## Non-goals (YAGNI)

- No change to the council return contract (all-fail still throws; partial-fail still returns the
  `voices` array). The structured-response / "fix in Settings" buttons approach is deferred.
- No pre-flight diagnostics gate.
- No retry/backoff changes (providers already handle retryable statuses internally).
- **No Rust change** — `validate_council_voice_value` (user_db.rs) checks only
  `provider`/`display_name`/`status` (+ `result` for ok voices) and ignores unknown fields, so the
  new voice fields pass validation and persist as-is. Confirmed.

## Approach

**Enrich errors in place.** A pure sidecar helper classifies each provider error into a category +
hint; failed voices carry `error_category` + `error_hint`; the all-fail throw enumerates every
provider; the frontend renders a category badge + hint on failed-voice cards (and the enriched
multi-line message in the top error). Smallest, safest change; fixes both failure modes.

## Sidecar design

### `classifyProviderError(message, providerName)` (in `providers/_shared.mjs`)

Pure function: `(message: string, providerName: string) -> { category, hint }`. Priority-ordered
keyword/status matching on the (already-redacted) message:

| category | matches (case-insensitive) | hint |
|----------|----------------------------|------|
| `auth` | `401`, `403`, `unauthorized`, `invalid api key`, `api key not valid`, `permission denied` | `Check or add the {provider} API key in Settings.` |
| `quota` | `429`, `quota`, `rate limit`, `too many requests`, `insufficient_quota`, `exceeded`, `billing` | `{provider} hit a rate limit or quota — wait a minute, or check your plan/billing.` |
| `network` | `ECONNREFUSED`, `ENOTFOUND`, `fetch failed`, `network`, `timeout`, `timed out`, `ollama serve`, `is \`...\` running`, `not reachable` | Ollama → `Start Ollama (\`ollama serve\`) and make sure the model is pulled.`; else `Couldn't reach {provider} — check your internet connection.` |
| `server` | `500`–`504`, `server error`, `service unavailable`, `bad gateway`, `gateway timeout` | `{provider} had a temporary server error — try again shortly.` |
| `parse` | `no JSON`, `not an object`, `positions array`, `no text`, `no message content`, `unreadable`, `could not parse` | `{provider} returned a response the Council couldn't read — try again.` |
| `unknown` | (fallback) | `{provider} failed — try again, or check its key in Settings.` |

Matching is priority-ordered (auth → quota → network → server → parse → unknown) so e.g. a `429`
maps to quota even though it's also an HTTP status. `providerName` is the voice's `display_name`.
The Ollama-specific network hint is selected when the message contains `ollama`.

### `runOneVoice` (in `council.mjs`)

In the `catch`, after computing the redacted `error`, also compute
`const { category, hint } = classifyProviderError(error, displayName)` and include
`error_category: category` and `error_hint: hint` on the returned error-voice object. (OK voices
are unchanged.)

### All-voices-fail throw (in `runCouncil`)

Replace the lossy single-line throw with an enumeration of every voice:

```
Every Council voice failed:
• {display_name}: {error_category} — {error_hint}
• {display_name}: {error_category} — {error_hint}
```

(One line per voice, built from the enriched voice objects.) This multi-line message propagates as
the council error string and renders in the existing top-level `<pre>`.

## Frontend design

- **`bible.ts`:** add optional `error_category?: string` and `error_hint?: string` to the
  `CouncilVoice` interface.
- **`CouncilPanel.tsx` `VoiceCard`:** for an error voice, render a small category badge (e.g.
  `auth` / `quota` / `network` / `server` / `parse`) next to the existing "✗ error" label, and
  render `voice.error_hint` (when present) as a short, readable line beneath the raw `voice.error`.
  The raw message stays available (it's the ground truth); the hint is the actionable layer.
- The top-level all-fail error already renders the (now enriched, multi-line) message in a `<pre>`;
  no structural change there.

## Data flow

```
provider.analyze throws "Anthropic 401 Unauthorized: …"
  → runOneVoice catch: error = redactSecrets(msg); { category, hint } = classifyProviderError(error, "Anthropic")
  → voice = { provider, display_name, status:"error", error, error_category:"auth", error_hint:"Check or add the Anthropic API key…", duration_ms }
  → partial fail: returned in voices[] → VoiceCard shows badge + hint
  → all fail: runCouncil throws "Every Council voice failed:\n• Anthropic: auth — …\n• …" → top <pre>
```

## Error handling / edge cases

- `error_category`/`error_hint` are optional everywhere; older persisted sessions (without them)
  render exactly as today.
- Classification never throws (pure string matching with a fallback to `unknown`).
- Secrets: classification runs on the already-`redactSecrets`'d message, so no key can leak into a
  hint.
- Persistence: enriched error voices pass `validate_council_voice_value` (ignores unknown fields)
  and are stored/reloaded intact.

## Testing

- **Sidecar unit tests** (`sidecar/tests/shared.test.mjs`, via `node --test`): `classifyProviderError`
  maps representative raw messages to the right category + a hint mentioning the provider:
  `"Anthropic 401 Unauthorized: …"` → `auth`; `"OpenAI 429 Too Many Requests: …"` → `quota`;
  `"ollama request failed (is \`ollama serve\` running?)"` → `network` (with the Ollama hint);
  `"Managed Gateway 503 Service Unavailable: …"` → `server`; `"OpenAI: no JSON found in response…"`
  → `parse`; an unrecognized message → `unknown`.
- **Frontend:** no JS unit runner and provider failures can't be triggered deterministically in the
  mocked e2e env (mock mode bypasses providers), so the `VoiceCard` change is verified by
  `npm run build` (tsc) and manual smoke; no new e2e spec.
- Full `npm run check` green (includes the sidecar tests) before merge.

## Risks & mitigations

- **Misclassification** (a message matches the wrong bucket) → priority ordering + a safe `unknown`
  fallback; the raw error is always still shown, so the hint is additive, never replacing truth.
- **Provider message drift** (a provider changes its error text) → classification degrades to
  `unknown` with a generic-but-still-useful hint; no crash.
- **Scope creep** → explicitly no contract change and no Rust change (both confirmed unnecessary).

## Rollout

Single feature branch `council-error-clarity`. Changes confined to `sidecar/providers/_shared.mjs`,
`sidecar/council.mjs`, `sidecar/tests/shared.test.mjs`, `src/lib/bible.ts`, and
`src/features/council/CouncilPanel.tsx`. Verify with `npm run check` (+ manual smoke of a forced
failure, e.g. a bad key) before merge to `main`.
