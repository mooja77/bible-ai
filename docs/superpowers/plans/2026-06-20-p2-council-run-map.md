# P2 — Animated Council Run Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the P1 progress stream into a live "you are here" map of the Council run — a clean, accessible DOM **stepper** (the information-complete, reduced-motion baseline) with an optional **canvas animation** layered on top when motion is allowed.

**Architecture:** A pure reducer folds `CouncilProgressEvent`s into a `CouncilRunState`. A `useCouncilRun` hook holds that state in React and exposes an event handler passed to `askCouncil(onProgress)`. `CouncilRunMap` renders the state: always a semantic stepper (stages + per-voice rows + verdict), plus a decorative canvas pulse when `useReducedMotion()` is false. It replaces `CouncilRunningPanel` in `CouncilPanel`'s loading state.

**Tech Stack:** React 19 + TypeScript, CSS (Tailwind v4 + tokens in `App.css`), Canvas2D + `requestAnimationFrame`, WebdriverIO e2e (frontend logic is e2e-only here — no unit harness).

**Spec:** `docs/superpowers/specs/2026-06-20-ui-ux-overhaul-design.md` §4 (design system / motion / grammar), §6 (CouncilRunMap), §9 (a11y/testing). This plan also folds in P0's design tokens (CSS-only, so they ride with their first consumer here).

**Live-map stages (event-backed):** `safety → retrieval → voices → synthesis → verdict`. NOTE: "conflict" is **not** a live stage — it is derived from the final result's multiple positions and belongs to the result view / explorer (P3/P4), per the spec. The live map shows only event-backed lifecycle stages.

**Event → stage mapping (the reducer contract):**
- `run_started` → all stages `pending`.
- `safety_checked {status:"clear"}` → safety `done`; `{status:"blocked"}` → safety `failed` (terminal).
- `retrieval_started` → retrieval `active`. `retrieval_fallback {reason}` → retrieval note. `retrieval_done {count}` → retrieval `done`, store `evidenceCount`.
- `voice_started {provider, display_name}` → voices `active`, append/`active` that voice. `voice_done {provider}` → that voice `done`. `voice_failed {provider}` → that voice `failed`.
- `synthesis_started` → voices `done`, synthesis `active`. `synthesis_fallback {reason}` → synthesis note.
- `judged {leader_label, leader_weight, confidence}` → synthesis `done` (or `skipped` if it was never started — single-voice path), verdict `done`, store `verdict`.
- `run_complete` → any non-failed stage that is still `active`/`pending` and logically reached → `done`.

---

## File Structure

- `app/src/App.css` — add design tokens (semantic palette + motion vars) and the run-map animation keyframes.
- `app/src/lib/useReducedMotion.ts` — **create**; React hook reading `(prefers-reduced-motion: reduce)`.
- `app/src/features/council/councilRun.ts` — **create**; pure `CouncilRunState` types + `initialRunState()` + `reduceRunEvent(state, event)`.
- `app/src/features/council/useCouncilRun.ts` — **create**; React hook wrapping the reducer (`{ runState, reset, handleEvent }`).
- `app/src/features/council/CouncilRunMap.tsx` — **create**; the stepper + canvas component.
- `app/src/features/council/CouncilPanel.tsx` — wire `useCouncilRun` + pass `handleEvent` to `askCouncil`; render `CouncilRunMap` in the loading block.
- `app/tests/e2e/council-run-map.spec.ts` — **create**; drives a mock run and asserts the map renders + completes.

---

## Task 1: Design tokens + run-map keyframes in `App.css`

**Files:** Modify `app/src/App.css`

- [ ] **Step 1: Add tokens.** In `app/src/App.css`, inside the `:root { ... }` block (dark theme), after the existing accent-token remaps, add:

```css
  /* ---- Run-map / reasoning semantic palette (P2) ----------------------
     One color grammar reused across the run map, result, and explorer:
     support = emerald, challenge = rose, leader/verdict = gold, plus a
     fixed set of per-voice accents. */
  --c-support: #5ec99a;
  --c-challenge: #f07a8a;
  --c-leader: #ffd479;
  --c-voice-a: #6f9bff;
  --c-voice-b: #8affd0;
  --c-voice-c: #ffd479;
  --c-voice-d: #ff9ad1;
  --c-stage-active: #818cf8;
  --c-stage-done: #5ec99a;
  --c-stage-failed: #f07a8a;

  /* Motion tokens */
  --motion-fast: 140ms;
  --motion-base: 320ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
```

Add light-theme overrides inside the `[data-theme="light"] { ... }` block (darken support/challenge/leader for contrast on light surfaces), after its existing accent remaps:

```css
  /* Run-map palette tuned for light surfaces (foreground use). */
  --c-support: #047857;
  --c-challenge: #be123c;
  --c-leader: #b45309;
  --c-stage-active: #4f46e5;
  --c-stage-done: #047857;
  --c-stage-failed: #be123c;
```

- [ ] **Step 2: Add run-map keyframes.** Append near the other animations (before the `@media (prefers-reduced-motion: reduce)` block), so the reduced-motion block already neutralizes them:

```css
/* ---- Run map -----------------------------------------------------------
   The active stage's marker pulses; the connecting fill grows. Honors
   prefers-reduced-motion via the global reduce block below. */
.runmap-active-pulse {
  animation: runmap-pulse 1.4s ease-in-out infinite;
}
@keyframes runmap-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(129, 140, 248, 0); }
}
```

- [ ] **Step 3: Verify build.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (tsc + vite). CSS-only change; no type impact.

- [ ] **Step 4: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/App.css && git commit -m "feat(ui): run-map semantic palette + motion tokens + pulse keyframe"
```

---

## Task 2: `useReducedMotion` hook

**Files:** Create `app/src/lib/useReducedMotion.ts`

- [ ] **Step 1: Implement.** Create `app/src/lib/useReducedMotion.ts`:

```ts
import { useEffect, useState } from "react";

/**
 * True when the OS "reduce motion" preference is set. Components use this to
 * skip decorative animation while still rendering full state via DOM/text.
 * SSR-safe and resilient if matchMedia is unavailable.
 */
export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [reduced, setReduced] = useState<boolean>(get);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Verify build.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS. (The hook is unused until Task 5; tsc allows an unused exported module. If vite tree-shake/`noUnusedLocals` complains, it won't — it's an exported function in its own module.)

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/lib/useReducedMotion.ts && git commit -m "feat(ui): useReducedMotion hook"
```

---

## Task 3: Pure run-state reducer

**Files:** Create `app/src/features/council/councilRun.ts`

- [ ] **Step 1: Implement.** Create `app/src/features/council/councilRun.ts`:

```ts
import type { CouncilProgressEvent } from "../../lib/bible";

export type StageId = "safety" | "retrieval" | "voices" | "synthesis" | "verdict";
export type StageStatus = "pending" | "active" | "done" | "failed" | "skipped";

export const STAGE_ORDER: StageId[] = [
  "safety",
  "retrieval",
  "voices",
  "synthesis",
  "verdict",
];

export const STAGE_LABELS: Record<StageId, string> = {
  safety: "Safety check",
  retrieval: "Gather evidence",
  voices: "Voices weigh in",
  synthesis: "Review & judge",
  verdict: "Outcome",
};

export interface VoiceRun {
  provider: string;
  display_name: string;
  status: "active" | "done" | "failed";
}

export interface CouncilRunState {
  started: boolean;
  stages: Record<StageId, StageStatus>;
  notes: Partial<Record<StageId, string>>;
  voices: VoiceRun[];
  evidenceCount: number | null;
  verdict: { leader_label: string; leader_weight: number; confidence: string } | null;
  complete: boolean;
}

export function initialRunState(): CouncilRunState {
  return {
    started: false,
    stages: { safety: "pending", retrieval: "pending", voices: "pending", synthesis: "pending", verdict: "pending" },
    notes: {},
    voices: [],
    evidenceCount: null,
    verdict: null,
    complete: false,
  };
}

function set(state: CouncilRunState, id: StageId, status: StageStatus): void {
  state.stages[id] = status;
}

/** Fold one progress event into a new state (pure: returns a fresh object). */
export function reduceRunEvent(prev: CouncilRunState, event: CouncilProgressEvent): CouncilRunState {
  // Clone (shallow is unsafe for nested records/arrays — deep-ish copy).
  const state: CouncilRunState = {
    ...prev,
    stages: { ...prev.stages },
    notes: { ...prev.notes },
    voices: prev.voices.map((v) => ({ ...v })),
  };
  const str = (k: string) => (typeof event[k] === "string" ? (event[k] as string) : "");
  const num = (k: string) => (typeof event[k] === "number" ? (event[k] as number) : null);

  switch (event.kind) {
    case "run_started":
      state.started = true;
      break;
    case "safety_checked":
      set(state, "safety", str("status") === "blocked" ? "failed" : "done");
      break;
    case "retrieval_started":
      set(state, "retrieval", "active");
      break;
    case "retrieval_fallback":
      state.notes.retrieval = str("reason") || "fell back to keyword search";
      break;
    case "retrieval_done":
      set(state, "retrieval", "done");
      state.evidenceCount = num("count");
      break;
    case "voice_started": {
      if (state.stages.voices === "pending") set(state, "voices", "active");
      const provider = str("provider");
      if (!state.voices.some((v) => v.provider === provider)) {
        state.voices.push({ provider, display_name: str("display_name") || provider, status: "active" });
      }
      break;
    }
    case "voice_done":
    case "voice_failed": {
      const provider = str("provider");
      const v = state.voices.find((x) => x.provider === provider);
      if (v) v.status = event.kind === "voice_done" ? "done" : "failed";
      break;
    }
    case "synthesis_started":
      set(state, "voices", "done");
      set(state, "synthesis", "active");
      break;
    case "synthesis_fallback":
      state.notes.synthesis = str("reason") || "synthesis failed; used the lead voice";
      break;
    case "judged": {
      // Single-voice path never starts synthesis.
      if (state.stages.voices !== "done") set(state, "voices", "done");
      set(state, "synthesis", state.stages.synthesis === "active" ? "done" : "skipped");
      set(state, "verdict", "done");
      const conf = str("confidence");
      state.verdict = {
        leader_label: str("leader_label"),
        leader_weight: num("leader_weight") ?? 0,
        confidence: conf || "unknown",
      };
      break;
    }
    case "run_complete":
      state.complete = true;
      // Promote any reached-but-unclosed stage to done (never override failed).
      for (const id of STAGE_ORDER) {
        if (state.stages[id] === "active") set(state, id, "done");
      }
      break;
  }
  return state;
}
```

- [ ] **Step 2: Verify build.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS. (Behavior is exercised end-to-end by the e2e in Task 6; the reducer is intentionally pure so a future unit harness can cover it directly.)

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/councilRun.ts && git commit -m "feat(council): pure run-state reducer for the live map"
```

---

## Task 4: `useCouncilRun` hook

**Files:** Create `app/src/features/council/useCouncilRun.ts`

- [ ] **Step 1: Implement.** Create `app/src/features/council/useCouncilRun.ts`:

```ts
import { useCallback, useRef, useState } from "react";
import type { CouncilProgressEvent } from "../../lib/bible";
import { initialRunState, reduceRunEvent, type CouncilRunState } from "./councilRun";

/**
 * Holds the live Council run state. `handleEvent` is passed to
 * askCouncil(onProgress); `reset` clears it before a new ask. Events are
 * applied in arrival order (the channel delivers a single monotonic stream).
 */
export function useCouncilRun(): {
  runState: CouncilRunState;
  reset: () => void;
  handleEvent: (event: CouncilProgressEvent) => void;
} {
  const [runState, setRunState] = useState<CouncilRunState>(initialRunState);
  // A ref mirror lets handleEvent fold synchronously without stale closures.
  const ref = useRef<CouncilRunState>(runState);

  const reset = useCallback(() => {
    const fresh = initialRunState();
    ref.current = fresh;
    setRunState(fresh);
  }, []);

  const handleEvent = useCallback((event: CouncilProgressEvent) => {
    const next = reduceRunEvent(ref.current, event);
    ref.current = next;
    setRunState(next);
  }, []);

  return { runState, reset, handleEvent };
}
```

- [ ] **Step 2: Verify build.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/useCouncilRun.ts && git commit -m "feat(council): useCouncilRun hook wrapping the run reducer"
```

---

## Task 5: `CouncilRunMap` component (stepper + canvas)

**Files:** Create `app/src/features/council/CouncilRunMap.tsx`

The component renders a semantic stepper (always — this is the reduced-motion + e2e baseline), and a decorative canvas pulse only when motion is allowed. All information lives in the DOM stepper.

- [ ] **Step 1: Implement.** Create `app/src/features/council/CouncilRunMap.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../../lib/useReducedMotion";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  type CouncilRunState,
  type StageId,
  type StageStatus,
} from "./councilRun";

const STATUS_DOT: Record<StageStatus, string> = {
  pending: "bg-neutral-700",
  active: "bg-amber-300",
  done: "bg-emerald-400",
  failed: "bg-red-400",
  skipped: "bg-neutral-700",
};

function StageRow({ id, status, note, elapsed }: { id: StageId; status: StageStatus; note?: string; elapsed?: number }) {
  return (
    <li className="soft-card px-3 py-2" data-testid={`runmap-stage-${id}`} data-status={status}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]} ${status === "active" ? "runmap-active-pulse" : ""}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-neutral-200">{STAGE_LABELS[id]}</span>
        <span className="ml-auto text-xs text-neutral-500">
          {status === "active" && elapsed != null ? `${elapsed}s` : ""}
          {status === "done" ? "✓" : status === "failed" ? "✕" : status === "skipped" ? "—" : ""}
        </span>
      </div>
      {note ? <p className="text-xs text-neutral-500 mt-1 pl-4">{note}</p> : null}
    </li>
  );
}

function RunCanvas({ runState }: { runState: CouncilRunState }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(runState);
  stateRef.current = runState;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const stages = STAGE_ORDER;
      const n = stages.length;
      const activeIdx = stages.findIndex((s) => stateRef.current.stages[s] === "active");
      const doneCount = stages.filter((s) => stateRef.current.stages[s] === "done").length;
      // A thin progress spine with a travelling glow at the active stage.
      const y = h / 2;
      ctx.strokeStyle = "rgba(129,140,248,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(w - 8, y);
      ctx.stroke();
      const progress = (activeIdx >= 0 ? activeIdx : doneCount) / Math.max(1, n - 1);
      const gx = 8 + (w - 16) * Math.min(1, progress);
      const pulse = 4 + Math.sin(t / 240) * 2;
      const grd = ctx.createRadialGradient(gx, y, 0, gx, y, 16);
      grd.addColorStop(0, "rgba(129,140,248,0.9)");
      grd.addColorStop(1, "rgba(129,140,248,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(gx, y, 12 + pulse, 0, Math.PI * 2);
      ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="w-full h-10" data-testid="runmap-canvas" aria-hidden="true" />;
}

export function CouncilRunMap({ runState, elapsed }: { runState: CouncilRunState; elapsed: number }) {
  const reduced = useReducedMotion();
  return (
    <section className="surface-panel rounded-lg p-4 space-y-3" data-testid="council-run-map" aria-label="Council progress">
      {!reduced ? <RunCanvas runState={runState} /> : null}
      <ol className="grid sm:grid-cols-5 gap-2">
        {STAGE_ORDER.map((id) => (
          <StageRow key={id} id={id} status={runState.stages[id]} note={runState.notes[id]} elapsed={elapsed} />
        ))}
      </ol>
      {runState.voices.length > 0 ? (
        <ul className="flex flex-wrap gap-2" data-testid="runmap-voices">
          {runState.voices.map((v) => (
            <li
              key={v.provider}
              data-testid={`runmap-voice-${v.provider}`}
              data-status={v.status}
              className="meta-pill"
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1.5 ${v.status === "done" ? "bg-emerald-400" : v.status === "failed" ? "bg-red-400" : "bg-amber-300"}`}
                aria-hidden="true"
              />
              {v.display_name}
            </li>
          ))}
        </ul>
      ) : null}
      {runState.verdict ? (
        <div className="soft-card px-3 py-2" data-testid="runmap-verdict">
          <span className="text-sm font-semibold text-amber-300">{runState.verdict.leader_label}</span>
          <span className="ml-2 text-xs text-neutral-500">
            {Math.round(runState.verdict.leader_weight * 100)}% · {runState.verdict.confidence} confidence
          </span>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Verify build.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/CouncilRunMap.tsx && git commit -m "feat(council): CouncilRunMap stepper + canvas pulse"
```

---

## Task 6: Wire into `CouncilPanel` + e2e spec

**Files:** Modify `app/src/features/council/CouncilPanel.tsx`; create `app/tests/e2e/council-run-map.spec.ts`

- [ ] **Step 1: Wire the hook + pass onProgress.** In `app/src/features/council/CouncilPanel.tsx`:

(a) Add imports near the other council imports:
```ts
import { CouncilRunMap } from "./CouncilRunMap";
import { useCouncilRun } from "./useCouncilRun";
```

(b) Inside the component, near the other `useState`s (around the `const [loading, setLoading] = useState(false);` at line ~99), add:
```ts
  const { runState, reset: resetRun, handleEvent: onCouncilProgress } = useCouncilRun();
```

(c) In `onAsk`, right after `setLoading(true);` (line ~179), add:
```ts
      resetRun();
```

(d) Change the `askCouncil(...)` call (line ~182) to pass the progress handler as the 4th argument. The call currently ends with `})` after `evidence_limit: ...`. Add `, onCouncilProgress` as the 4th argument to `askCouncil`:
```ts
      const r = await withCouncilTimeout(
        askCouncil(
          q,
          undefined,
          {
            strategy,
            include_cross_refs: includeCrossRefs,
            translation_code: translationCode,
            testament: testament === "all" ? null : testament,
            book_id: bookId || null,
            evidence_limit: Math.min(120, Math.max(10, Math.round(evidenceLimit) || 60)),
          },
          onCouncilProgress,
        ),
      );
```

(e) In the loading render block (line ~309-311), REPLACE `<CouncilRunningPanel settings={settings} elapsed={elapsed} />` with:
```tsx
            <CouncilRunMap runState={runState} elapsed={elapsed} />
```
Remove the now-unused `CouncilRunningPanel` import if nothing else uses it (check: `grep -n CouncilRunningPanel src/features/council/CouncilPanel.tsx`). If `CouncilRunningPanel` is no longer referenced, drop it from the import on line ~26 (keep `CouncilVoicePreview`). Leave `CouncilVoicePanels.tsx` itself untouched (it still exports both).

- [ ] **Step 2: Write the e2e spec.** Create `app/tests/e2e/council-run-map.spec.ts`:

```ts
import { browser, $, expect } from "@wdio/globals";

/**
 * The live "you are here" run map. Mock mode (BIBLE_AI_MOCK_COUNCIL=1) emits the
 * real progress event sequence, so the map must render its stages, show the
 * voices, and reach a completed verdict — never a hung spinner.
 */
describe("Council run map", () => {
  it("shows the staged run map and reaches a verdict on a mock run", async () => {
    const question = `What does the beginning say about creation? runmap ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();

    const heading = await $("h1=The Council");
    await heading.waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");

    const textarea = await $("textarea");
    await textarea.setValue(question);

    const ask = await $("button=Ask the Council");
    await ask.click();

    // The map must appear.
    const map = await $('[data-testid="council-run-map"]');
    await map.waitForDisplayed({ timeout: 15_000 });

    // The retrieval and verdict stages must reach a terminal "done" state, and a
    // verdict must be shown — proving the event stream drove the map to completion.
    await browser.waitUntil(
      async () => {
        const verdict = await $('[data-testid="runmap-verdict"]');
        return await verdict.isExisting();
      },
      { timeout: 30_000, timeoutMsg: "run map never reached a verdict" },
    );

    const retrieval = await $('[data-testid="runmap-stage-retrieval"]');
    expect(await retrieval.getAttribute("data-status")).toBe("done");

    const verdictStage = await $('[data-testid="runmap-stage-verdict"]');
    expect(await verdictStage.getAttribute("data-status")).toBe("done");

    // At least one voice row rendered.
    const voices = await $('[data-testid="runmap-voices"]');
    expect(await voices.isExisting()).toBe(true);
  });
});
```

- [ ] **Step 3: Register the spec.** Open `app/wdio.conf.mts` and add `"./tests/e2e/council-run-map.spec.ts"` to the `specs` array (append it LAST, consistent with how new specs are added).

- [ ] **Step 4: Verify build + type-check.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (no unused-import or type errors; confirm `CouncilRunningPanel` removal if applicable).

- [ ] **Step 5: Build the debug app + run the new e2e spec only.**
Run: `cd "C:/JM Programs/BibleApp/app" && npx tauri build --debug --no-bundle && node scripts/stage-debug-resources.mjs`
Then run just the new spec: `cd "C:/JM Programs/BibleApp/app" && npx wdio run wdio.conf.mts --spec tests/e2e/council-run-map.spec.ts`
Expected: 1 passing.
NOTE (environment): if wdio dies in ~8s with "session not created … only supports Edge version N", msedgedriver is stale vs the installed Edge — download the matching `edgedriver_win64.zip` from `https://msedgedriver.microsoft.com/<version>/` and replace `msedgedriver` (see memory `e2e-msedgedriver-version-pin`). This is an environment fix, not a code regression.

- [ ] **Step 6: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/CouncilPanel.tsx app/tests/e2e/council-run-map.spec.ts app/wdio.conf.mts && git commit -m "feat(council): drive CouncilRunMap from live progress + e2e"
```

---

## Task 7: Full check + full e2e regression

- [ ] **Step 1: Full check.** Run: `cd "C:/JM Programs/BibleApp" && cd app && npm run check`
Expected: exit 0 (vite build, Rust, sidecar, all gates).

- [ ] **Step 2: Full e2e suite** (confirms the new map didn't regress council-mock / layout-maxscale / contrast specs).
Run: `cd "C:/JM Programs/BibleApp/app" && npm run test:e2e:build`
Expected: all specs pass. If counts vary due to machine-load cascade (not a code regression), re-run the affected spec(s) in isolation to confirm (`--spec <file>`); only treat a deterministic, isolated failure as real.

- [ ] **Step 3: Commit any fixups.**
```bash
cd "C:/JM Programs/BibleApp" && git add -A && git commit -m "chore: P2 run map — full check + e2e green" || echo "nothing to commit"
```

---

## Self-Review

- **Spec coverage:** §6 CouncilRunMap → Tasks 5/6 (stepper = reduced-motion baseline; canvas = motion path; every node maps to a stage; verdict shows leader+confidence). §4 tokens/grammar → Task 1 (P0 folded in). §9 a11y/testing → reduced-motion via Task 2 + the stepper-always design; e2e via Task 6; full regression Task 7. P1 consumption → Tasks 3/4/6 (reducer + hook + `onProgress` wiring).
- **Placeholder scan:** none — every code step is complete; every run step has command + expected output.
- **Type consistency:** `CouncilProgressEvent` (from P1, `lib/bible.ts`), `CouncilRunState`/`StageId`/`StageStatus`/`reduceRunEvent`/`initialRunState` are defined in Task 3 and consumed unchanged in Tasks 4/5; `useCouncilRun` returns `{ runState, reset, handleEvent }` consumed in Task 6; `CouncilRunMap` props `{ runState, elapsed }` match the call site.
- **Known environment risk:** Task 6/7 require building the debug app + msedgedriver matching the installed Edge (documented inline). Frontend logic is e2e-verified (no unit harness), consistent with the repo.
- **Deliberately deferred:** the "conflict" visualization and rich verdict/why live in the result view + explorer (P3/P4), not the live map.
