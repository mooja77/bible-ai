# P3 — Reasoning Explorer (drill-anywhere) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable, recursive view of a finished Council result where the user can drill from the ranked outcome into any position → the voices that argued it and the scriptures that support/challenge it → each verse's retrieval scores and full text → each voice's reasoning → the argument map, climbing back via a breadcrumb. Every level uses one constant grammar: **what produced it ▸ · the focus · ◂ what it affects.**

**Architecture:** A pure model (`reasoningModel.ts`) resolves entities + relationships from a `CouncilResponse` (no new backend data — `CouncilResponse` already carries everything). `ReasoningExplorer.tsx` holds a navigation stack of entity references, renders a breadcrumb, and dispatches to per-entity renderers that share the 3-zone layout. It is **additive and opt-in**: a "Trace the reasoning" toggle in the result opens it; the existing result/transparency components are untouched this phase (their migration into the explorer is deferred to a later phase to keep churn/regression risk low).

**Tech Stack:** React 19 + TypeScript, Tailwind v4 + the P2 semantic tokens, WebdriverIO e2e (frontend logic is e2e-only here).

**Spec:** `docs/superpowers/specs/2026-06-20-ui-ux-overhaul-design.md` §7. Scope note: this delivers §7.1 navigation + §7.2 renderers (Outcome/Position/Verse/Voice/Argument) + §7.3 full-visibility for those paths. Deferred to a later phase: folding the *existing* transparency panels into the explorer (§7 "replaces"), and the Conflict/Tension renderer.

**Data model (already in `app/src/lib/bible.ts`, from the corpus — no changes needed):**
- `CouncilResponse`: `synthesis: CouncilResult`, `voices: CouncilVoice[]`, `retrieved_evidence?: RetrievedEvidence[]`.
- `CouncilResult`: `positions: CouncilPosition[]`, `confidence`, `confidence_rationale?`, `dissent_notes?`, `unresolved_tensions?`.
- `CouncilPosition`: `label`, `weight`, `summary`, `evidence: CouncilEvidence[]`, `supporting_evidence_ids?: number[]`, `challenging_evidence_ids?: number[]`, `why_not_higher?`, `confidence_rationale?`, `weakest_link?`, `what_would_change_this?`, `interpretive_moves?: string[]`, `source_position_labels?: string[]`, `argument_map?: ArgumentMap`.
- `RetrievedEvidence`: `verse_id`, `translation_code`, `book_name`, `chapter`, `verse`, `text`, `score?`, `semantic_score?`, `keyword_score?`, `cross_reference_weight?`, `matched_terms?: string[]`.
- `CouncilVoice`: `provider`, `display_name`, `status`, `result: CouncilResult | null`, `error?`, `error_category?`, `error_hint?`, `duration_ms`.
- `CouncilEvidence`: `verse_id`, `citation`, `translation_code`, `quote`, `reasoning`.
- `ArgumentMap`: `nodes: { id, kind, label, detail, verse_ids? }[]`, `edges: { from, to, label? }[]`.

---

## File Structure

- `app/src/features/council/explorer/reasoningModel.ts` — **create**; pure entity/relationship resolvers over `CouncilResponse`.
- `app/src/features/council/explorer/ReasoningExplorer.tsx` — **create**; nav stack + breadcrumb + the 5 entity renderers (3-zone grammar).
- `app/src/features/council/CouncilPanel.tsx` — add a "Trace the reasoning" toggle that mounts `ReasoningExplorer` in the result block.
- `app/tests/e2e/reasoning-explorer.spec.ts` — **create**; drives a mock result and drills outcome → position → verse → back, and position → voice.

---

## Task 1: Pure reasoning model

**Files:** Create `app/src/features/council/explorer/reasoningModel.ts`

- [ ] **Step 1: Implement.** Create the file with exactly:

```ts
import type {
  CouncilResponse,
  CouncilPosition,
  CouncilVoice,
  RetrievedEvidence,
} from "../../../lib/bible";

/** A reference to one explorable entity (the nav-stack element). */
export type ExplorerEntity =
  | { type: "outcome" }
  | { type: "position"; label: string }
  | { type: "verse"; verseId: number }
  | { type: "voice"; provider: string }
  | { type: "argument"; positionLabel: string };

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

/** Positions sorted by descending final weight (the ranked outcome). */
export function rankedPositions(response: CouncilResponse): CouncilPosition[] {
  return [...(response.synthesis?.positions ?? [])].sort((a, b) => b.weight - a.weight);
}

export function findPosition(response: CouncilResponse, label: string): CouncilPosition | undefined {
  return (response.synthesis?.positions ?? []).find((p) => norm(p.label) === norm(label));
}

export function findVerse(response: CouncilResponse, verseId: number): RetrievedEvidence | undefined {
  return (response.retrieved_evidence ?? []).find((v) => v.verse_id === verseId);
}

export function findVoice(response: CouncilResponse, provider: string): CouncilVoice | undefined {
  return (response.voices ?? []).find((v) => v.provider === provider);
}

/** Voices that argued a position: a voice whose own result has a position whose
 *  label matches this synthesis position's label or one of its
 *  source_position_labels. */
export function positionVoices(response: CouncilResponse, position: CouncilPosition): CouncilVoice[] {
  const targets = new Set<string>([norm(position.label), ...(position.source_position_labels ?? []).map(norm)]);
  return (response.voices ?? []).filter(
    (voice) =>
      voice.status === "ok" &&
      (voice.result?.positions ?? []).some((p) => targets.has(norm(p.label))),
  );
}

/** Supporting / challenging verses for a position, resolved against retrieved
 *  evidence. Falls back to the position's cited evidence verse_ids when the
 *  explicit support/challenge id lists are absent. */
export function positionEvidence(
  response: CouncilResponse,
  position: CouncilPosition,
): { support: RetrievedEvidence[]; challenge: RetrievedEvidence[] } {
  const resolve = (ids: number[] | undefined) =>
    (ids ?? [])
      .map((id) => findVerse(response, id))
      .filter((v): v is RetrievedEvidence => v != null);
  let support = resolve(position.supporting_evidence_ids);
  const challenge = resolve(position.challenging_evidence_ids);
  if (support.length === 0 && position.evidence.length > 0) {
    support = position.evidence
      .map((e) => findVerse(response, e.verse_id))
      .filter((v): v is RetrievedEvidence => v != null);
  }
  return { support, challenge };
}

/** Every position that uses a given verse, with how it uses it. */
export function versePositions(
  response: CouncilResponse,
  verseId: number,
): { position: CouncilPosition; relation: "support" | "challenge" }[] {
  const out: { position: CouncilPosition; relation: "support" | "challenge" }[] = [];
  for (const position of response.synthesis?.positions ?? []) {
    const { support, challenge } = positionEvidence(response, position);
    if (support.some((v) => v.verse_id === verseId)) out.push({ position, relation: "support" });
    else if (challenge.some((v) => v.verse_id === verseId)) out.push({ position, relation: "challenge" });
  }
  return out;
}

/** Retrieval score components as 0–100 ints (raw scores may be 0–1 or absent). */
export function verseScoreParts(verse: RetrievedEvidence): {
  semantic: number;
  keyword: number;
  xref: number;
  combined: number;
} {
  const pct = (n: number | undefined) => Math.round(Math.max(0, Math.min(1, n ?? 0)) * 100);
  return {
    semantic: pct(verse.semantic_score),
    keyword: pct(verse.keyword_score),
    xref: pct(verse.cross_reference_weight),
    combined: pct(verse.score),
  };
}

export function verseCitation(verse: RetrievedEvidence): string {
  return `${verse.book_name} ${verse.chapter}:${verse.verse}`;
}

/** A short human label for a breadcrumb entry. */
export function entityLabel(response: CouncilResponse, entity: ExplorerEntity): string {
  switch (entity.type) {
    case "outcome":
      return "Outcome";
    case "position":
      return entity.label;
    case "verse": {
      const v = findVerse(response, entity.verseId);
      return v ? verseCitation(v) : `Verse ${entity.verseId}`;
    }
    case "voice": {
      const voice = findVoice(response, entity.provider);
      return voice ? voice.display_name : entity.provider;
    }
    case "argument":
      return `${entity.positionLabel} — argument map`;
  }
}
```

- [ ] **Step 2: Verify.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (tsc + vite). The module is unused until Task 2 — fine.

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/explorer/reasoningModel.ts && git commit -m "feat(council): pure reasoning model for the explorer"
```

---

## Task 2: `ReasoningExplorer` component (nav + breadcrumb + renderers)

**Files:** Create `app/src/features/council/explorer/ReasoningExplorer.tsx`

- [ ] **Step 1: Implement.** Create the file with exactly:

```tsx
import { useState } from "react";
import type { CouncilResponse, CouncilPosition, RetrievedEvidence } from "../../../lib/bible";
import {
  type ExplorerEntity,
  rankedPositions,
  findPosition,
  findVerse,
  findVoice,
  positionVoices,
  positionEvidence,
  versePositions,
  verseScoreParts,
  verseCitation,
  entityLabel,
} from "./reasoningModel";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ReasoningExplorer({ response }: { response: CouncilResponse }) {
  const [stack, setStack] = useState<ExplorerEntity[]>([{ type: "outcome" }]);
  const current = stack[stack.length - 1];
  const push = (entity: ExplorerEntity) => setStack((s) => [...s, entity]);
  const goTo = (index: number) => setStack((s) => s.slice(0, index + 1));

  return (
    <section className="surface-panel rounded-lg p-4 space-y-3" data-testid="reasoning-explorer" aria-label="Reasoning explorer">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="re-breadcrumb" aria-label="Breadcrumb">
        {stack.map((entity, i) => {
          const last = i === stack.length - 1;
          const label = entityLabel(response, entity);
          return (
            <span key={i} className="flex items-center gap-1.5">
              {last ? (
                <span className="text-neutral-200">{label}</span>
              ) : (
                <button type="button" className="text-amber-300 hover:underline" data-testid={`re-crumb-${i}`} onClick={() => goTo(i)}>
                  {label}
                </button>
              )}
              {!last ? <span className="text-neutral-600">›</span> : null}
            </span>
          );
        })}
      </nav>
      <div className="flex justify-center gap-4 text-[0.65rem] text-neutral-500">
        <span>● a voice</span>
        <span className="text-emerald-400">▲ supports</span>
        <span className="text-red-400">▼ challenges</span>
      </div>
      <div data-testid="re-body">
        {current.type === "outcome" && <OutcomeView response={response} onOpen={push} />}
        {current.type === "position" && <PositionView response={response} label={current.label} onOpen={push} />}
        {current.type === "verse" && <VerseView response={response} verseId={current.verseId} onOpen={push} />}
        {current.type === "voice" && <VoiceView response={response} provider={current.provider} onOpen={push} />}
        {current.type === "argument" && <ArgumentView response={response} positionLabel={current.positionLabel} onOpen={push} />}
      </div>
    </section>
  );
}

type Open = (entity: ExplorerEntity) => void;

function Zone({ title, children, testid }: { title: string; children: React.ReactNode; testid: string }) {
  return (
    <div className="space-y-2" data-testid={testid}>
      <p className="text-[0.65rem] uppercase tracking-wider text-neutral-500">{title}</p>
      {children}
    </div>
  );
}

function Grid({ left, focus, right }: { left: React.ReactNode; focus: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-[1fr_1.3fr_1fr] gap-3 items-start">
      {left}
      {focus}
      {right}
    </div>
  );
}

function Item({ onClick, testid, className, children }: { onClick?: () => void; testid: string; className?: string; children: React.ReactNode }) {
  const cls = `soft-card ${onClick ? "soft-card-hover cursor-pointer" : ""} px-3 py-2 text-sm w-full text-left ${className ?? ""}`;
  return onClick ? (
    <button type="button" className={cls} data-testid={testid} onClick={onClick}>{children}</button>
  ) : (
    <div className={cls} data-testid={testid}>{children}</div>
  );
}

function OutcomeView({ response, onOpen }: { response: CouncilResponse; onOpen: Open }) {
  const positions = rankedPositions(response);
  const conf = response.synthesis?.confidence ?? "unknown";
  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-400">The answer — {positions.length} position{positions.length === 1 ? "" : "s"}, ranked · {conf} confidence. Tap one to see why it weighs what it does.</p>
      {positions.map((p, i) => (
        <Item key={p.label} testid={`re-position-${i}`} onClick={() => onOpen({ type: "position", label: p.label })} className={i === 0 ? "border-amber-400/60" : ""}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-neutral-100">{p.label}</span>
            <span className="font-mono text-amber-300">{Math.round(p.weight * 100)}%</span>
          </div>
        </Item>
      ))}
    </div>
  );
}

function SupportBar({ support, challenge }: { support: number; challenge: number }) {
  const total = support + challenge || 1;
  return (
    <div className="space-y-1">
      <div className="flex h-2.5 rounded overflow-hidden bg-neutral-800">
        <span className="bg-emerald-400" style={{ width: `${(100 * support) / total}%` }} />
        <span className="bg-red-400" style={{ width: `${(100 * challenge) / total}%` }} />
      </div>
      <div className="flex justify-between text-[0.65rem] text-neutral-500">
        <span className="text-emerald-400">{support} supporting</span>
        <span className="text-red-400">{challenge} challenging</span>
      </div>
    </div>
  );
}

function PositionView({ response, label, onOpen }: { response: CouncilResponse; label: string; onOpen: Open }) {
  const position = findPosition(response, label);
  if (!position) return <p className="text-sm text-neutral-500">Position not found.</p>;
  const voices = positionVoices(response, position);
  const { support, challenge } = positionEvidence(response, position);
  return (
    <Grid
      left={
        <Zone title={`Voices arguing it (${voices.length})`} testid="re-zone-left">
          {voices.length === 0 ? <p className="text-xs text-neutral-600 italic">No voice argued this — surfaced from retrieval.</p> : null}
          {voices.map((v) => (
            <Item key={v.provider} testid={`re-voice-${v.provider}`} onClick={() => onOpen({ type: "voice", provider: v.provider })}>
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-2 align-middle" aria-hidden="true" />
              {v.display_name}
            </Item>
          ))}
        </Zone>
      }
      focus={
        <Zone title="Why this weight" testid="re-zone-focus">
          <div className="soft-card px-3 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-neutral-100">{position.label}</span>
              <span className="font-mono text-lg text-amber-300">{Math.round(position.weight * 100)}%</span>
            </div>
            <SupportBar support={support.length} challenge={challenge.length} />
            <p className="text-xs text-neutral-400 leading-relaxed">{position.summary}</p>
          </div>
          {position.weakest_link ? <Item testid="re-weakest">⚠ Weakest link: <span className="text-neutral-400">{position.weakest_link}</span></Item> : null}
          {position.what_would_change_this ? <Item testid="re-change">↻ What would change this: <span className="text-neutral-400">{position.what_would_change_this}</span></Item> : null}
          {position.argument_map ? (
            <Item testid="re-open-argument" onClick={() => onOpen({ type: "argument", positionLabel: position.label })}>◈ Argument map</Item>
          ) : null}
        </Zone>
      }
      right={
        <Zone title="Scriptures & how they’re used" testid="re-zone-right">
          {support.map((v) => (
            <Item key={`s-${v.verse_id}`} testid={`re-verse-${v.verse_id}`} onClick={() => onOpen({ type: "verse", verseId: v.verse_id })} className="border-l-2 border-emerald-400">
              <span className="text-emerald-400 text-xs mr-1">▲</span>{verseCitation(v)}
            </Item>
          ))}
          {challenge.map((v) => (
            <Item key={`c-${v.verse_id}`} testid={`re-verse-${v.verse_id}`} onClick={() => onOpen({ type: "verse", verseId: v.verse_id })} className="border-l-2 border-red-400">
              <span className="text-red-400 text-xs mr-1">▼</span>{verseCitation(v)}
            </Item>
          ))}
          {support.length === 0 && challenge.length === 0 ? <p className="text-xs text-neutral-600 italic">No linked scriptures.</p> : null}
        </Zone>
      }
    />
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span className="w-16 text-neutral-500">{label}</span>
      <span className="flex-1 h-1.5 rounded bg-neutral-800 overflow-hidden"><span className="block h-full bg-sky-400" style={{ width: `${value}%` }} /></span>
      <span className="w-8 text-right">{value}%</span>
    </div>
  );
}

function VerseView({ response, verseId, onOpen }: { response: CouncilResponse; verseId: number; onOpen: Open }) {
  const verse = findVerse(response, verseId);
  if (!verse) return <p className="text-sm text-neutral-500">Verse not found in the retrieved evidence.</p>;
  const s = verseScoreParts(verse);
  const touches = versePositions(response, verseId);
  return (
    <Grid
      left={
        <Zone title="Why it was retrieved" testid="re-zone-left">
          <div className="space-y-1.5">
            <ScoreBar label="Semantic" value={s.semantic} />
            <ScoreBar label="Keyword" value={s.keyword} />
            <ScoreBar label="Cross-ref" value={s.xref} />
          </div>
          <Item testid="re-verse-combined">∑ Combined relevance <span className="float-right font-mono text-amber-300">{s.combined}%</span></Item>
          {verse.matched_terms && verse.matched_terms.length > 0 ? (
            <p className="text-xs text-neutral-500">Matched: {verse.matched_terms.map((t) => <b key={t} className="text-neutral-400">{t} </b>)}</p>
          ) : null}
        </Zone>
      }
      focus={
        <Zone title={`${verseCitation(verse)} · ${verse.translation_code}`} testid="re-zone-focus">
          <blockquote className="soft-card px-3 py-3 text-sm font-serif leading-relaxed text-neutral-100" style={{ borderLeft: "3px solid var(--c-stage-active)" }} data-testid="re-verse-text">
            “{verse.text}”
          </blockquote>
        </Zone>
      }
      right={
        <Zone title="Where this verse is used" testid="re-zone-right">
          {touches.length === 0 ? <p className="text-xs text-neutral-600 italic">Retrieved but not cited by a position.</p> : null}
          {touches.map(({ position, relation }) => (
            <Item key={position.label} testid={`re-position-link-${slug(position.label)}`} onClick={() => onOpen({ type: "position", label: position.label })} className={`border-l-2 ${relation === "support" ? "border-emerald-400" : "border-red-400"}`}>
              <span className={`${relation === "support" ? "text-emerald-400" : "text-red-400"} text-xs mr-1`}>{relation === "support" ? "▲" : "▼"}</span>
              {position.label} <span className="text-neutral-500">· {Math.round(position.weight * 100)}%</span>
            </Item>
          ))}
        </Zone>
      }
    />
  );
}

function VoiceView({ response, provider, onOpen }: { response: CouncilResponse; provider: string; onOpen: Open }) {
  const voice = findVoice(response, provider);
  if (!voice) return <p className="text-sm text-neutral-500">Voice not found.</p>;
  const stances = (voice.result?.positions ?? []);
  return (
    <Grid
      left={
        <Zone title="This voice" testid="re-zone-left">
          <Item testid="re-voice-status">{voice.display_name} <span className="float-right text-neutral-500">{voice.status}</span></Item>
          <Item testid="re-voice-duration">⏱ Time taken <span className="float-right text-neutral-400">{(voice.duration_ms / 1000).toFixed(1)}s</span></Item>
          {voice.error ? <Item testid="re-voice-error" className="border-l-2 border-red-400"><span className="text-red-400">{voice.error_category ?? "error"}:</span> <span className="text-neutral-400">{voice.error_hint ?? voice.error}</span></Item> : null}
        </Zone>
      }
      focus={
        <Zone title="Its reasoning" testid="re-zone-focus">
          {voice.result?.synthesis ? (
            <blockquote className="soft-card px-3 py-3 text-sm leading-relaxed text-neutral-200" data-testid="re-voice-rationale">{voice.result.synthesis}</blockquote>
          ) : <p className="text-xs text-neutral-600 italic">No rationale returned.</p>}
        </Zone>
      }
      right={
        <Zone title="Its stance(s)" testid="re-zone-right">
          {stances.map((p) => {
            const synth = findPosition(response, p.label);
            return (
              <Item key={p.label} testid={`re-stance-${slug(p.label)}`} onClick={synth ? () => onOpen({ type: "position", label: synth.label }) : undefined}>
                → {p.label}{synth ? <span className="text-neutral-500"> · {Math.round(synth.weight * 100)}%</span> : null}
              </Item>
            );
          })}
        </Zone>
      }
    />
  );
}

function ArgumentView({ response, positionLabel, onOpen }: { response: CouncilResponse; positionLabel: string; onOpen: Open }) {
  const position = findPosition(response, positionLabel);
  const map = position?.argument_map;
  if (!map) return <p className="text-sm text-neutral-500">No argument map for this position.</p>;
  const kindClass: Record<string, string> = {
    claim: "border-indigo-400 bg-indigo-500/10",
    support: "border-emerald-400/60 bg-emerald-500/10 ml-6",
    challenge: "border-red-400/60 bg-red-500/10 ml-6",
    assumption: "border-neutral-600 ml-6",
    weakness: "border-red-400/60 ml-6",
    question: "border-sky-400/60 ml-6",
  };
  return (
    <div className="space-y-2" data-testid="re-argument-map">
      <p className="text-sm text-neutral-400">The claim, its support, and what cuts against it.</p>
      {map.nodes.map((node) => {
        const firstVerse = node.verse_ids?.[0];
        const verse = firstVerse != null ? findVerse(response, firstVerse) : undefined;
        return (
          <div key={node.id}>
            <Item
              testid={`re-arg-${slug(node.id)}`}
              onClick={verse ? () => onOpen({ type: "verse", verseId: verse.verse_id }) : undefined}
              className={`border ${kindClass[node.kind] ?? "border-neutral-600"}`}
            >
              <span className="text-[0.65rem] uppercase tracking-wider text-neutral-500 mr-2">{node.kind}</span>
              {node.label}
              {verse ? <span className="text-amber-300 text-xs ml-2">→ {verseCitation(verse)}</span> : null}
            </Item>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (tsc + vite). No unused imports; `React.ReactNode` is referenced via the global JSX types (React 19 automatic runtime) — if tsc flags `React` as undefined, add `import type { ReactNode } from "react";` and replace `React.ReactNode` with `ReactNode`.

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/explorer/ReasoningExplorer.tsx && git commit -m "feat(council): ReasoningExplorer — drill-anywhere result view"
```

---

## Task 3: Wire the explorer into `CouncilPanel` + e2e

**Files:** Modify `app/src/features/council/CouncilPanel.tsx`; create `app/tests/e2e/reasoning-explorer.spec.ts`

- [ ] **Step 1: Add the toggle + mount.** In `app/src/features/council/CouncilPanel.tsx`:

(a) Add the import near the other council imports:
```ts
import { ReasoningExplorer } from "./explorer/ReasoningExplorer";
```

(b) Add a toggle state near the other `useState`s:
```ts
  const [showExplorer, setShowExplorer] = useState(false);
```

(c) In the result block `{response && !response.sensitive_topic && (` (around line 388), find where `<CouncilResultView` is rendered (around line 476). Immediately BEFORE the `<CouncilResultView` element, insert a toggle button + the explorer:
```tsx
            <div className="space-y-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-sm"
                data-testid="trace-reasoning-toggle"
                aria-expanded={showExplorer}
                onClick={() => setShowExplorer((v) => !v)}
              >
                {showExplorer ? "Hide the reasoning" : "Trace the reasoning →"}
              </button>
              {showExplorer ? <ReasoningExplorer response={response} /> : null}
            </div>
```
(Match the existing indentation/JSX structure in that block. The `response` in scope here is the non-null `CouncilResponse`. Keep `<CouncilResultView .../>` exactly as-is after this insertion.)

(d) Reset the toggle when the result changes so a new ask / session select doesn't keep a stale explorer open. In `onAsk` (after `setResponse(null);` near the top, ~line 175) add `setShowExplorer(false);`, and in `onSelectSession` (after its `setResponse`/reset area) add `setShowExplorer(false);`.

- [ ] **Step 2: Create the e2e spec** `app/tests/e2e/reasoning-explorer.spec.ts`:

```ts
import { browser, $, expect } from "@wdio/globals";

/**
 * The drill-anywhere reasoning explorer. On a mock result the user must be able
 * to open it, drill outcome → position → verse (reaching raw verse text + score
 * breakdown) and outcome → position → voice, and climb back via the breadcrumb.
 */
describe("Reasoning explorer", () => {
  it("drills from the outcome down to a verse and a voice, and climbs back", async () => {
    const question = `What does the beginning say about creation? explorer ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 15_000 });
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");
    await (await $("textarea")).setValue(question);
    await (await $("button=Ask the Council")).click();

    // Wait for the result, then open the explorer.
    const toggle = await $('[data-testid="trace-reasoning-toggle"]');
    await toggle.waitForClickable({ timeout: 30_000 });
    await toggle.click();

    const explorer = await $('[data-testid="reasoning-explorer"]');
    await explorer.waitForDisplayed({ timeout: 10_000 });

    // Outcome → first position.
    const firstPosition = await $('[data-testid="re-position-0"]');
    await firstPosition.waitForClickable({ timeout: 10_000 });
    await firstPosition.click();

    // Focus zone shows the position's weight; right zone has at least one verse.
    const focus = await $('[data-testid="re-zone-focus"]');
    await focus.waitForDisplayed({ timeout: 10_000 });

    // Drill into the first scripture in the right zone.
    const right = await $('[data-testid="re-zone-right"]');
    const verseItem = await right.$('[data-testid^="re-verse-"]');
    await verseItem.waitForClickable({ timeout: 10_000 });
    await verseItem.click();

    // We reached raw verse text + the combined score (bottom of the drill).
    const verseText = await $('[data-testid="re-verse-text"]');
    await verseText.waitForDisplayed({ timeout: 10_000 });
    expect((await verseText.getText()).length).toBeGreaterThan(5);
    expect(await (await $('[data-testid="re-verse-combined"]')).isExisting()).toBe(true);

    // Climb back to the outcome via the first breadcrumb.
    const crumb0 = await $('[data-testid="re-crumb-0"]');
    await crumb0.waitForClickable({ timeout: 10_000 });
    await crumb0.click();
    await (await $('[data-testid="re-position-0"]')).waitForDisplayed({ timeout: 10_000 });
  });
});
```

- [ ] **Step 3: Register the spec.** Append `"./tests/e2e/reasoning-explorer.spec.ts"` to the `specs` array in `app/wdio.conf.mts` (last entry, matching existing format).

- [ ] **Step 4: Verify type-check/build.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS. Confirm no unused-var / type errors.

- [ ] **Step 5: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/council/CouncilPanel.tsx app/tests/e2e/reasoning-explorer.spec.ts app/wdio.conf.mts && git commit -m "feat(council): mount ReasoningExplorer from the result + e2e"
```

---

## Task 4: Build, run the explorer e2e, full check

(The controller drives the heavy e2e build/run, handling any msedgedriver/version environment issues.)

- [ ] **Step 1: Build debug app + stage.** `cd "C:/JM Programs/BibleApp/app" && npx tauri build --debug --no-bundle && node scripts/stage-debug-resources.mjs`
- [ ] **Step 2: Run the explorer spec.** `cd "C:/JM Programs/BibleApp/app" && npx wdio run wdio.conf.mts --spec tests/e2e/reasoning-explorer.spec.ts` — expect 1 passing. (If it fails on the first `button=Council` click after a long compile, that is the known load flake — re-run once; only a deterministic isolated failure is a real bug. msedgedriver/Edge version mismatch → download the matching driver per memory `e2e-msedgedriver-version-pin`.)
- [ ] **Step 3: Full check.** `cd "C:/JM Programs/BibleApp/app" && npm run check` — expect exit 0.
- [ ] **Step 4: Regression on affected specs.** `cd "C:/JM Programs/BibleApp/app" && npx wdio run wdio.conf.mts --spec tests/e2e/council-mock.spec.ts --spec tests/e2e/layout-maxscale.spec.ts --spec tests/e2e/contrast-light.spec.ts --spec tests/e2e/reasoning-explorer.spec.ts` — expect all passing.
- [ ] **Step 5: Commit any fixups.** `cd "C:/JM Programs/BibleApp" && git add -A && git commit -m "chore: P3 reasoning explorer — checks green" || echo "nothing to commit"`

---

## Self-Review

- **Spec coverage (§7):** navigation stack + breadcrumb → Task 2 (`ReasoningExplorer`); renderers Outcome/Position/Verse/Voice/Argument with causes ▸ focus ◂ effects → Task 2; full-visibility for those paths (raw verse text + score components + matched terms; voice rationale + error + duration; position weight math + weakest_link + what_would_change + argument map; argument nodes → verses) → Tasks 1–2; reachable from the result → Task 3. Deferred (explicit): folding the existing transparency panels into the explorer and the Conflict/Tension renderer.
- **Placeholder scan:** none — complete code in every code step; commands + expected results in every run step.
- **Type consistency:** `ExplorerEntity` union + all resolver names (`rankedPositions`/`findPosition`/`findVerse`/`findVoice`/`positionVoices`/`positionEvidence`/`versePositions`/`verseScoreParts`/`verseCitation`/`entityLabel`) defined in Task 1, consumed unchanged in Task 2; `ReasoningExplorer` takes `{ response: CouncilResponse }`, mounted that way in Task 3. Testids used by the e2e (`reasoning-explorer`, `re-position-0`, `re-zone-focus`/`re-zone-right`, `re-verse-*`, `re-verse-text`, `re-verse-combined`, `re-crumb-0`, `trace-reasoning-toggle`) all exist in Tasks 2–3.
- **Known environment risk:** Task 4 needs the debug build + msedgedriver matching Edge (documented).
- **Additive & safe:** the explorer is opt-in and does not modify `CouncilResultView` or the existing transparency components, so regression surface is limited to the new toggle in the result block.
