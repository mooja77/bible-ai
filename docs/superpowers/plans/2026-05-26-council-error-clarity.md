# Council Provider Error Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn raw, lossy Council provider failures into categorized, actionable messages (which provider, why, how to fix).

**Architecture:** A pure sidecar `classifyProviderError(message, providerName) → { category, hint }`; `runOneVoice` attaches `error_category`/`error_hint` to failed voices; the all-voices-fail throw enumerates every provider; the frontend shows a category badge + fix hint on failed-voice cards. No council-contract change, no Rust change (council-voice validation ignores unknown fields).

**Tech Stack:** Node sidecar (ESM, `node:test`), React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-council-error-clarity-design.md`

**Verification note:** Provider failures can't be triggered deterministically in the mocked e2e env (mock mode bypasses providers), so the classifier is covered by sidecar unit tests and the frontend by `npm run build`; no new e2e.

---

## File Structure

- `app/sidecar/providers/_shared.mjs` — add the pure `classifyProviderError` (export). *(Task 1)*
- `app/sidecar/tests/shared.test.mjs` — unit tests for `classifyProviderError`. *(Task 1)*
- `app/sidecar/council.mjs` — `runOneVoice` enrichment + all-fail enumeration. *(Task 2)*
- `app/src/lib/bible.ts` — extend `CouncilVoice`. *(Task 3)*
- `app/src/features/council/CouncilPanel.tsx` — `VoiceCard` badge + hint. *(Task 3)*

No backend/Rust change.

---

## Task 1: `classifyProviderError` + unit tests

**Files:**
- Modify: `app/sidecar/providers/_shared.mjs` (append at module scope, after the last function ~line 456).
- Test: `app/sidecar/tests/shared.test.mjs` (add import + tests).

- [ ] **Step 1: Write the failing tests**

In `shared.test.mjs`, add `classifyProviderError` to the existing import from `../providers/_shared.mjs`, then add:

```js
test("classifyProviderError: 401 → auth, hint names the provider + key", () => {
  const { category, hint } = classifyProviderError(
    "Anthropic 401 Unauthorized: invalid x-api-key",
    "Anthropic",
  );
  assert.equal(category, "auth");
  assert.match(hint, /Anthropic/);
  assert.match(hint, /api key/i);
});

test("classifyProviderError: 429 → quota", () => {
  assert.equal(
    classifyProviderError("OpenAI 429 Too Many Requests: rate limit", "OpenAI").category,
    "quota",
  );
});

test("classifyProviderError: ollama not running → network with ollama hint", () => {
  const { category, hint } = classifyProviderError(
    "ollama request failed (is `ollama serve` running?): ECONNREFUSED",
    "Ollama",
  );
  assert.equal(category, "network");
  assert.match(hint, /ollama serve/i);
});

test("classifyProviderError: 503 → server", () => {
  assert.equal(
    classifyProviderError("Managed Gateway 503 Service Unavailable: down", "Managed Gateway")
      .category,
    "server",
  );
});

test("classifyProviderError: no JSON → parse", () => {
  assert.equal(
    classifyProviderError("OpenAI: no JSON found in response. Raw: hello", "OpenAI").category,
    "parse",
  );
});

test("classifyProviderError: unrecognized → unknown", () => {
  assert.equal(classifyProviderError("something weird happened", "Gemini").category, "unknown");
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `app/sidecar`): `node --test tests/shared.test.mjs`
Expected: FAIL — `classifyProviderError is not a function` / `is not exported`.

- [ ] **Step 3: Implement the helper**

Append at module scope in `_shared.mjs`:

```js
/**
 * Classify a provider error message (already redacted) into a category + an
 * actionable hint. Priority-ordered (auth → quota → network → server → parse)
 * so e.g. a 429 maps to quota even though it is also an HTTP status. Never
 * throws; falls back to "unknown". Matching is case-insensitive; hints use the
 * provider's display name as given.
 */
export function classifyProviderError(message, providerName) {
  const provider = providerName || "The provider";
  const m = String(message ?? "").toLowerCase();
  const has = (...needles) => needles.some((n) => m.includes(n));

  if (
    has("401", "403", "unauthorized", "invalid api key", "api key not valid",
      "permission denied", "invalid_api_key")
  ) {
    return { category: "auth", hint: `Check or add the ${provider} API key in Settings.` };
  }
  if (
    has("429", "quota", "rate limit", "too many requests", "insufficient_quota",
      "exceeded", "billing")
  ) {
    return {
      category: "quota",
      hint: `${provider} hit a rate limit or quota — wait a minute, or check your plan/billing.`,
    };
  }
  if (
    has("econnrefused", "enotfound", "fetch failed", "network", "timeout", "timed out",
      "etimedout", "socket hang up", "ollama serve", "not reachable")
  ) {
    const hint = m.includes("ollama")
      ? "Start Ollama (run `ollama serve`) and make sure the model is pulled."
      : `Couldn't reach ${provider} — check your internet connection.`;
    return { category: "network", hint };
  }
  if (
    has("500", "502", "503", "504", "server error", "service unavailable",
      "bad gateway", "gateway timeout")
  ) {
    return {
      category: "server",
      hint: `${provider} had a temporary server error — try again shortly.`,
    };
  }
  if (
    has("no json", "not an object", "positions array", "no text", "no message content",
      "no text content", "unreadable", "could not parse")
  ) {
    return {
      category: "parse",
      hint: `${provider} returned a response the Council couldn't read — try again.`,
    };
  }
  return {
    category: "unknown",
    hint: `${provider} failed — try again, or check its key in Settings.`,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run (from `app/sidecar`): `node --test tests/shared.test.mjs`
Expected: PASS (all classifyProviderError tests + the pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add app/sidecar/providers/_shared.mjs app/sidecar/tests/shared.test.mjs
git commit -m "feat(council): classifyProviderError helper for provider failures"
```

---

## Task 2: Enrich voices + enumerate the all-fail error (`council.mjs`)

**Files:**
- Modify: `app/sidecar/council.mjs` (import ~line 20–25; `runOneVoice` catch ~line 41–52; all-fail throw ~line 399–403).

- [ ] **Step 1: Import the helper**

In `council.mjs`, add `classifyProviderError` to the existing import from `./providers/_shared.mjs`:

```js
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisPrompt,
  parseResponse,
  redactSecrets,
  classifyProviderError,
} from "./providers/_shared.mjs";
```

- [ ] **Step 2: Enrich the failed-voice object in `runOneVoice`**

Replace the `catch (err) { ... }` block in `runOneVoice` (currently builds the error voice without category/hint) with:

```js
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
```

(The `ok` branch above it is unchanged.)

- [ ] **Step 3: Enumerate every provider in the all-fail throw**

Replace the current all-fail throw in `runCouncil`:

```js
  const ok = voices.filter((v) => v.status === "ok" && v.result);
  if (ok.length === 0) {
    throw new Error(
      "council: all voices failed — first error: " + (voices[0]?.error ?? "unknown"),
    );
  }
```

with:

```js
  const ok = voices.filter((v) => v.status === "ok" && v.result);
  if (ok.length === 0) {
    const lines = voices.map(
      (v) =>
        `• ${v.display_name}: ${v.error_category ?? "unknown"} — ${
          v.error_hint ?? v.error ?? "failed"
        }`,
    );
    throw new Error("Every Council voice failed:\n" + lines.join("\n"));
  }
```

- [ ] **Step 4: Verify syntax + suite still green**

Run (from `app/sidecar`): `node --check council.mjs && node --test tests/`
Expected: `node --check` clean; all sidecar tests pass (no regressions; the classifier tests from Task 1 included).

- [ ] **Step 5: Commit**

```bash
git add app/sidecar/council.mjs
git commit -m "feat(council): attach error category/hint to voices; enumerate all-fail"
```

---

## Task 3: Surface category + hint in the UI

**Files:**
- Modify: `app/src/lib/bible.ts` (`CouncilVoice` ~line 199–206).
- Modify: `app/src/features/council/CouncilPanel.tsx` (`VoiceCard` ~line 3046–3070).

- [ ] **Step 1: Extend the `CouncilVoice` type**

In `bible.ts`, replace the `CouncilVoice` interface with:

```ts
export interface CouncilVoice {
  provider: string;
  display_name: string;
  status: "ok" | "error" | "skipped";
  result: CouncilResult | null;
  error: string | null;
  error_category?: string;
  error_hint?: string;
  duration_ms: number;
}
```

- [ ] **Step 2: Render the category badge in `VoiceCard`**

In `CouncilPanel.tsx`, the header has `<span className="text-neutral-100">{voice.display_name}</span>` (~line 3055) inside a `<div className="flex items-center gap-2">`. Add a category badge right after that span:

```tsx
          <span className="text-neutral-100">{voice.display_name}</span>
          {isError && voice.error_category && (
            <span className="meta-pill text-xs text-red-300 border-red-500/40">
              {voice.error_category}
            </span>
          )}
```

- [ ] **Step 3: Render the hint in the error block**

Replace the current error block:

```tsx
      {isError && (
        <div className="px-3 py-2 border-t border-neutral-800 text-xs text-red-300">
          {voice.error}
        </div>
      )}
```

with (hint first, raw error beneath as ground truth):

```tsx
      {isError && (
        <div className="px-3 py-2 border-t border-neutral-800 text-xs">
          {voice.error_hint && (
            <p className="text-amber-200 mb-1">{voice.error_hint}</p>
          )}
          <p className="text-red-300">{voice.error}</p>
        </div>
      )}
```

- [ ] **Step 4: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/bible.ts app/src/features/council/CouncilPanel.tsx
git commit -m "feat(council): show provider error category + fix hint in voice cards"
```

---

## Task 4: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, node `--check`, sidecar tests including the new classifier tests).

- [ ] **Step 2: Manual smoke (optional but recommended)**

In the running app, set a deliberately wrong provider key (e.g. a bad OpenAI key) in Settings and run the Council; confirm the failed voice shows an `auth` badge + "Check or add the … API key in Settings" hint, with the raw error still visible beneath. With ALL providers misconfigured, confirm the top error enumerates each provider.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-26-council-error-clarity-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-council-error-clarity-design.md
git commit -m "docs(council): mark error-clarity spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** which/why/how per failed voice (Task 1 classifier + Task 2 enrichment + Task 3 badge/hint) ✓; all-fail enumerates every provider (Task 2 Step 3) ✓; secrets stay redacted — classifier runs on the already-`redactSecrets`'d `error` (Task 2 Step 2 computes `error` via `redactSecrets` first) ✓; no contract/Rust change (only the five listed files) ✓; raw error always shown beneath the hint (Task 3 Step 3) ✓; classifier unit tests, frontend via build, no e2e (Tasks 1, 3) ✓; categories auth/quota/network/server/parse/unknown consistent across helper, tests, and UI ✓.
- **Type consistency:** `classifyProviderError(message, providerName) → { category, hint }` used identically in Task 2; `CouncilVoice.error_category?`/`error_hint?` (Task 3) match the `error_category`/`error_hint` fields written in Task 2; `meta-pill` is an existing custom class.
- **Placeholder scan:** every step has complete code + exact commands; no TBD/vague steps.
