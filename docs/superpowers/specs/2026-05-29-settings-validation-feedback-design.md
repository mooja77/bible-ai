# Onboarding & Settings D1 — Settings connection-field validation & feedback — Design

- **Date:** 2026-05-29
- **Status:** Implemented (branch `settings-validation-feedback`)
- **Theme:** D — Onboarding & settings, sub-project 1

## Problem

The Settings panel accepts any string in the **Managed gateway URL** and **Ollama host** fields with no
format feedback — the only signal a URL is wrong is a failed live provider test (a backend round-trip).
The **gateway token** field gives no hint when it's set but the URL is blank (the token is useless without
it). And the footer **"Saved"** confirmation never auto-clears (it only disappears on the next field edit),
so it lingers indefinitely. This sub-project adds lightweight, **advisory** inline validation + a
self-clearing save confirmation — improving the settings UX without changing the save flow.

## Goals

1. Inline error under the gateway URL / Ollama host fields when the value is non-empty and not a valid
   `http(s)` URL.
2. Inline warning under the gateway token field when a token is set but the gateway URL is empty.
3. Auto-clear the footer "Saved" confirmation after ~3s.

## Non-goals (YAGNI)

- **Do NOT block saving** on invalid input — validation is advisory only (keeps the existing save flow and
  e2e intact). The backend test remains the source of truth for connectivity.
- **Do NOT remove/consolidate the Save buttons** — `release-readiness.spec.ts` depends on both
  `button=Save & test` and `button=Save settings`; removing either breaks e2e.
- No change to field `aria-label`s (e2e selects `input[aria-label="Managed gateway URL"]` etc.).
- No key-shape validation (provider key formats vary); no required-field enforcement.

## Boundary analysis (from grounding)

- Fields render via `<Field label>` + `<input className="settings-input">` (SettingsPanel.tsx): gateway URL
  (575–584), gateway token (585–594), Ollama host (635–642). Edits go through `update(key, value)`
  (163–167) which sets the field + `setSaved(false)` + `setSaveError(null)`.
- `draft` holds the live values (`AppSettings`). Save is explicit via `submit()` (169–183); `saved` is a
  boolean shown at footer line 1204 + the "Settings saved" `SetupCheckPill` (495–499).
- `release-readiness.spec.ts:63` types `https://gateway.example.test` (a VALID URL) + a token (URL set) →
  advisory validation shows nothing there. Non-conflicting.
- `lib/settings.ts` is the settings-util home (`settingsHasConfiguredAi`).

## Design

### `app/src/lib/settings.ts` (add)

```ts
export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
```

### `app/src/features/settings/SettingsPanel.tsx` (modify)

- Import `isValidHttpUrl` from `../../lib/settings`.
- In the component body, derive (cheap, no memo needed):
  ```ts
  const gatewayUrlValue = draft.managed_gateway_url?.trim() ?? "";
  const ollamaHostValue = draft.ollama_host?.trim() ?? "";
  const gatewayTokenValue = draft.managed_gateway_token?.trim() ?? "";
  const gatewayUrlInvalid = gatewayUrlValue.length > 0 && !isValidHttpUrl(gatewayUrlValue);
  const ollamaHostInvalid = ollamaHostValue.length > 0 && !isValidHttpUrl(ollamaHostValue);
  const gatewayTokenNeedsUrl = gatewayTokenValue.length > 0 && gatewayUrlValue.length === 0;
  ```
- Under the **gateway URL** `<Field>`: `{gatewayUrlInvalid && <p data-testid="gateway-url-error"
  className="text-xs text-red-300">Enter a valid http(s):// URL.</p>}`.
- Under the **Ollama host** `<Field>`: `{ollamaHostInvalid && <p data-testid="ollama-host-error"
  className="text-xs text-red-300">Enter a valid http(s):// URL.</p>}`.
- Under the **gateway token** `<Field>`: `{gatewayTokenNeedsUrl && <p data-testid="gateway-token-warning"
  className="text-xs text-amber-300">Add the gateway URL above to use this token.</p>}`.
- Auto-clear `saved`:
  ```ts
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(t);
  }, [saved]);
  ```
  (Place near the other effects; `useEffect` is already imported.)

The `<input>` elements and their `aria-label`s are unchanged; the error/warning `<p>` is added as a
sibling inside the existing `<Field>` (so it sits under the input).

## Data flow / behavior

The derived booleans recompute each render from `draft`. They only render advisory text — they don't gate
`submit()`/`runChecks()`. The save confirmation now self-clears.

## Edge cases

- **Empty field** → no error (validation only when non-empty).
- **`http://localhost:11434`** (the Ollama placeholder) → valid (http). Good.
- **Trailing spaces** → trimmed before validating.
- **Save still works with an invalid URL** → intentional (advisory); the backend test surfaces real
  failures.
- **Auto-clear race** → the effect cleans up its timeout on re-render/unmount; editing a field sets
  `saved=false` (clears immediately) which also tears down the timeout. No leak.

## Testing

- **New e2e `tests/e2e/settings-validation.spec.ts`** (added to the `wdio.conf.mts` specs list): open
  Settings → type `not a url` into the gateway URL field → assert `[data-testid="gateway-url-error"]`
  displayed → set a valid `https://gw.example.test` → assert the error is gone. (Optionally: set only a
  token with empty URL → assert `[data-testid="gateway-token-warning"]`.)
- **`npm run build`** (tsc) green.
- **Full `npm run check`** green (real exit code).
- **`npm run test:e2e:build`** — full suite incl. the new spec + unchanged `release-readiness.spec.ts`
  (its valid URL shows no error). Flaky-cascade re-run protocol.

## Risks & mitigations

- **Breaking the existing settings e2e** → mitigated: validation is advisory (never blocks save), aria-labels
  + buttons unchanged; the release-readiness flow uses a valid URL.
- **Auto-clear interfering with an assertion** → no e2e asserts the footer "Saved" span (grep-verified);
  3s window is generous.

## Rollout

Single feature branch `settings-validation-feedback`. Files:
- **Modify:** `app/src/lib/settings.ts` (add `isValidHttpUrl`), `app/src/features/settings/SettingsPanel.tsx`
  (import + derived flags + 3 advisory messages + auto-clear effect).
- **New:** `app/tests/e2e/settings-validation.spec.ts` + register it in `app/wdio.conf.mts`.

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
