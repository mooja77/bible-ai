# Council Run Progress (Consulting Indicator) — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `council-run-progress`)
- **Theme:** B — Council AI trust/UX, sub-project 5 (final)
- **Owner:** John Moore

## Problem

A Council run can take a while (large models; up to the 1800s global timeout). During the run the
only feedback is the Ask button changing to "Thinking… {elapsed}s" — the user can't see *which*
voices are being consulted, so a long run feels opaque/frozen.

We deliberately chose the lighter "consulting indicator" (approach C) over true per-voice
streaming (approach A): voices run in parallel and are already bounded by the per-voice 300s
timeout, so the high-value signal is "it's consulting these N voices and it's been running Xs" —
which needs no change to the sidecar↔Rust transport. (A — real mid-run streaming — would rewrite
the shared one-request/one-response read loop; not worth the risk here.)

## Goals

1. During a run, show the named voices being consulted with a live elapsed timer.
2. Reuse existing state — no new backend/transport/RPC work.
3. Keep the existing post-run per-voice results (`VoicesAuditTrail` already shows each voice's
   ✓/✗ + duration).

## Non-goals (YAGNI)

- No real per-voice mid-run streaming (approach A) — no sidecar/Rust/transport change.
- No new "stage" model (retrieval → voices → synthesis) — that would also need streaming.
- No e2e — the loading state is too transient in mock mode (the mock run resolves near-instantly),
  so an e2e would assert a frame that's already gone; verified by build + manual smoke instead.

## Approach

**A "Consulting…" panel shown during the run.** Reuse the existing `loading` + `elapsed` state and
the voice-readiness list that `CouncilVoicePreview` already computes. While a run is in flight,
swap the pre-submit voice preview for a panel that lists the active voices as "consulting…" with a
live elapsed timer.

## Design (`app/src/features/council/CouncilPanel.tsx` only)

### Extract `getCouncilVoices(settings)` (module-scope helper, DRY)

`CouncilVoicePreview` (~line 405) builds a `voices` array from settings readiness
(`google_api_key`/`openai_api_key`/`anthropic_api_key`/`managed_gateway_url` → Claude/Gateway/
Gemini/OpenAI with `label`/`state`/`detail`/`active`). Pull that array construction into a pure
module-scope `getCouncilVoices(settings?: AppSettings)` returning the same array, and refactor
`CouncilVoicePreview` to call it. (No behavior change to the preview.)

### `CouncilRunningPanel({ settings, elapsed })` (new component)

```tsx
function CouncilRunningPanel({ settings, elapsed }: { settings?: AppSettings; elapsed: number }) {
  const active = getCouncilVoices(settings).filter((v) => v.active);
  return (
    <div className="soft-card p-3" data-testid="council-running-panel">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-xs tracking-wider text-neutral-500">Consulting the Council</h2>
        <span className="text-xs text-neutral-500">{elapsed}s</span>
      </div>
      <ul className="space-y-1">
        {(active.length > 0 ? active : [{ label: "Council", state: "", detail: "", active: true }]).map((v) => (
          <li key={v.label} className="flex items-center gap-2 text-sm text-neutral-300">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400/80 animate-pulse" aria-hidden="true" />
            <span>{v.label}</span>
            <span className="text-xs text-neutral-500">consulting…</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-600 mt-2">
        Voices run in parallel; large models can take a while. Each voice is capped, so a slow one
        won't hold up the rest.
      </p>
    </div>
  );
}
```

### Render swap

At the current `<CouncilVoicePreview settings={settings} />` (line 262), swap based on `loading`:

```tsx
        {loading ? (
          <CouncilRunningPanel settings={settings} elapsed={elapsed} />
        ) : (
          <CouncilVoicePreview settings={settings} />
        )}
```

`loading` and `elapsed` are already in scope in `CouncilPanel` (the same state the Ask button uses).

### Completion (already implemented)

When the run finishes, `onAsk` sets `loading = false` and `response`; the panel reverts and the
existing `VoicesAuditTrail` renders each voice's actual ✓/✗ + `duration_ms`. No change needed there.

## Data flow

```
onAsk → setLoading(true) (elapsed timer ticks)
  → preview swaps to CouncilRunningPanel: active voices "consulting…" + {elapsed}s
  → response arrives → setLoading(false) → panel reverts to preview;
    VoicesAuditTrail shows per-voice ✓/✗ + duration
```

## Edge cases

- No active voices (no providers configured): a run can't start (the backend rejects with "no
  providers"), so `loading` shouldn't occur; defensively the panel shows a generic "Council …
  consulting…" row so it never renders empty.
- All-fail / single-voice / timeout: handled post-run by the already-shipped features (error
  clarity, synthesis honesty banner); the running panel is purely the in-flight indicator.

## Testing

- **`npm run build`** (tsc + vite) clean.
- **Manual smoke:** run a real Council; confirm the "Consulting the Council" panel appears with the
  active voices + a ticking elapsed timer, then reverts to the result (with `VoicesAuditTrail`
  timings) when done.
- **No e2e** — the loading state is too transient in mock mode to assert reliably.
- Full `npm run check` green before merge.

## Risks & mitigations

- **Redundant-looking voice list** (preview vs running) → mitigated by *swapping* (not stacking):
  during a run the preview is replaced by the running panel.
- **`getCouncilVoices` refactor** → pure extraction with no behavior change; `CouncilVoicePreview`
  keeps rendering identically (it just calls the helper).
- **Transient/untested loading UI** → low-risk presentational code; documented as build+manual
  verified.

## Rollout

Single feature branch `council-run-progress`. Change confined to
`app/src/features/council/CouncilPanel.tsx`. Verify with `npm run check` + a manual smoke of a real
run before merge to `main`. This is the final Theme B sub-project.
