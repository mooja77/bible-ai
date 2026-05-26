# Council Follow-up Question Chaining — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `council-follow-up-chaining`)
- **Theme:** B — Council AI trust/UX, sub-project 4
- **Owner:** John Moore

## Problem

After a Council run, the judgment panel shows an "AI-suggested follow-up questions" section
(`CouncilJudgmentPanel`, built by `buildCouncilFollowUpQuestions`). Each suggestion has a single
**"Add question"** button that adds it to the user's *open-questions notes* (`addOpenQuestion`).
There is **no way to actually ask a follow-up** — to run the Council on it you must copy the text,
scroll up, paste it into the question box, and submit. That friction discourages the natural
"but what about…?" iteration the suggestions invite.

## Goals

1. One click on a suggested follow-up runs the Council on it.
2. The current retrieval settings carry over (strategy, translation, testament, book, evidence
   limit) — the follow-up is asked the same way the original was.
3. Keep the existing "Add question" affordance (adding to open-questions notes is a different,
   still-useful action).

## Non-goals (YAGNI)

- No follow-up thread/breadcrumb history UI.
- No new question generation — reuse the existing `buildCouncilFollowUpQuestions`.
- No backend/sidecar/Rust/type change — this is pure frontend wiring in `CouncilPanel.tsx`.

## Approach

**Add an "Ask" button per follow-up that sets the question input and submits, reusing `onAsk`.**
`onAsk` already runs the Council with the current settings; we make it accept an explicit question
and wire a one-click handler from the parent down to the follow-up list in the judgment child.

## Design (`app/src/features/council/CouncilPanel.tsx` only)

### `onAsk` accepts an optional question (parent `CouncilPanel`)

`onAsk` currently reads the `question` state. Make it accept an override:

```js
const onAsk = async (overrideQuestion) => {
  if (loading) return;
  const q = (typeof overrideQuestion === "string" ? overrideQuestion : question).trim();
  if (!q) return;
  // ... unchanged: askCouncil(q, undefined, { strategy, include_cross_refs, translation_code,
  //     testament, book_id, evidence_limit }) and the rest ...
};
```

The `typeof … === "string"` guard is required because the existing `<button onClick={onAsk}>`
passes a `MouseEvent` (non-string → falls back to `question`), and the Ctrl/⌘+Enter handler calls
`onAsk()` with no argument. Both keep working. `onAsk`'s existing `if (loading) return` guard makes
a follow-up click during an in-flight run a harmless no-op.

### `onAskFollowUp` handler (parent)

```js
const onAskFollowUp = (text) => {
  setQuestion(text); // reflect what's being asked in the input
  void onAsk(text);  // submit immediately with the explicit text
};
```

### Thread it to the judgment child

The follow-up list is rendered in `CouncilJudgmentPanel` (child, defined ~line 533; instantiated by
the parent at ~line 374). Add an `onAskFollowUp: (question: string) => void` prop to
`CouncilJudgmentPanel`'s props and pass `onAskFollowUp={onAskFollowUp}` at the call site.

### "Ask" button per follow-up

In the follow-up row (currently just the "Add question" button), add an **"Ask"** button beside it:

```tsx
<button
  type="button"
  onClick={() => onAskFollowUp(item.question)}
  data-testid="ask-follow-up"
  className="btn-primary px-2 py-1 text-xs shrink-0"
>
  Ask
</button>
```

Keep the existing "Add question" (`addOpenQuestion`) button — the two actions differ (ask a new
Council run vs. record it in your open-questions notes).

## Data flow

```
Council response → CouncilJudgmentPanel shows follow-ups (buildCouncilFollowUpQuestions)
  → click "Ask" → onAskFollowUp(text) → setQuestion(text) + onAsk(text)
  → onAsk runs askCouncil(text, …current settings…) → new response replaces the current one
    (loading state shows; the judgment panel re-derives follow-ups from the new response)
```

## Error handling / edge cases

- Clicking "Ask" while a run is in flight → `onAsk`'s `if (loading) return` makes it a no-op.
- Empty/blank follow-up text → `onAsk`'s `if (!q) return` guard (won't happen — suggestions are
  non-empty).
- Asking a follow-up replaces the current response + judgment (intended chaining); the new run is a
  normal Council run, persisted like any other.
- Existing callers of `onAsk` (button `onClick`, Ctrl/⌘+Enter) unaffected by the optional arg.

## Testing

- **E2E (WDIO, mock mode):** the mock Council response includes `unresolved_tensions`/`dissent_notes`,
  so `buildCouncilFollowUpQuestions` produces ≥1 follow-up. Spec: run a mock Council, open the
  judgment panel, click an `[data-testid="ask-follow-up"]` button, and assert the question input now
  contains the follow-up text and a fresh mock response renders. Mirror the existing
  `council-mock.spec.ts` conventions for triggering a mock run + reaching the judgment panel.
- **Frontend build:** `npm run build` (tsc + vite) clean.
- Full `npm run check` green before merge; `npm run check:full` (e2e) before merge.

## Risks & mitigations

- **`onAsk(event)` from the existing `onClick`** → the `typeof === "string"` guard ignores the
  event and uses `question`; no behavior change for the existing button.
- **Disorientation** (clicking a button low on the page clears the content above) → acceptable: the
  loading state + new response render at the top; an auto-scroll-to-top is a possible follow-up
  polish, deferred (YAGNI).
- **Threading a prop through the child** → a single `onAskFollowUp` prop; no state moves.

## Rollout

Single feature branch `council-follow-up-chaining`. Change confined to
`app/src/features/council/CouncilPanel.tsx` plus one e2e spec
(`app/tests/e2e/council-follow-up.spec.ts`, registered in `wdio.conf.mts`). Verify with
`npm run check:full` before merge to `main`.
