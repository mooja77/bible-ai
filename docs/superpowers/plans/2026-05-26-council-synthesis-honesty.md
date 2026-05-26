# Council Synthesis Honesty (Fallback Labeling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label the Council's headline result honestly when it isn't a real multi-voice consensus (single voice available, or synthesis failed).

**Architecture:** A pure exported `resolveSynthesisMode` in the sidecar sets `synthesis_mode` (+ `synthesis_voice`) on the council response; the frontend renders a banner above the primary synthesis view for the two non-consensus modes. The banner gates on `response?.synthesis_mode`, which only the primary synthesis passes (per-voice `CouncilResultView` calls omit `response`), so it never shows on voice cards. No council-contract change beyond two additive optional fields; no Rust change (the response validator ignores unknown top-level fields); no migration.

**Tech Stack:** Node sidecar (ESM, `node:test`), React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-council-synthesis-honesty-design.md`

**Verification note:** The single-voice / synthesis-failed paths can't be triggered deterministically in the mocked e2e env (mock is `consensus`), so the pure mode helper is unit-tested and the banner is verified by `npm run build`; no new e2e.

---

## File Structure

- `app/sidecar/council.mjs` — add `resolveSynthesisMode` (export); set `synthesis_mode`/`synthesis_voice` in `runCouncil`; mock returns `consensus`. *(Task 1)*
- `app/sidecar/tests/council.test.mjs` — unit tests for `resolveSynthesisMode`. *(Task 1)*
- `app/src/lib/bible.ts` — extend `CouncilResponse`. *(Task 2)*
- `app/src/features/council/CouncilPanel.tsx` — `SynthesisModeBanner` + render inside `CouncilResultView`. *(Task 2)*

No Rust change.

---

## Task 1: `resolveSynthesisMode` + wire into `runCouncil`

**Files:**
- Modify: `app/sidecar/council.mjs` (add helper at module scope; `runCouncil` synthesis section ~line 405–426; `mockCouncilResult` return ~line 348–367).
- Test: `app/sidecar/tests/council.test.mjs` (import + 3 tests).

- [ ] **Step 1: Write the failing tests**

In `council.test.mjs`, change the import to `import { runCouncil, resolveSynthesisMode } from "../council.mjs";` and append:

```js
test("resolveSynthesisMode: one voice → single_voice (regardless of synthesisFailed)", () => {
  assert.equal(resolveSynthesisMode({ okCount: 1, synthesisFailed: false }), "single_voice");
  assert.equal(resolveSynthesisMode({ okCount: 1, synthesisFailed: true }), "single_voice");
});

test("resolveSynthesisMode: multiple voices but synthesis threw → synthesis_failed", () => {
  assert.equal(resolveSynthesisMode({ okCount: 3, synthesisFailed: true }), "synthesis_failed");
});

test("resolveSynthesisMode: multiple voices, synthesis ok → consensus", () => {
  assert.equal(resolveSynthesisMode({ okCount: 3, synthesisFailed: false }), "consensus");
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `app/sidecar`): `node --test tests/council.test.mjs`
Expected: FAIL — `resolveSynthesisMode is not a function` / not exported.

- [ ] **Step 3: Add the helper**

At module scope in `council.mjs` (e.g. just above `runCouncil`):

```js
/**
 * How the headline synthesis was produced:
 *  - single_voice: only one voice succeeded (no synthesis performed)
 *  - synthesis_failed: ≥2 voices succeeded but the synthesis call threw; we
 *    fell back to the first voice's result
 *  - consensus: a real multi-voice synthesis
 */
export function resolveSynthesisMode({ okCount, synthesisFailed }) {
  if (okCount <= 1) return "single_voice";
  if (synthesisFailed) return "synthesis_failed";
  return "consensus";
}
```

- [ ] **Step 4: Set the mode in `runCouncil`**

Replace the synthesis section of `runCouncil` (currently builds `synthesis` then `return { synthesis, voices, manifest };`) with:

```js
  let synthesis;
  let synthesisFailed = false;
  if (ok.length === 1) {
    // Only one successful voice — no meaningful synthesis. Pass through.
    synthesis = ok[0].result;
  } else {
    try {
      synthesis = await synthesise({ question, successfulVoices: ok, model, env });
    } catch (err) {
      log(
        "synthesis failed, falling back to first voice:",
        redactSecrets(err?.message ?? String(err), env),
      );
      synthesis = ok[0].result;
      synthesisFailed = true;
    }
  }
  synthesis = ensurePositionEvidence(synthesis, evidence);

  const synthesis_mode = resolveSynthesisMode({ okCount: ok.length, synthesisFailed });
  const response = { synthesis, voices, manifest, synthesis_mode };
  if (synthesis_mode !== "consensus") {
    response.synthesis_voice = ok[0].display_name;
  }
  return response;
```

- [ ] **Step 5: Mock mode reports `consensus`**

In `mockCouncilResult`, add `synthesis_mode: "consensus",` to the returned object (the `return { synthesis: result, voices: [...], manifest: [...] }` — add the field alongside `synthesis`, `voices`, `manifest`).

- [ ] **Step 6: Run to verify pass**

Run (from `app/sidecar`): `node --check council.mjs && node --test tests/`
Expected: `node --check` clean; ALL sidecar tests pass (the 3 new `resolveSynthesisMode` tests + the existing mock-council tests, which still pass — adding a `synthesis_mode` field doesn't break their assertions).

- [ ] **Step 7: Commit**

```bash
git add app/sidecar/council.mjs app/sidecar/tests/council.test.mjs
git commit -m "feat(council): tag synthesis_mode (consensus/single_voice/synthesis_failed)"
```

---

## Task 2: Surface the banner in the UI

**Files:**
- Modify: `app/src/lib/bible.ts` (`CouncilResponse` interface ~line 214).
- Modify: `app/src/features/council/CouncilPanel.tsx` (add `SynthesisModeBanner`; render it inside `CouncilResultView` ~line 1604–1613).

- [ ] **Step 1: Extend `CouncilResponse`**

In `bible.ts`, add these two optional fields to the `CouncilResponse` interface (anywhere among its fields, e.g. after `manifest`):

```ts
  synthesis_mode?: "consensus" | "single_voice" | "synthesis_failed";
  synthesis_voice?: string;
```

- [ ] **Step 2: Add the `SynthesisModeBanner` component**

In `CouncilPanel.tsx`, add this component (near `CouncilResultView`, e.g. just above it ~line 1589):

```tsx
function SynthesisModeBanner({ response }: { response: CouncilResponse }) {
  const mode = response.synthesis_mode;
  if (mode !== "single_voice" && mode !== "synthesis_failed") return null;
  const voice = response.synthesis_voice ?? "one voice";
  const message =
    mode === "single_voice"
      ? `Only one Council voice was available, so this is ${voice}'s analysis — not a multi-voice consensus.`
      : `The synthesis step failed, so this shows ${voice}'s analysis instead of a combined consensus.`;
  return (
    <div
      data-testid="synthesis-mode-banner"
      className="soft-card border-amber-500/40 bg-amber-500/10 px-3 py-2 mb-3 text-xs text-amber-200"
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 3: Render the banner in `CouncilResultView`**

In `CouncilResultView`, the heading section currently is:

```tsx
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm tracking-wider text-neutral-400">{heading}</h2>
          <ConfidenceBadge confidence={result.confidence} />
        </div>
        {response && (
          <CouncilWinnerSummary response={response} onJumpToVerse={onJumpToVerse} />
        )}
```

Insert the banner between the heading `<div>` and the `{response && (<CouncilWinnerSummary .../>)}` block:

```tsx
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm tracking-wider text-neutral-400">{heading}</h2>
          <ConfidenceBadge confidence={result.confidence} />
        </div>
        {response && <SynthesisModeBanner response={response} />}
        {response && (
          <CouncilWinnerSummary response={response} onJumpToVerse={onJumpToVerse} />
        )}
```

(`response` is only passed by the primary synthesis render, not by the per-voice `CouncilResultView` calls — which pass `result`/`heading`/`onJumpToVerse` only — so the banner can never appear on a voice card. Mock mode is `consensus`, so the banner is absent there too.)

- [ ] **Step 4: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/bible.ts app/src/features/council/CouncilPanel.tsx
git commit -m "feat(council): banner when synthesis isn't a multi-voice consensus"
```

---

## Task 3: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, node `--check`, sidecar tests including the 3 new `resolveSynthesisMode` tests).

- [ ] **Step 2: Manual smoke (optional)**

Configure exactly one AI provider (so only one voice succeeds) and run the Council; confirm the `single_voice` banner appears above the result and names the voice, with the full analysis still shown below. A normal multi-provider run shows no banner.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-26-council-synthesis-honesty-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-council-synthesis-honesty-design.md
git commit -m "docs(council): mark synthesis-honesty spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** tell the user when not a consensus + why (Task 2 banner) ✓; cover both silent paths — single_voice + synthesis_failed (Task 1 `resolveSynthesisMode` + wiring; `synthesisFailed` flag set in the synthesis `catch`) ✓; full result stays visible (banner is inserted above, nothing removed) ✓; two additive optional fields, no contract/Rust/migration change (Task 2 Step 1 + the permissive validator) ✓; mock stays `consensus` (Task 1 Step 5) ✓; sidecar unit test for all three modes + build-verified frontend, no e2e (Tasks 1, 2) ✓.
- **Type consistency:** `synthesis_mode` values `"consensus" | "single_voice" | "synthesis_failed"` identical across the sidecar helper, the `CouncilResponse` type, and the banner gating; `synthesis_voice` is `string` in both layers; the banner gates on `response?.synthesis_mode` and is only reachable where `response` is passed (primary synthesis), matching the `CouncilResultView` prop usage.
- **Placeholder scan:** every step has complete code + exact commands; no TBD/vague steps.
