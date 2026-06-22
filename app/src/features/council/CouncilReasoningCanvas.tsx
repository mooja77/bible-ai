import { useEffect, useRef, useState } from "react";
import type {
  CouncilResponse,
  CouncilPosition,
  RetrievedEvidence,
} from "../../lib/bible";
import {
  type ExplorerEntity,
  rankedPositions,
  positionVoices,
  positionEvidence,
  versePositions,
  verseScoreParts,
  verseCitation,
  findVerse,
  findVoice,
  findPosition,
} from "./explorer/reasoningModel";
import { CouncilHeroReveal } from "./CouncilHeroReveal";

/**
 * Council Reasoning Canvas (T1 — static, drillable; polished + reviewed).
 *
 * One legible "how & why" story told as a numbered editorial timeline:
 * Evidence gathered → Voices weigh in → Agreement & conflict → The judge weighs
 * → Outcome. Driven entirely by the real CouncilResponse; every verse, voice and
 * position is clickable and opens an in-place inspector that drills to the bottom.
 *
 * Research-grounded: each verse shows its ROLE (supporting / conflicting / used /
 * ignored — provenance, not just strength); counter-evidence is visible in the
 * main flow (people weight falsifying evidence heavily); confidence reads as
 * countable units (pips), never a % or a threshold band. Every visual encoding
 * has a text equivalent for screen readers.
 */

const VOICE_VARS = ["--c-voice-a", "--c-voice-b", "--c-voice-c", "--c-voice-d"];
const EVIDENCE_SHOWN = 10;
const CONFIDENCE_LEVEL: Record<string, number> = { low: 1, medium: 2, high: 3 };

type EvidenceRole = "supporting" | "conflicting" | "used" | "ignored";
const ROLE_COLOR: Record<EvidenceRole, string> = {
  supporting: "var(--c-support)",
  conflicting: "var(--c-challenge)",
  used: "var(--accent)",
  ignored: "var(--color-neutral-600)",
};
const ROLE_WORD: Record<EvidenceRole, string> = {
  supporting: "supports the leading view",
  conflicting: "challenges the leading view",
  used: "used in analysis",
  ignored: "considered but set aside",
};

function Band({
  step,
  kicker,
  title,
  runmapStage,
  status,
  children,
}: {
  step: number;
  kicker: string;
  title: string;
  runmapStage?: string;
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="reasoning-band"
      {...(runmapStage ? { "data-testid": `runmap-stage-${runmapStage}`, "data-status": status } : {})}
    >
      <span className="reasoning-band-node" aria-hidden="true">
        {String(step).padStart(2, "0")}
      </span>
      <div className="space-y-3">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h3 className="editorial-section-h2 mt-0.5">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CouncilReasoningCanvas({
  response,
  question,
}: {
  response: CouncilResponse;
  question: string;
}) {
  const [focus, setFocus] = useState<ExplorerEntity | null>(null);
  // Remounting the timeline replays the staggered reveal (reduced-motion safe).
  const [revealKey, setRevealKey] = useState(0);

  // The cinematic hero plays once per result (skipped under reduced-motion),
  // then settles into the legible timeline below.
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Skip the cinematic under the e2e harness — it's a ~7s full-cover overlay that
  // would block test interaction; the legible canvas beneath is what specs cover.
  const skipHero =
    prefersReduced || (typeof navigator !== "undefined" && navigator.webdriver);
  const [heroDone, setHeroDone] = useState<boolean>(skipHero);
  const [heroKey, setHeroKey] = useState(0);
  useEffect(() => {
    if (skipHero) return;
    setHeroDone(false);
    setHeroKey((k) => k + 1);
  }, [question, skipHero]);

  const positions = rankedPositions(response);
  const leader = positions[0] as CouncilPosition | undefined;
  const okVoices = (response.voices ?? []).filter((v) => v.status === "ok");
  const evidence = [...(response.retrieved_evidence ?? [])].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );

  // Provenance: each verse's role, from the synthesis classification.
  const roleByVerse = new Map<number, EvidenceRole>();
  for (const c of response.synthesis?.evidence_classification ?? []) {
    const status = c.status as string;
    if (status === "supporting" || status === "conflicting" || status === "ignored") {
      roleByVerse.set(c.verse_id, status);
    } else {
      roleByVerse.set(c.verse_id, "used");
    }
  }

  const voiceIndex = (provider: string) => {
    const i = okVoices.findIndex((v) => v.provider === provider);
    return i >= 0 ? i : okVoices.length; // distinct wrap, never aliases voice A
  };
  const voiceColor = (provider: string) =>
    `var(${VOICE_VARS[voiceIndex(provider) % VOICE_VARS.length]})`;

  const leaderVoices = leader ? positionVoices(response, leader) : [];
  const leaderEvidence = leader
    ? positionEvidence(response, leader)
    : { support: [] as RetrievedEvidence[], challenge: [] as RetrievedEvidence[] };
  const singleVoice = okVoices.length <= 1;
  const noVoices = okVoices.length === 0;
  const confidenceWord = response.synthesis?.confidence ?? "unknown";
  const confidenceLevel = CONFIDENCE_LEVEL[confidenceWord] ?? 0;

  return (
    <section
      data-testid="council-reasoning-canvas"
      aria-label="How the Council reached this"
      className="reasoning-canvas"
    >
      {!heroDone && (
        <CouncilHeroReveal
          response={response}
          replayKey={heroKey}
          onDone={() => setHeroDone(true)}
        />
      )}
      {/* Header — the question opens the story (a visual headline, not a heading
          level, so it doesn't displace the page's peer h2 sections). */}
      <header className="reasoning-canvas-head" data-testid="council-verdict-card">
        <p className="section-kicker" style={{ textAlign: "center" }}>Reasoning, step by step</p>
        <p className="reasoning-question">{question}</p>
        {leader && (
          <p className="reasoning-dateline">
            Leading view —{" "}
            <span className="reasoning-dateline-strong" data-testid="council-verdict-answer">
              {leader.label}
            </span>
          </p>
        )}
        <div className="reasoning-replay-row">
          <button
            type="button"
            className="reasoning-replay"
            onClick={() => {
              setHeroDone(false);
              setHeroKey((k) => k + 1);
            }}
          >
            ✦ Replay cinematic
          </button>
          <button
            type="button"
            className="reasoning-replay"
            onClick={() => setRevealKey((k) => k + 1)}
          >
            ▷ Replay the reasoning
          </button>
        </div>
      </header>

      <div className="reasoning-timeline" data-testid="council-run-map" key={revealKey}>
        {/* 01 · Evidence gathered */}
        <Band step={1} kicker="Evidence gathered" title="What scriptures were weighed" runmapStage="retrieval" status="done">
          {evidence.length === 0 ? (
            <p className="reasoning-note">No scripture was retrieved for this question.</p>
          ) : (
            <>
              <p className="reasoning-note">
                {evidence.length} verses considered — strongest first. The dot shows each verse's role.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {evidence.slice(0, EVIDENCE_SHOWN).map((v) => {
                  const parts = verseScoreParts(v);
                  const role = roleByVerse.get(v.verse_id) ?? "used";
                  return (
                    <li key={v.verse_id}>
                      <button
                        type="button"
                        onClick={() => setFocus({ type: "verse", verseId: v.verse_id })}
                        className="evidence-chip"
                        aria-label={`${verseCitation(v)} — ${ROLE_WORD[role]}; retrieval strength ${parts.combined} of 100`}
                      >
                        <span className="evidence-chip-head">
                          <span
                            className="evidence-chip-role"
                            style={{ background: ROLE_COLOR[role] }}
                            aria-hidden="true"
                          />
                          <span className="evidence-chip-label">{verseCitation(v)}</span>
                        </span>
                        <span className="evidence-chip-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(6, parts.combined)}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {evidence.length > EVIDENCE_SHOWN && (
                <p className="reasoning-note">+{evidence.length - EVIDENCE_SHOWN} more weighed</p>
              )}
            </>
          )}
        </Band>

        {/* 02 · Voices weigh in */}
        <Band step={2} kicker="The voices weigh in" title="Each model's independent view">
          {noVoices ? (
            <p className="reasoning-note">No voice completed an analysis.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" data-testid="runmap-voices">
              {okVoices.map((v) => {
                const count = v.result?.positions?.length ?? 0;
                return (
                  <li key={v.provider}>
                    <button
                      type="button"
                      onClick={() => setFocus({ type: "voice", provider: v.provider })}
                      className="voice-chip"
                    >
                      <span
                        aria-hidden="true"
                        className="voice-chip-dot"
                        style={{ background: voiceColor(v.provider) }}
                      />
                      <span className="text-neutral-200">{v.display_name}</span>
                      <span className="reasoning-faint">
                        {count} {count === 1 ? "view" : "views"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Band>

        {/* 03 · Agreement & conflict */}
        <Band step={3} kicker="Agreement & conflict" title="Where the voices converge and clash">
          {singleVoice ? (
            <p className="reasoning-note">
              Only one voice analysed this question — there is no council to compare yet.
            </p>
          ) : (
            <>
              <p className="reasoning-note">
                Each position is a cluster — the voices that landed on it sit together; positions
                with few or lone voices are where the council clashes.
              </p>
              <div className="reasoning-clusters">
                {positions.map((p, i) => {
                  const voices = positionVoices(response, p);
                  return (
                    <div
                      key={p.label}
                      className={"reasoning-cluster" + (i === 0 ? " reasoning-cluster-leader" : "")}
                    >
                      <button
                        type="button"
                        onClick={() => setFocus({ type: "position", label: p.label })}
                        className="reasoning-cluster-head"
                      >
                        <span className="reasoning-cluster-label">{p.label}</span>
                        <span className="reasoning-faint shrink-0">
                          {voices.length} {voices.length === 1 ? "voice" : "voices"}
                        </span>
                      </button>
                      {voices.length === 0 ? (
                        <p className="reasoning-faint">Synthesis only — no voice argued this directly.</p>
                      ) : (
                        <ul className="reasoning-cluster-voices">
                          {voices.map((v) => (
                            <li key={v.provider} className="reasoning-cluster-voice">
                              <span
                                aria-hidden="true"
                                className="voice-chip-dot"
                                style={{ background: voiceColor(v.provider) }}
                              />
                              {v.display_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {(response.synthesis?.unresolved_tensions?.length ?? 0) > 0 && (
            <p className="reasoning-tension">
              <span className="reasoning-tension-mark" aria-hidden="true" /> Still contested:{" "}
              {response.synthesis!.unresolved_tensions!.join("; ")}
            </p>
          )}
        </Band>

        {/* 04 · The judge weighs */}
        <Band step={4} kicker="The judge weighs" title="How the leading view was reached">
          {positions.length === 0 ? (
            <p className="reasoning-note">No positions were recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {positions.map((p, i) => (
                <li key={p.label}>
                  <button
                    type="button"
                    onClick={() => setFocus({ type: "position", label: p.label })}
                    className={"reasoning-rank" + (i === 0 ? " reasoning-rank-leader" : "")}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="reasoning-rank-label">{p.label}</span>
                      {!noVoices && (
                        <span className="reasoning-faint shrink-0">
                          {positionVoices(response, p).length} of {okVoices.length} voices
                        </span>
                      )}
                    </div>
                    {p.summary && <p className="reasoning-rank-summary">{p.summary}</p>}
                    {i === 0 && p.weakest_link && (
                      <p className="reasoning-aside">Weakest link — {p.weakest_link}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Band>

        {/* 05 · Outcome + confidence (the climax) */}
        <Band step={5} kicker="Outcome" title={leader?.label ?? "No result"} runmapStage="verdict" status="done">
          {leader ? (
            <div className="space-y-4" data-testid="runmap-verdict">
              {leaderEvidence.support.length > 0 ? (
                <div className="reasoning-verdict">
                  Because{" "}
                  {leaderEvidence.support.slice(0, 3).map((v, i) => (
                    <span key={v.verse_id}>
                      {i > 0 ? ", " : ""}
                      <button
                        type="button"
                        onClick={() => setFocus({ type: "verse", verseId: v.verse_id })}
                        className="reasoning-cite"
                      >
                        {verseCitation(v)}
                      </button>
                    </span>
                  ))}
                  , the leading view holds.
                </div>
              ) : leader.summary ? (
                <div className="reasoning-verdict">{leader.summary}</div>
              ) : null}

              {/* Counter-evidence is visible, not buried: the support/challenge balance. */}
              {(leaderEvidence.support.length > 0 || leaderEvidence.challenge.length > 0) && (
                <p className="reasoning-balance">
                  <span className="reasoning-balance-support">
                    {leaderEvidence.support.length} supporting
                  </span>
                  {leaderEvidence.challenge.length > 0 && (
                    <>
                      {" · "}
                      <span className="reasoning-balance-challenge">
                        {leaderEvidence.challenge.length} challenging
                      </span>
                    </>
                  )}
                </p>
              )}

              {!singleVoice && (
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex items-center gap-1"
                    aria-label={`${leaderVoices.length} of ${okVoices.length} voices converge`}
                  >
                    {okVoices.map((v) => {
                      const concurs = leaderVoices.some((lv) => lv.provider === v.provider);
                      return (
                        <span
                          key={v.provider}
                          aria-hidden="true"
                          className="voice-tally"
                          style={
                            concurs
                              ? { background: voiceColor(v.provider), borderColor: "transparent" }
                              : undefined
                          }
                        />
                      );
                    })}
                  </span>
                  <span className="text-sm text-neutral-300">
                    {leaderVoices.length} of {okVoices.length} voices converge
                  </span>
                </div>
              )}

              {/* Confidence as countable pips — never a % or a threshold band. */}
              <div className="flex items-center gap-2.5">
                <span
                  className="flex items-center gap-1"
                  aria-label={`Confidence: ${confidenceWord}${confidenceLevel ? ` (${confidenceLevel} of 3)` : ""}`}
                >
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={"conf-pip" + (i <= confidenceLevel ? " conf-pip-on" : "")}
                    />
                  ))}
                </span>
                <span
                  className="text-sm text-neutral-300 capitalize"
                  data-testid="council-verdict-confidence"
                >
                  {confidenceWord} confidence
                </span>
              </div>
              {response.synthesis?.confidence_rationale &&
                response.synthesis.confidence_rationale.length <= 120 && (
                  <p className="reasoning-note">{response.synthesis.confidence_rationale}</p>
                )}
            </div>
          ) : (
            <p className="reasoning-note">The Council did not reach a result.</p>
          )}
        </Band>

        {(response.grounding ||
          response.judge ||
          response.scope ||
          response.independence ||
          response.soft_layer?.available) && (
          <Band step={6} kicker="Verification" title="How this was checked">
            <div className="reasoning-verify">
              {response.scope?.positions?.length ? (
                <p className="reasoning-note">
                  <span className="reasoning-verify-label">Scope</span> —{" "}
                  {response.scope.positions.length}{" "}
                  {response.scope.positions.length === 1 ? "position" : "positions"} considered:{" "}
                  {response.scope.positions.map((p) => p.label).join(" · ")}
                </p>
              ) : null}
              {response.grounding && (
                <p className="reasoning-note">
                  <span className="reasoning-verify-label">Grounding</span> —{" "}
                  {response.grounding.hard_fail ? (
                    <span className="reasoning-verify-warn">
                      {response.grounding.out_of_corpus_verse_ids.length} citation(s) could not be grounded in
                      the retrieved evidence
                    </span>
                  ) : (
                    <span className="reasoning-verify-ok">
                      all {response.grounding.cited_count} citations are grounded in the retrieved evidence
                    </span>
                  )}
                  {response.grounding.regen_attempts
                    ? ` (repaired in ${response.grounding.regen_attempts} pass${response.grounding.regen_attempts === 1 ? "" : "es"})`
                    : ""}
                </p>
              )}
              {response.judge?.available ? (
                <p className="reasoning-note">
                  <span className="reasoning-verify-label">Independent check</span> —{" "}
                  {response.judge.parsed ? (
                    <>
                      a different model family ({response.judge.judge_provider}) judged this{" "}
                      <span
                        className={
                          "reasoning-verify-" +
                          (response.judge.verdict === "sound"
                            ? "ok"
                            : response.judge.verdict === "unsound"
                              ? "warn"
                              : "mixed")
                        }
                      >
                        {response.judge.verdict}
                      </span>
                      {response.judge.notes ? ` — ${response.judge.notes}` : ""}
                    </>
                  ) : (
                    "the cross-family check could not be completed"
                  )}
                </p>
              ) : response.judge ? (
                <p className="reasoning-note reasoning-faint">
                  No cross-family check available — configure a second provider family for an
                  independent review.
                </p>
              ) : null}
              {response.independence?.available && (
                <p className="reasoning-note">
                  <span className="reasoning-verify-label">Independence</span> —{" "}
                  <span
                    className={
                      response.independence.correlated_count > 0
                        ? "reasoning-verify-mixed"
                        : "reasoning-verify-ok"
                    }
                  >
                    {response.independence.note}
                  </span>
                </p>
              )}
              {response.soft_layer?.available && response.soft_layer.confidence && (
                <p className="reasoning-note">
                  <span className="reasoning-verify-label">Calibrated confidence</span> —{" "}
                  {response.soft_layer.confidence.downgraded ? (
                    <>
                      model said {response.soft_layer.confidence.stated ?? "—"}, read as{" "}
                      <span className="reasoning-verify-mixed">
                        {response.soft_layer.confidence.calibrated}
                      </span>
                      {response.soft_layer.confidence.reasons.length
                        ? ` — ${response.soft_layer.confidence.reasons.join("; ")}`
                        : ""}
                    </>
                  ) : (
                    <span className="reasoning-verify-ok">
                      {response.soft_layer.confidence.calibrated} — consistent with the checks
                    </span>
                  )}
                </p>
              )}
              {response.soft_layer?.available &&
                typeof response.soft_layer.tick_passed === "number" && (
                  <p className="reasoning-note">
                    <span className="reasoning-verify-label">Integrity</span> —{" "}
                    <span
                      className={
                        response.soft_layer.tick_passed === response.soft_layer.tick_total
                          ? "reasoning-verify-ok"
                          : "reasoning-verify-mixed"
                      }
                    >
                      {response.soft_layer.tick_passed}/{response.soft_layer.tick_total} integrity
                      checks passed
                    </span>
                    {(response.soft_layer.tick ?? []).some((c) => !c.pass)
                      ? ` — needs: ${(response.soft_layer.tick ?? [])
                          .filter((c) => !c.pass)
                          .map((c) => c.label.toLowerCase())
                          .join(", ")}`
                      : ""}
                  </p>
                )}
            </div>
          </Band>
        )}
      </div>

      {focus && (
        <DrillInspector
          entity={focus}
          response={response}
          onClose={() => setFocus(null)}
          voiceColor={voiceColor}
        />
      )}
    </section>
  );
}

function ScoreBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="flex items-center gap-2 text-[0.6875rem] text-neutral-500" title={hint}>
      <span className="w-16 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 rounded-full bg-neutral-800 overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${value}%`, background: "var(--accent)" }}
        />
      </span>
      <span className="w-8 shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

function DrillInspector({
  entity,
  response,
  onClose,
  voiceColor,
}: {
  entity: ExplorerEntity;
  response: CouncilResponse;
  onClose: () => void;
  voiceColor: (provider: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [entity]);

  let title = "Detail";
  let body: React.ReactNode = null;

  if (entity.type === "verse") {
    const v = findVerse(response, entity.verseId);
    if (v) {
      const parts = verseScoreParts(v);
      const uses = versePositions(response, entity.verseId);
      title = verseCitation(v);
      body = (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-neutral-300" style={{ fontFamily: "var(--font-serif)" }}>
            {v.text}
          </p>
          <div className="space-y-1">
            <ScoreBar label="Meaning" value={parts.semantic} hint="Semantic similarity to the question" />
            <ScoreBar label="Keyword" value={parts.keyword} hint="Keyword match" />
            <ScoreBar label="Cross-ref" value={parts.xref} hint="Cross-reference link strength" />
            <ScoreBar label="Combined" value={parts.combined} hint="Combined retrieval strength" />
          </div>
          <p className="text-[0.6875rem] text-neutral-500">
            Surfaced via {v.source}
            {v.matched_terms?.length ? ` · matched: ${v.matched_terms.join(", ")}` : ""}
          </p>
          {uses.length > 0 && (
            <div className="text-xs text-neutral-400">
              Used by:{" "}
              {uses.map((u, i) => (
                <span key={u.position.label}>
                  {i > 0 ? "; " : ""}
                  {u.position.label} ({u.relation})
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
  } else if (entity.type === "voice") {
    const voice = findVoice(response, entity.provider);
    if (voice) {
      title = voice.display_name;
      const ps = voice.result?.positions ?? [];
      body = (
        <div className="space-y-2">
          <p className="text-[0.6875rem] text-neutral-500">This voice's independent positions:</p>
          {ps.length === 0 ? (
            <p className="text-sm text-neutral-500">No positions recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {ps.map((p) => (
                <li key={p.label} className="text-sm text-neutral-300">
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: voiceColor(voice.provider) }}
                  />
                  {p.label}
                  {p.summary ? <span className="text-neutral-500"> — {p.summary}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
  } else if (entity.type === "position") {
    const p = findPosition(response, entity.label);
    if (p) {
      title = p.label;
      const ev = positionEvidence(response, p);
      const voices = positionVoices(response, p);
      body = (
        <div className="space-y-3">
          {p.summary && <p className="text-sm text-neutral-300">{p.summary}</p>}
          {voices.length > 0 && (
            <p className="text-xs text-neutral-400">
              Argued by:{" "}
              {voices.map((v, i) => (
                <span key={v.provider}>
                  {i > 0 ? ", " : ""}
                  {v.display_name}
                </span>
              ))}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <span className="section-kicker" style={{ color: "var(--c-support)" }}>Supports</span>
              <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
                {ev.support.length === 0 ? <li>—</li> : ev.support.map((v) => <li key={v.verse_id}>{verseCitation(v)}</li>)}
              </ul>
            </div>
            <div>
              <span className="section-kicker" style={{ color: "var(--c-challenge)" }}>Challenges</span>
              <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
                {ev.challenge.length === 0 ? <li>—</li> : ev.challenge.map((v) => <li key={v.verse_id}>{verseCitation(v)}</li>)}
              </ul>
            </div>
          </div>
          {p.weakest_link && <p className="text-xs text-neutral-500">Weakest link: {p.weakest_link}</p>}
          {p.what_would_change_this && (
            <p className="text-xs text-neutral-500">What would change this: {p.what_would_change_this}</p>
          )}
        </div>
      );
    }
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label={`Detail: ${title}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="reasoning-drill"
      data-testid="reasoning-canvas-drill"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-neutral-100">{title}</h4>
        <button type="button" onClick={onClose} className="btn-ghost px-2 py-0.5 text-xs" aria-label="Close detail">
          Close
        </button>
      </div>
      {body ?? <p className="text-sm text-neutral-500">No detail available.</p>}
    </div>
  );
}
