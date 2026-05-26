# Council Run Progress (Consulting Indicator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During a Council run, show the voices being consulted with a live elapsed timer (instead of just "Thinking…").

**Architecture:** Extract the voice-readiness list from `CouncilVoicePreview` into a shared `getCouncilVoices(settings)` helper, add a `CouncilRunningPanel` that lists the active voices as "consulting…" with the existing `elapsed` timer, and swap the pre-submit preview for it while `loading`. Frontend-only; no transport/backend change (this is the lighter approach C, not real streaming).

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-council-run-progress-design.md`

**Verification note:** No frontend unit runner, and the loading state is too transient in mock mode for a reliable e2e, so this is verified by `npm run build` + manual smoke. No new e2e.

---

## File Structure

- `app/src/features/council/CouncilPanel.tsx` — add `getCouncilVoices` (extract from `CouncilVoicePreview`), refactor `CouncilVoicePreview` to use it, add `CouncilRunningPanel`, swap the render at line ~262. *(Task 1)*

No other files.

---

## Task 1: Consulting indicator in `CouncilPanel.tsx`

**Files:**
- Modify: `app/src/features/council/CouncilPanel.tsx` (add `getCouncilVoices` above `CouncilVoicePreview` ~405; refactor `CouncilVoicePreview` body ~406–444; add `CouncilRunningPanel`; swap render ~262).

- [ ] **Step 1: Extract `getCouncilVoices(settings)`**

Add this module-scope helper immediately above `function CouncilVoicePreview(` (~line 405). It contains the exact readiness consts + voices array currently inside `CouncilVoicePreview`, plus `noProvidersConfigured`:

```tsx
function getCouncilVoices(settings?: AppSettings) {
  const googleReady = hasSettingValue(settings?.google_api_key);
  const openAiReady = hasSettingValue(settings?.openai_api_key);
  const anthropicReady = hasSettingValue(settings?.anthropic_api_key);
  const gatewayReady = hasSettingValue(settings?.managed_gateway_url);
  const voices = [
    {
      label: "Claude",
      state: anthropicReady ? "will run" : "will try",
      detail: anthropicReady
        ? `Anthropic API ${settings?.anthropic_model || "claude-sonnet-4-6"} handles Claude voice and synthesis.`
        : `Claude Code ${settings?.claude_model ?? "sonnet"} handles synthesis if the local login is available.`,
      active: true,
    },
    {
      label: "Gateway",
      state: gatewayReady ? "will run" : "optional",
      detail: gatewayReady
        ? "Managed gateway will run as a Council voice without direct provider keys on this device."
        : "Add a managed gateway URL in Settings for team/public deployments.",
      active: gatewayReady,
    },
    {
      label: "Gemini",
      state: googleReady ? "will run" : "needs key",
      detail: googleReady
        ? `Google API key is set for ${settings?.gemini_model || "gemini-2.5-flash"}.`
        : "Add a Google API key in Settings.",
      active: googleReady,
    },
    {
      label: "OpenAI",
      state: openAiReady ? "will run" : "needs key",
      detail: openAiReady
        ? `OpenAI API key is set for ${settings?.openai_model || "gpt-5"}.`
        : "Add an OpenAI API key in Settings.",
      active: openAiReady,
    },
  ];
  const noProvidersConfigured = !googleReady && !openAiReady && !anthropicReady && !gatewayReady;
  return { voices, noProvidersConfigured };
}
```

- [ ] **Step 2: Refactor `CouncilVoicePreview` to use the helper**

In `CouncilVoicePreview`, the body currently begins by computing `googleReady`/`openAiReady`/
`anthropicReady`/`gatewayReady`, the `voices` array, and `noProvidersConfigured`. Replace all of
that (everything from `const googleReady = …` through `const noProvidersConfigured = …;`) with:

```tsx
  const { voices, noProvidersConfigured } = getCouncilVoices(settings);
```

Leave the component's `return (...)` JSX unchanged — it still references `voices` and
`noProvidersConfigured`, now sourced from the helper. (No behavior change to the preview.)

- [ ] **Step 3: Add `CouncilRunningPanel`**

Add this component (e.g. just below `CouncilVoicePreview`):

```tsx
function CouncilRunningPanel({ settings, elapsed }: { settings?: AppSettings; elapsed: number }) {
  const active = getCouncilVoices(settings).voices.filter((v) => v.active);
  const rows = active.length > 0 ? active : [{ label: "Council", active: true }];
  return (
    <div className="soft-card p-3" data-testid="council-running-panel">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-xs tracking-wider text-neutral-500">Consulting the Council</h2>
        <span className="text-xs text-neutral-500">{elapsed}s</span>
      </div>
      <ul className="space-y-1">
        {rows.map((v) => (
          <li key={v.label} className="flex items-center gap-2 text-sm text-neutral-300">
            <span
              className="inline-block w-2 h-2 rounded-full bg-amber-400/80 animate-pulse"
              aria-hidden="true"
            />
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

- [ ] **Step 4: Swap the render while loading**

At line ~262, the pre-submit preview is rendered as:

```tsx
        <CouncilVoicePreview settings={settings} />
```

Replace it with a conditional that shows the running panel during a run:

```tsx
        {loading ? (
          <CouncilRunningPanel settings={settings} elapsed={elapsed} />
        ) : (
          <CouncilVoicePreview settings={settings} />
        )}
```

(`loading` and `elapsed` are already in scope in `CouncilPanel` — the same state the Ask button uses at line ~247.)

- [ ] **Step 5: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/src/features/council/CouncilPanel.tsx
git commit -m "feat(council): consulting indicator with live timer during a run"
```

---

## Task 2: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, node `--check`, sidecar tests — Rust/sidecar unchanged, so effectively the TS build + the unchanged suite).

- [ ] **Step 2: Manual smoke (recommended)**

Run a real Council with ≥1 provider configured. While it's running, confirm the pre-submit "Voices before submit" preview is replaced by a "Consulting the Council" panel listing the active voices with a pulsing dot + a ticking `{elapsed}s`. When it finishes, confirm the panel reverts and the result's `VoicesAuditTrail` shows each voice's ✓/✗ + duration.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-26-council-run-progress-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-council-run-progress-design.md
git commit -m "docs(council): mark run-progress spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** show consulting voices + live timer during a run (Task 1 Steps 3–4 `CouncilRunningPanel` + swap) ✓; reuse existing state, no backend/transport change (uses `loading`/`elapsed`/`settings`; only `CouncilPanel.tsx`) ✓; DRY via `getCouncilVoices` with `CouncilVoicePreview` refactored to it, no behavior change (Steps 1–2) ✓; completion already covered by `VoicesAuditTrail` (no change) ✓; no e2e, build + manual (Task 2) ✓; empty-voices defensive fallback row (Step 3 `rows`) ✓.
- **Type consistency:** `getCouncilVoices(settings?: AppSettings)` returns `{ voices, noProvidersConfigured }`; `CouncilVoicePreview` destructures both (matching its existing JSX usage of `voices`/`noProvidersConfigured`); `CouncilRunningPanel` reads `.voices`; `elapsed: number` matches the `elapsed` state. `noProvidersConfigured` is computed from the four readiness flags (NOT from `voices.some(active)`, since Claude is always `active: true`).
- **Placeholder scan:** every step has complete code + exact commands; no TBD/vague steps.
