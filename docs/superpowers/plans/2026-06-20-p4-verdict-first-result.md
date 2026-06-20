# P4 — Verdict-First Result Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Council result lead with a clean **verdict card** (the answer + confidence + one-line summary), keep the synthesis and the user's judgment visible, and tuck the ten dense audit panels behind one default-collapsed **"Full analysis"** disclosure — so the default result is calm and not a wall of panels, with everything still one tap away (and the P3 explorer as the primary deep-dive).

**Architecture:** Additive + reorganizing. A new presentational `CouncilVerdictCard` renders at the top. In `CouncilPanel`, the judgment panel moves up next to the synthesis, and the audit panels (process / position-comparison / voice-matrix / retrieval-trace / confidence-rationale / research-trail / argument-maps / source-drawer / voices-audit / evidence-audit) move into a `{showFullAnalysis && ...}` block toggled by a button. No component internals change. The e2e specs that assert those panels are updated to expand the disclosure first.

**Tech Stack:** React 19 + TS, Tailwind v4 + the P2 tokens, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-ux-overhaul-design.md` §8 (Council result restyle) + §4 (minimal, summary-first). Scope note: this delivers verdict-first + declutter. Folding the audit panels' *content* into the explorer is deferred to P6 (here they are merely collapsed, not removed — nothing is lost).

**Current result stack (CouncilPanel.tsx ~492–532), for reference:**
`CouncilResultView` (h2=Synthesis) · `CouncilProcessView` · `CouncilPositionComparison` · `CouncilVoiceMatrix` · `CouncilRetrievalTrace` · `CouncilConfidenceRationale` · `CouncilResearchTrail` · `CouncilArgumentMaps` · `CouncilJudgmentPanel` · `CouncilSourceDrawer` · `VoicesAuditTrail` · `CouncilEvidenceAudit`.

**Visible by default after P4:** verdict card, the existing retrieval-mode/actions line, the P3 "Trace the reasoning" explorer toggle, `CouncilResultView` (Synthesis), `CouncilJudgmentPanel`. **Collapsed under "Full analysis":** the other 10 panels.

**e2e specs that assert collapsed panels (must expand first after P4):**
- `council-mock.spec.ts`: the "renders … explicit reference" test (asserts `council-retrieval-trace`), the big "transparency" test (asserts process-view/position-comparison/voice-matrix/retrieval-trace/confidence-rationale/research-trail/argument-maps), and the "restore" test (asserts `council-argument-maps`).
- `release-readiness.spec.ts`: asserts `council-process-view`.
(`council-winner-summary`, `council-evidence-tabs`, `council-focused-position`, `council-matrix-focus` live inside `CouncilResultView`/`CouncilVoiceMatrix`; winner-summary + evidence-tabs stay visible. `council-voice-matrix` is collapsed, so its sub-assertions need the expand too.)

---

## File Structure

- `app/src/features/council/CouncilVerdictCard.tsx` — **create**; presentational verdict headline.
- `app/src/features/council/CouncilPanel.tsx` — render the card; move judgment up; collapse the audit panels behind a toggle; reset state on ask/select.
- `app/tests/e2e/council-verdict.spec.ts` — **create**; verdict card + collapse behavior.
- `app/tests/e2e/council-mock.spec.ts` — expand "Full analysis" before collapsed-panel assertions (3 tests).
- `app/tests/e2e/release-readiness.spec.ts` — expand before the process-view assertion.

---

## Task 1: `CouncilVerdictCard` component

**Files:** Create `app/src/features/council/CouncilVerdictCard.tsx`

- [ ] **Step 1: Implement.** Create the file with exactly:

```tsx
import type { CouncilResponse } from "../../lib/bible";
import { rankedPositions } from "./explorer/reasoningModel";

/** The calm headline of a Council result: the leading position, its confidence
 *  and weight, and a one-line summary. The dense analysis sits below, collapsed. */
export function CouncilVerdictCard({ response }: { response: CouncilResponse }) {
  const positions = rankedPositions(response);
  const leader = positions[0];
  if (!leader) return null;
  const confidence = response.synthesis?.confidence ?? "unknown";
  const others = positions.length - 1;
  return (
    <section
      data-testid="council-verdict-card"
      className="surface-panel rounded-lg p-5 border-l-4"
      style={{ borderLeftColor: "var(--c-leader)" }}
      aria-label="Council verdict"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-[0.7rem] uppercase tracking-wider text-neutral-500">The Council’s leading view</p>
        <span data-testid="council-verdict-confidence" className="meta-pill">{confidence} confidence</span>
      </div>
      <h2 data-testid="council-verdict-answer" className="text-xl font-semibold text-neutral-100 mt-1">
        {leader.label}
      </h2>
      <div className="flex items-center gap-2 mt-2">
        <span className="font-mono text-lg text-amber-300">{Math.round(leader.weight * 100)}%</span>
        {others > 0 ? (
          <span className="text-xs text-neutral-500">· {others} other view{others === 1 ? "" : "s"} weighed &amp; kept visible</span>
        ) : null}
      </div>
      {leader.summary ? (
        <p className="text-sm text-neutral-300 leading-relaxed mt-3">{leader.summary}</p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Verify.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (tsc + vite). Reuses `rankedPositions` from `./explorer/reasoningModel` (P3, committed). The component is unused until Task 2.

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/CouncilVerdictCard.tsx && git commit -m "feat(council): verdict card — calm result headline"
```

---

## Task 2: Restructure the result in `CouncilPanel`

**Files:** Modify `app/src/features/council/CouncilPanel.tsx`

- [ ] **Step 1: Add the import + state.**
(a) Near the other council imports add:
```ts
import { CouncilVerdictCard } from "./CouncilVerdictCard";
```
(b) Near the other `useState`s (by `showExplorer`) add:
```ts
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
```
(c) Reset it where `setShowExplorer(false)` is called — in `onAsk` (top resets) and in `onSelectSession`: add `setShowFullAnalysis(false);` beside each `setShowExplorer(false);`.

- [ ] **Step 2: Render the verdict card at the top of the result.**
In the result block, immediately after the opening `{response && !response.sensitive_topic && (` `<>` (i.e., before the `<div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">` retrieval-mode line, ~line 394), insert:
```tsx
          <CouncilVerdictCard response={response} />
```

- [ ] **Step 3: Move the judgment panel up + collapse the audit panels.**
The current sequence (~492–532) is `CouncilResultView`, then nine analytical panels, then `CouncilJudgmentPanel` (after `CouncilArgumentMaps`), then `CouncilSourceDrawer`, `VoicesAuditTrail`, `CouncilEvidenceAudit`. Replace that entire run (from `<CouncilResultView ... />` through `<CouncilEvidenceAudit ... />`) with:

```tsx
          <CouncilResultView
            result={response.synthesis}
            heading="Synthesis"
            response={response}
            selectedPositionLabel={selectedPositionLabel}
            onJumpToVerse={onJumpToVerse}
          />
          <CouncilJudgmentPanel
            sessionId={activeSessionId}
            response={response}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            onAskFollowUp={onAskFollowUp}
          />
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-sm"
            data-testid="council-full-analysis-toggle"
            aria-expanded={showFullAnalysis}
            onClick={() => setShowFullAnalysis((v) => !v)}
          >
            {showFullAnalysis ? "Hide full analysis" : "Show full analysis (process, evidence audit, voice matrix…) →"}
          </button>
          {showFullAnalysis && (
            <div data-testid="council-full-analysis" className="space-y-6">
              <CouncilProcessView response={response} />
              <CouncilPositionComparison response={response} onJumpToVerse={onJumpToVerse} />
              <CouncilVoiceMatrix
                response={response}
                selectedPositionLabel={selectedPositionLabel}
                onSelectPosition={setSelectedPositionLabel}
                onJumpToVerse={onJumpToVerse}
              />
              <CouncilRetrievalTrace response={response} onJumpToVerse={onJumpToVerse} />
              <CouncilConfidenceRationale response={response} />
              <CouncilResearchTrail response={response} />
              <CouncilArgumentMaps
                sessionId={activeSessionId}
                response={response}
                onAnnotationsChange={setArgumentAnnotations}
              />
              <CouncilSourceDrawer response={response} />
              <VoicesAuditTrail
                voices={response.voices}
                manifest={response.manifest}
                onJumpToVerse={onJumpToVerse}
              />
              <CouncilEvidenceAudit
                evidence={response.retrieved_evidence ?? []}
                synthesis={response.synthesis}
                onJumpToVerse={onJumpToVerse}
              />
            </div>
          )}
```

(Preserve every prop exactly as in the original — only the order [judgment moved up] and the `{showFullAnalysis && ...}` wrapper change. Do not alter the components themselves.)

- [ ] **Step 4: Verify.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (tsc + vite). Confirm no unused-import errors (all the wrapped components are still imported + used inside the conditional) and `showFullAnalysis` is used.

- [ ] **Step 5: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/CouncilPanel.tsx && git commit -m "feat(council): verdict-first result — collapse audit panels behind Full analysis"
```

---

## Task 3: Update e2e specs to expand "Full analysis"; add verdict spec

**Files:** Modify `app/tests/e2e/council-mock.spec.ts`, `app/tests/e2e/release-readiness.spec.ts`; create `app/tests/e2e/council-verdict.spec.ts`

The collapsed panels (`council-process-view`, `council-position-comparison`, `council-voice-matrix`, `council-retrieval-trace`, `council-confidence-rationale`, `council-research-trail`, `council-argument-maps`) are no longer rendered until "Full analysis" is expanded. Each test that asserts one of these must click the toggle first.

Use this exact expand snippet (insert it in each spot described, after the result/synthesis is confirmed and before the first collapsed-panel assertion):
```ts
    const fullAnalysis = await $('[data-testid="council-full-analysis-toggle"]');
    await fullAnalysis.waitForClickable({ timeout: 10_000 });
    await fullAnalysis.click();
```

- [ ] **Step 1: `council-mock.spec.ts` — the "renders … explicit reference" test.**
Read the test that asserts `const trace = await $('[data-testid="council-retrieval-trace"]')` near the top of the file (~line 107–112). Insert the expand snippet AFTER `await synthesis.waitForDisplayed(...)` (the `h2=Synthesis` wait, ~line 108) and BEFORE `const trace = ...` (~line 110).

- [ ] **Step 2: `council-mock.spec.ts` — the "transparency" test.**
In the test that asserts `council-process-view` / `council-position-comparison` / `council-voice-matrix` / `council-retrieval-trace` / `council-confidence-rationale` / `council-research-trail` / `council-argument-maps` (~line 133–209), insert the expand snippet AFTER the `browser.waitUntil(... "Mock consensus" ...)` block (~line 153) and BEFORE `const processView = await $("h2=How the Council reached this");` (~line 155). One expand makes all the subsequent collapsed-panel assertions in this test visible. (`council-winner-summary` and `council-evidence-tabs` are inside the always-visible `CouncilResultView`, so they need no change — they appear before/after the expand regardless.)

- [ ] **Step 3: `council-mock.spec.ts` — the "restore" test.**
Find the test that restores a stored session and asserts `const restoredArgumentMaps = await $('[data-testid="council-argument-maps"]')` (~line 298). After the restored result is on screen (where it waits for the synthesis/result to reappear) and BEFORE the `restoredArgumentMaps` assertion, insert the expand snippet. (If the restored view also needs the synthesis confirmed first, keep the existing waits and add the expand immediately before the argument-maps lookup.)

- [ ] **Step 4: `release-readiness.spec.ts` — process-view.**
Find `const process = await $('[data-testid="council-process-view"]')` (~line 186). Insert the expand snippet immediately before it (after the test has the Council result on screen). If this assertion runs in a context where the result is already rendered, the toggle will be present; `waitForClickable` handles timing.

- [ ] **Step 5: Create `app/tests/e2e/council-verdict.spec.ts`:**
```ts
import { browser, $, expect } from "@wdio/globals";

/**
 * Verdict-first result: the answer leads with a clean verdict card, and the
 * dense audit panels are collapsed by default behind "Full analysis".
 */
describe("Council verdict-first result", () => {
  it("leads with a verdict card and keeps the audit panels collapsed until asked", async () => {
    const question = `What does the beginning say about creation? verdict ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 15_000 });
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");
    await (await $("textarea")).setValue(question);
    await (await $("button=Ask the Council")).click();

    // The verdict card leads with the answer + confidence.
    const card = await $('[data-testid="council-verdict-card"]');
    await card.waitForDisplayed({ timeout: 30_000 });
    expect((await (await $('[data-testid="council-verdict-answer"]')).getText()).length).toBeGreaterThan(0);
    expect(await (await $('[data-testid="council-verdict-confidence"]')).isExisting()).toBe(true);

    // The audit panels are NOT rendered until the user expands Full analysis.
    expect(await (await $('[data-testid="council-process-view"]')).isExisting()).toBe(false);

    const toggle = await $('[data-testid="council-full-analysis-toggle"]');
    await toggle.waitForClickable({ timeout: 10_000 });
    await toggle.click();

    const process = await $('[data-testid="council-process-view"]');
    await process.waitForDisplayed({ timeout: 10_000 });
    expect(await process.isExisting()).toBe(true);
  });
});
```

- [ ] **Step 6: Register the new spec.** Append `"./tests/e2e/council-verdict.spec.ts"` to the `specs` array in `app/wdio.conf.mts` (last entry).

- [ ] **Step 7: Type-check.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (the app build; spec files aren't part of `npm run build` but must be valid TS — verify by eye, they follow existing patterns).

- [ ] **Step 8: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/tests/e2e/council-verdict.spec.ts app/tests/e2e/council-mock.spec.ts app/tests/e2e/release-readiness.spec.ts app/wdio.conf.mts && git commit -m "test(council): expand Full analysis in specs; add verdict-first spec"
```

---

## Task 4: Build, run e2e, full check (controller-driven)

- [ ] **Step 1: Build + stage.** `cd "C:/JM Programs/BibleApp/app" && npx tauri build --debug --no-bundle && node scripts/stage-debug-resources.mjs`
- [ ] **Step 2: Run the affected + new specs.** `cd "C:/JM Programs/BibleApp/app" && npx wdio run wdio.conf.mts --spec tests/e2e/council-verdict.spec.ts --spec tests/e2e/council-mock.spec.ts --spec tests/e2e/release-readiness.spec.ts` — expect all passing. (Load-flake on the first `button=Council` click → re-run once; only a deterministic isolated failure is a real bug.)
- [ ] **Step 3: Regression on layout + contrast + explorer + follow-up.** `cd "C:/JM Programs/BibleApp/app" && npx wdio run wdio.conf.mts --spec tests/e2e/layout-maxscale.spec.ts --spec tests/e2e/contrast-light.spec.ts --spec tests/e2e/reasoning-explorer.spec.ts --spec tests/e2e/council-follow-up.spec.ts` — expect all passing.
- [ ] **Step 4: Full check.** `cd "C:/JM Programs/BibleApp/app" && npm run check` — expect exit 0.
- [ ] **Step 5: Commit fixups.** `cd "C:/JM Programs/BibleApp" && git add -A && git commit -m "chore: P4 verdict-first — checks green" || echo "nothing to commit"`

---

## Self-Review

- **Spec coverage (§8):** verdict card leads → Task 1 + Task 2 Step 2; dense panels collapsed behind one calm disclosure → Task 2 Step 3; synthesis + judgment stay visible → Task 2 Step 3; P3 explorer remains the deep-dive entry (untouched). Deferred (explicit): folding the audit panels into the explorer (P6).
- **Placeholder scan:** none — complete code; the spec-edit steps give the exact snippet + exact insertion points keyed to existing line anchors the implementer will confirm by reading.
- **Type consistency:** `CouncilVerdictCard` takes `{ response: CouncilResponse }`; `rankedPositions` reused from `explorer/reasoningModel`; `showFullAnalysis` state + `council-full-analysis-toggle`/`council-full-analysis` testids consistent across Task 2 and Task 3; all wrapped components keep their original props.
- **Regression control:** the only behavioral change is collapsing the audit panels; every spec that asserts them is updated to expand first (Task 3). `h2=Synthesis`, `council-winner-summary`, `council-evidence-tabs`, judgment/follow-up stay visible. New `council-verdict.spec` asserts both the card and the default-collapsed behavior.
- **Environment risk:** Task 4 needs the debug build + msedgedriver matching Edge (per memory).
