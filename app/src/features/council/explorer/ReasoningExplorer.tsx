import { useState } from "react";
import type { ReactNode } from "react";
import type { CouncilResponse } from "../../../lib/bible";
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

function Zone({ title, children, testid }: { title: string; children: ReactNode; testid: string }) {
  return (
    <div className="space-y-2" data-testid={testid}>
      <p className="text-[0.65rem] uppercase tracking-wider text-neutral-500">{title}</p>
      {children}
    </div>
  );
}

function Grid({ left, focus, right }: { left: ReactNode; focus: ReactNode; right: ReactNode }) {
  return (
    <div className="grid md:grid-cols-[1fr_1.3fr_1fr] gap-3 items-start">
      {left}
      {focus}
      {right}
    </div>
  );
}

function Item({ onClick, testid, className, children }: { onClick?: () => void; testid: string; className?: string; children: ReactNode }) {
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
        <Zone title="Scriptures & how they're used" testid="re-zone-right">
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
            "{verse.text}"
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
