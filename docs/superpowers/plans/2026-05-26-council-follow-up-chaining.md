# Council Follow-up Question Chaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Ask" button to each AI-suggested follow-up question so it runs the Council on that question with the current settings.

**Architecture:** Refactor `onAsk` (parent `CouncilPanel`) to accept an explicit question, add an `onAskFollowUp(text)` handler that sets the input and submits, thread it as a prop into the `CouncilJudgmentPanel` child where follow-ups render, and add an "Ask" button per follow-up. Frontend-only; verified by a mock-mode e2e.

**Tech Stack:** React 19 + TypeScript, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-council-follow-up-chaining-design.md`

---

## File Structure

- `app/src/features/council/CouncilPanel.tsx` — `onAsk` override, `onAskFollowUp`, prop threading, "Ask" button. *(Task 1)*
- `app/tests/e2e/council-follow-up.spec.ts` — **new** e2e; registered in `app/wdio.conf.mts`. *(Task 2)*

No backend/Rust/type change.

---

## Task 1: One-click "Ask" wiring in `CouncilPanel.tsx`

**Files:**
- Modify: `app/src/features/council/CouncilPanel.tsx` (`onAsk` ~142; add `onAskFollowUp` after it; `<CouncilJudgmentPanel>` call site ~374; `CouncilJudgmentPanel` signature ~533; follow-up row ~771–785).

- [ ] **Step 1: Make `onAsk` accept an optional question**

Change the `onAsk` declaration and its `q` line. Current:

```js
  const onAsk = async () => {
    // Guard the function itself, not just the button: the Ctrl/⌘+Enter
    // shortcut also calls onAsk, and a second in-flight request would
    // queue behind the sidecar mutex and discard the first result.
    if (loading) return;
    const q = question.trim();
    if (!q) return;
```

Replace with:

```js
  const onAsk = async (overrideQuestion) => {
    // Guard the function itself, not just the button: the Ctrl/⌘+Enter
    // shortcut also calls onAsk, and a second in-flight request would
    // queue behind the sidecar mutex and discard the first result.
    if (loading) return;
    // `onClick={onAsk}` passes a MouseEvent (non-string) → use the input's
    // question; follow-up chaining passes an explicit string.
    const q = (typeof overrideQuestion === "string" ? overrideQuestion : question).trim();
    if (!q) return;
```

(The rest of `onAsk` — `askCouncil(q, undefined, { … })` and everything after — is unchanged.)

- [ ] **Step 2: Add the `onAskFollowUp` handler**

Immediately after `onAsk`'s closing `};` (the function ends with `setLoading(false)` in a `finally`), add:

```js
  const onAskFollowUp = (text) => {
    setQuestion(text); // reflect what's being asked in the input
    void onAsk(text); // submit immediately with the explicit text
  };
```

- [ ] **Step 3: Pass `onAskFollowUp` to `CouncilJudgmentPanel`**

At the `<CouncilJudgmentPanel ... />` call site, add the prop:

```tsx
          <CouncilJudgmentPanel
            sessionId={activeSessionId}
            response={response}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            onAskFollowUp={onAskFollowUp}
          />
```

- [ ] **Step 4: Accept the prop in `CouncilJudgmentPanel`**

Change the component signature. Current:

```tsx
function CouncilJudgmentPanel({
  sessionId,
  response,
  judgment,
  onJudgmentChange,
}: {
  sessionId: number | null;
  response: CouncilResponse;
  judgment: CouncilJudgment | null;
  onJudgmentChange: (judgment: CouncilJudgment | null) => void;
}) {
```

Replace with:

```tsx
function CouncilJudgmentPanel({
  sessionId,
  response,
  judgment,
  onJudgmentChange,
  onAskFollowUp,
}: {
  sessionId: number | null;
  response: CouncilResponse;
  judgment: CouncilJudgment | null;
  onJudgmentChange: (judgment: CouncilJudgment | null) => void;
  onAskFollowUp: (question: string) => void;
}) {
```

- [ ] **Step 5: Add the "Ask" button to each follow-up row**

In the follow-up list, the row currently ends with a single "Add question" button:

```tsx
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-neutral-200">{item.question}</p>
                    <p className="text-xs text-neutral-500 mt-1">{item.source}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addOpenQuestion(item.question)}
                    className="btn-secondary px-2 py-1 text-xs shrink-0"
                  >
                    Add question
                  </button>
                </div>
```

Replace the single `<button>Add question</button>` with a two-button group (Ask + Add question):

```tsx
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-neutral-200">{item.question}</p>
                    <p className="text-xs text-neutral-500 mt-1">{item.source}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAskFollowUp(item.question)}
                      data-testid="ask-follow-up"
                      className="btn-primary px-2 py-1 text-xs"
                    >
                      Ask
                    </button>
                    <button
                      type="button"
                      onClick={() => addOpenQuestion(item.question)}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Add question
                    </button>
                  </div>
                </div>
```

- [ ] **Step 6: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/src/features/council/CouncilPanel.tsx
git commit -m "feat(council): one-click Ask for AI-suggested follow-up questions"
```

---

## Task 2: E2E — ask a follow-up in mock mode

**Files:**
- Create: `app/tests/e2e/council-follow-up.spec.ts`
- Modify: `app/wdio.conf.mts` (add to `specs`, before `release-readiness.spec.ts`).

Context: with `BIBLE_AI_MOCK_COUNCIL=1`, a Council run returns a deterministic mock whose synthesis has `unresolved_tensions`/`dissent_notes`, so `buildCouncilFollowUpQuestions` yields ≥1 follow-up and the `[data-testid="council-follow-up-questions"]` section (with `[data-testid="ask-follow-up"]` buttons) renders in the judgment panel after a run. FIRST read `app/tests/e2e/council-mock.spec.ts` to copy EXACTLY how it: reaches Council mode, types a question into the question input, submits the run, and waits for the mock response. Reuse its selectors (in particular the question-input selector and how it detects a completed run, e.g. waiting for "Mock consensus").

- [ ] **Step 1: Write the spec**

Mirror `council-mock.spec.ts`'s setup. Outline (fill selectors from that spec):

```ts
import { browser, $, expect } from "@wdio/globals";

describe("Council follow-up chaining", () => {
  it("asks a suggested follow-up with one click", async () => {
    // (reuse council-mock.spec steps: go to Council, type a question, run it,
    //  wait for the mock response to render.)
    // ... run a mock Council ...

    // The judgment panel shows suggested follow-ups; capture the first one's text.
    const askBtn = await $('[data-testid="ask-follow-up"]');
    await askBtn.waitForDisplayed({ timeout: 15000 });
    await askBtn.scrollIntoView();
    const followUpText = await askBtn.parentElement().parentElement().$("p").getText();

    await askBtn.click();

    // The question input now holds the follow-up, and a fresh mock response renders.
    const questionInput = await $(/* the question input selector from council-mock.spec */);
    await expect(questionInput).toHaveValue(followUpText); // adjust matcher to the element type
    // A new run renders the mock synthesis again:
    await expect($("*=Mock consensus")).toBeDisplayed();
  });
});
```

Adapt the follow-up-text capture and the question-input assertion to the actual DOM (the question input is the element bound to `setQuestion`; confirm whether it's a `<textarea>` or `<input>` and use `getValue`/`toHaveValue` accordingly). If precisely asserting the input value proves brittle, fall back to asserting that after clicking "Ask" a fresh mock response renders (the run re-triggered) and the follow-up section is present again — and note that in your report.

- [ ] **Step 2: Register + run**

Add `"./tests/e2e/council-follow-up.spec.ts"` to the `specs` array in `app/wdio.conf.mts` (before `release-readiness.spec.ts`). Run (from `app/`, allow ~10 min; set the command timeout to 600000 ms): `npm run test:e2e:build`
Expected: the new spec passes and all pre-existing specs still pass. If it fails for INFRA reasons (driver/build), report BLOCKED with details; if a selector/timing issue, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/council-follow-up.spec.ts app/wdio.conf.mts
git commit -m "test(council): e2e for one-click follow-up chaining"
```

---

## Task 3: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0.

- [ ] **Step 2: Manual smoke (optional)**

Run a real Council, scroll to "AI-suggested follow-up questions", click "Ask" on one, and confirm it re-runs the Council on that question (question box updates; a fresh result renders) with the same settings.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-26-council-follow-up-chaining-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-council-follow-up-chaining-design.md
git commit -m "docs(council): mark follow-up-chaining spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** one click runs the Council on a follow-up (Task 1 Step 5 button → `onAskFollowUp` → `onAsk`) ✓; current settings carry over (`onAsk` unchanged below the `q` line — same `askCouncil(q, …{strategy, translation_code, …})`) ✓; "Add question" retained (Task 1 Step 5 keeps it) ✓; frontend-only (only `CouncilPanel.tsx` + an e2e spec) ✓; e2e in mock mode (Task 2) + build (Task 1 Step 6) ✓.
- **Type consistency:** `onAsk(overrideQuestion?)` called with a `MouseEvent` (existing `onClick`), nothing (Ctrl+Enter), and a `string` (follow-up) — all handled by the `typeof === "string"` guard; `onAskFollowUp(text: string)` matches the `CouncilJudgmentPanel` prop type `onAskFollowUp: (question: string) => void` and the call-site `onAskFollowUp={onAskFollowUp}`; `data-testid="ask-follow-up"` matches the e2e selector.
- **Placeholder scan:** Task 1 has complete code; Task 2's selectors are intentionally "mirror council-mock.spec" (the honest way to match the real run/selectors) with an explicit fallback assertion — no vague code steps.
