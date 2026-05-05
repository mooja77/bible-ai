import { useCallback, useEffect, useState } from "react";
import {
  askCouncil,
  getCouncilSession,
  listCouncilSessions,
  type CouncilResult,
  type CouncilPosition,
  type CouncilResponse,
  type CouncilVoice,
  type CouncilProviderInfo,
  type CouncilSessionSummary,
  type AppSettings,
  type Book,
  type Translation,
  type Testament,
  type RetrievedEvidence,
} from "../../lib/bible";
import { CouncilHistory } from "./CouncilHistory";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";
import {
  buildConfidenceFactors,
  buildPositionEvidenceGroups,
  buildRetrievalTraceRows,
  buildVoiceAgreementMatrix,
  formatCouncilTransparencyMarkdown,
  formatPercent,
  type EvidenceDisplayRow,
} from "./councilTransparency";

interface Props {
  onJumpToVerse: (verseId: number, translationCode: string) => void;
  books: Book[];
  translations: Translation[];
  /** Optional preset question — when this prop becomes a non-null string,
   *  the input populates with it. Used by the reader's "Ask the Council
   *  about this verse" action. */
  presetQuestion?: string | null;
  restoredResult?: { question: string; response: CouncilResponse } | null;
  /** Called once the panel has consumed the preset so the parent can clear
   *  it (otherwise re-mounts would re-apply it). */
  onPresetConsumed?: () => void;
  onRestoredResultConsumed?: () => void;
  settings?: AppSettings;
}

export function CouncilPanel({
  onJumpToVerse,
  books,
  translations,
  presetQuestion,
  restoredResult,
  onPresetConsumed,
  onRestoredResultConsumed,
  settings,
}: Props) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<CouncilResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<CouncilSessionSummary[]>([]);
  const [strategy, setStrategy] = useState<"keyword" | "semantic" | "hybrid">("hybrid");
  const [includeCrossRefs, setIncludeCrossRefs] = useState(true);
  const [translationCode, setTranslationCode] = useState("KJV");
  const [testament, setTestament] = useState<"all" | Testament>("all");
  const [bookId, setBookId] = useState(0);
  const [evidenceLimit, setEvidenceLimit] = useState(60);
  const [selectedPositionLabel, setSelectedPositionLabel] = useState<string | null>(null);

  const refreshSessions = useCallback(() => {
    listCouncilSessions(30)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Apply a preset question handed in from the reader, then notify the parent
  // so it can clear the preset (otherwise we'd reapply it on re-render).
  useEffect(() => {
    if (presetQuestion) {
      setQuestion(presetQuestion);
      onPresetConsumed?.();
    }
  }, [presetQuestion, onPresetConsumed]);

  useEffect(() => {
    if (restoredResult) {
      setQuestion(restoredResult.question);
      setResponse(restoredResult.response);
      setError(null);
      onRestoredResultConsumed?.();
    }
  }, [onRestoredResultConsumed, restoredResult]);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const onAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setError(null);
    setResponse(null);
    setLoading(true);
    try {
      const r = await askCouncil(q, undefined, {
        strategy,
        include_cross_refs: includeCrossRefs,
        translation_code: translationCode,
        testament: testament === "all" ? null : testament,
        book_id: bookId || null,
        evidence_limit: evidenceLimit,
      });
      setResponse(r);
      refreshSessions();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const onSelectSession = async (id: number) => {
    try {
      const stored = await getCouncilSession(id);
      if (stored) {
        setQuestion(stored.question);
        setResponse(stored.response);
        setSelectedPositionLabel(null);
        setError(null);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-100">The Council</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Ask a disputed theological question. Available voices (Claude, Gemini, OpenAI)
          each analyse independently; Claude synthesises. Minority views are preserved.
        </p>
      </header>

      <div className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              onAsk();
            }
          }}
          placeholder="e.g. Should women hold leadership positions in the church?"
          rows={3}
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 resize-y"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">Ctrl/⌘+Enter to submit</p>
          <button
            type="button"
            onClick={onAsk}
            disabled={loading || !question.trim()}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-neutral-800 disabled:text-neutral-600 border border-amber-500/40 disabled:border-neutral-800 rounded text-sm text-amber-100 transition-colors"
          >
            {loading ? `Thinking… ${elapsed}s` : "Ask the Council"}
          </button>
        </div>
        <CouncilVoicePreview settings={settings} />
        <CouncilRetrievalControls
          books={books}
          translations={translations}
          strategy={strategy}
          setStrategy={setStrategy}
          includeCrossRefs={includeCrossRefs}
          setIncludeCrossRefs={setIncludeCrossRefs}
          translationCode={translationCode}
          setTranslationCode={setTranslationCode}
          testament={testament}
          setTestament={setTestament}
          bookId={bookId}
          setBookId={setBookId}
          evidenceLimit={evidenceLimit}
          setEvidenceLimit={setEvidenceLimit}
        />
      </div>

      <CouncilHistory
        sessions={sessions}
        onSelect={onSelectSession}
        onChanged={refreshSessions}
      />

      {error && (
        <div className="border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300">
          <p className="font-semibold mb-1">Error</p>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {response && (
        <>
          <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
            {response.retrieval_mode && (
              <>
                <span>Retrieval:</span>
                <span
                  className={
                    "px-2 py-0.5 rounded font-mono " +
                    (response.retrieval_mode === "semantic" ||
                    response.retrieval_mode === "hybrid" ||
                    response.retrieval_mode === "hybrid+xref" ||
                    response.retrieval_mode === "explicit+hybrid" ||
                    response.retrieval_mode === "explicit+hybrid+xref"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-neutral-800 text-neutral-300")
                  }
                >
                  {response.retrieval_mode === "explicit+hybrid+xref"
                    ? "explicit reference + hybrid + cross-refs"
                    : response.retrieval_mode === "explicit+hybrid"
                      ? "explicit reference + hybrid"
                      : response.retrieval_mode === "hybrid+xref"
                    ? "hybrid (embeddings + keyword + cross-refs)"
                    : response.retrieval_mode === "hybrid"
                      ? "hybrid (embeddings + keyword)"
                      : response.retrieval_mode === "semantic"
                        ? "semantic (embeddings)"
                        : "keyword (FTS)"}
                </span>
              </>
            )}
            {response.evidence_count !== undefined && (
              <span className="text-neutral-500">
                · {response.evidence_count} evidence verse
                {response.evidence_count === 1 ? "" : "s"}
              </span>
            )}
            <span className="ml-auto">
              <AddToWorkspaceMenu
                kind="council_result"
                title={`Council: ${question.slice(0, 60)}`}
                buttonLabel="Add to workspace"
                payload={{
                  question,
                  summary: response.synthesis.synthesis,
                  synthesis: response.synthesis.synthesis,
                  confidence: response.synthesis.confidence,
                  retrieval_mode: response.retrieval_mode,
                  evidence_count: response.evidence_count,
                  response,
                }}
              />
              <CopyAsMarkdownButton response={response} question={question} />
            </span>
          </div>
          <CouncilResultView
            result={response.synthesis}
            heading="Synthesis"
            response={response}
            selectedPositionLabel={selectedPositionLabel}
            onJumpToVerse={onJumpToVerse}
          />
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
        </>
      )}
    </div>
  );
}

function CouncilVoicePreview({ settings }: { settings?: AppSettings }) {
  const googleReady = hasSettingValue(settings?.google_api_key);
  const openAiReady = hasSettingValue(settings?.openai_api_key);
  const anthropicReady = hasSettingValue(settings?.anthropic_api_key);
  const voices = [
    {
      label: "Claude",
      state: anthropicReady ? "will run" : "will try",
      detail: anthropicReady
        ? `Anthropic API ${settings?.anthropic_model || "claude-sonnet-4-5"} handles Claude voice and synthesis.`
        : `Claude Code ${settings?.claude_model ?? "sonnet"} handles synthesis if the local login is available.`,
      active: true,
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
  return (
    <div
      className="border border-neutral-800 rounded p-3"
      data-testid="council-voice-preview"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-xs uppercase tracking-wider text-neutral-500">
          Voices before submit
        </h2>
        <span className="text-xs text-neutral-600">
          {voices.filter((voice) => voice.active).length}/{voices.length} enabled
        </span>
      </div>
      <div className="grid md:grid-cols-3 gap-2">
        {voices.map((voice) => (
          <div key={voice.label} className="border border-neutral-900 rounded px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-neutral-200">{voice.label}</span>
              <span
                className={
                  "text-[11px] px-2 py-0.5 rounded " +
                  (voice.active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-neutral-800 text-neutral-500")
                }
              >
                {voice.state}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{voice.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function hasSettingValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function CouncilRetrievalControls({
  books,
  translations,
  strategy,
  setStrategy,
  includeCrossRefs,
  setIncludeCrossRefs,
  translationCode,
  setTranslationCode,
  testament,
  setTestament,
  bookId,
  setBookId,
  evidenceLimit,
  setEvidenceLimit,
}: {
  books: Book[];
  translations: Translation[];
  strategy: "keyword" | "semantic" | "hybrid";
  setStrategy: (value: "keyword" | "semantic" | "hybrid") => void;
  includeCrossRefs: boolean;
  setIncludeCrossRefs: (value: boolean) => void;
  translationCode: string;
  setTranslationCode: (value: string) => void;
  testament: "all" | Testament;
  setTestament: (value: "all" | Testament) => void;
  bookId: number;
  setBookId: (value: number) => void;
  evidenceLimit: number;
  setEvidenceLimit: (value: number) => void;
}) {
  return (
    <div className="grid md:grid-cols-3 gap-2 border border-neutral-800 rounded p-3">
      <select
        value={strategy}
        onChange={(e) => setStrategy(e.target.value as "keyword" | "semantic" | "hybrid")}
        className="settings-input text-xs"
        aria-label="Council retrieval strategy"
      >
        <option value="hybrid">Hybrid retrieval</option>
        <option value="keyword">Keyword only</option>
        <option value="semantic">Semantic only</option>
      </select>
      <select
        value={translationCode}
        onChange={(e) => setTranslationCode(e.target.value)}
        className="settings-input text-xs"
        aria-label="Council retrieval translation"
      >
        {translations.map((t) => (
          <option key={t.code} value={t.code}>
            {t.code}
          </option>
        ))}
      </select>
      <select
        value={testament}
        onChange={(e) => setTestament(e.target.value as "all" | Testament)}
        className="settings-input text-xs"
        aria-label="Council testament filter"
      >
        <option value="all">All testaments</option>
        <option value="OT">Old Testament</option>
        <option value="NT">New Testament</option>
      </select>
      <select
        value={bookId}
        onChange={(e) => setBookId(Number(e.target.value))}
        className="settings-input text-xs"
        aria-label="Council book filter"
      >
        <option value={0}>All books</option>
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-neutral-400 px-1">
        <input
          type="checkbox"
          checked={includeCrossRefs}
          onChange={(e) => setIncludeCrossRefs(e.target.checked)}
        />
        Cross-references
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        Limit
        <input
          type="number"
          min={10}
          max={120}
          value={evidenceLimit}
          onChange={(e) => setEvidenceLimit(Number(e.target.value))}
          className="settings-input text-xs"
        />
      </label>
    </div>
  );
}

function CopyAsMarkdownButton({
  response,
  question,
}: {
  response: CouncilResponse;
  question: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const md = renderResponseAsMarkdown(response, question);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API may be unavailable in some webviews */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="px-2 py-0.5 rounded border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-300 text-xs"
    >
      {copied ? "Copied ✓" : "Copy as markdown"}
    </button>
  );
}

function renderResponseAsMarkdown(r: CouncilResponse, question: string): string {
  const lines: string[] = [];
  lines.push(`# Council: ${question}`, "");
  if (r.retrieval_mode) {
    lines.push(`*Retrieval: ${r.retrieval_mode}, ${r.evidence_count ?? "?"} evidence verses*`, "");
  }
  const synth = r.synthesis;
  lines.push(`## Synthesis (confidence: ${synth.confidence})`, "");
  const sortedPositions = [...synth.positions].sort((a, b) => b.weight - a.weight);
  for (const p of sortedPositions) {
    const pct = Math.round(p.weight * 100);
    lines.push(`### ${p.label} — ${pct}%`, "", p.summary, "");
    for (const e of p.evidence) {
      lines.push(`- **${e.citation}** (${e.translation_code}) — _"${e.quote}"_  \n  ${e.reasoning}`);
    }
    lines.push("");
  }
  if (synth.synthesis) lines.push("## Narrative synthesis", "", synth.synthesis, "");
  if (synth.unresolved_tensions?.length) {
    lines.push("## Unresolved tensions", "");
    for (const t of synth.unresolved_tensions) lines.push(`- ${t}`);
    lines.push("");
  }
  if (synth.dissent_notes) lines.push("## Dissent notes", "", synth.dissent_notes, "");
  lines.push(formatCouncilTransparencyMarkdown(r, question));
  lines.push("---", `## Voices`, "");
  for (const v of r.voices) {
    lines.push(
      `- **${v.display_name}** — ${v.status}${v.status === "ok" ? ` (${(v.duration_ms / 1000).toFixed(1)}s)` : ` — ${v.error ?? ""}`}`,
    );
  }
  return lines.join("\n");
}

function CouncilResultView({
  result,
  heading,
  response,
  selectedPositionLabel,
  onJumpToVerse,
}: {
  result: CouncilResult;
  heading: string;
  response?: CouncilResponse;
  selectedPositionLabel?: string | null;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const sorted = [...result.positions].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-6">
      <section className="border-t border-neutral-800 pt-5">
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm uppercase tracking-wider text-neutral-400">{heading}</h2>
          <ConfidenceBadge confidence={result.confidence} />
        </div>
        {response && (
          <CouncilWinnerSummary response={response} onJumpToVerse={onJumpToVerse} />
        )}
        <ul className="space-y-4">
          {sorted.map((p, i) => (
            <PositionCard
              key={i}
              position={p}
              response={response}
              highlighted={selectedPositionLabel ? labelsOverlap(p.label, selectedPositionLabel) : false}
              onJumpToVerse={onJumpToVerse}
            />
          ))}
        </ul>
      </section>

      {result.synthesis && (
        <section>
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
            Narrative synthesis
          </h3>
          <p
            className="text-neutral-200 leading-relaxed"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {result.synthesis}
          </p>
        </section>
      )}

      {result.unresolved_tensions && result.unresolved_tensions.length > 0 && (
        <section>
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
            Unresolved tensions
          </h3>
          <ul className="list-disc list-inside text-sm text-neutral-300 space-y-1">
            {result.unresolved_tensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {result.dissent_notes && (
        <section>
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
            Dissent notes
          </h3>
          <p className="text-sm text-neutral-300 leading-relaxed">{result.dissent_notes}</p>
        </section>
      )}
    </div>
  );
}

function CouncilProcessView({ response }: { response: CouncilResponse }) {
  const synthesis = response.synthesis;
  const sortedPositions = [...synthesis.positions].sort((a, b) => b.weight - a.weight);
  const leader = sortedPositions[0] ?? null;
  const runnerUp = sortedPositions[1] ?? null;
  const successfulVoices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  const availableVoices = response.manifest.filter((provider) => provider.available);
  const classificationCounts = countEvidenceClassifications(
    response.retrieved_evidence ?? [],
    synthesis,
  );
  const leaderMentions = leader ? countVoiceMentions(successfulVoices, leader.label) : 0;
  const runnerUpMentions = runnerUp ? countVoiceMentions(successfulVoices, runnerUp.label) : 0;
  const comparisonReasons = buildComparisonReasons({
    leader,
    runnerUp,
    leaderMentions,
    runnerUpMentions,
    classificationCounts,
    voiceCount: successfulVoices.length,
  });

  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-process-view"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm uppercase tracking-wider text-neutral-400">
          How the Council reached this
        </h2>
        <span className="text-xs text-neutral-500">
          {successfulVoices.length}/{availableVoices.length || response.manifest.length} voices ran
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <ProcessMetric
          label="Evidence considered"
          value={String(response.evidence_count ?? response.retrieved_evidence?.length ?? 0)}
          detail={`${classificationCounts.used} used, ${classificationCounts.conflicting} conflicting`}
        />
        <ProcessMetric
          label="Independent voices"
          value={String(successfulVoices.length)}
          detail="Each available voice judged the same evidence before synthesis."
        />
        <ProcessMetric
          label="Preserved positions"
          value={String(sortedPositions.length)}
          detail="Lower-weighted views remain visible instead of being erased."
        />
      </div>

      <ol className="grid md:grid-cols-4 gap-2 mb-4">
        <ProcessStep
          number="1"
          title="Retrieve evidence"
          body="The app gathers candidate passages using the selected retrieval settings."
        />
        <ProcessStep
          number="2"
          title="Separate analysis"
          body="Each configured voice weighs defensible positions without seeing the other voices first."
        />
        <ProcessStep
          number="3"
          title="Cluster arguments"
          body="The synthesis groups equivalent positions, preserves dissent, and normalizes weights."
        />
        <ProcessStep
          number="4"
          title="Expose the audit"
          body="Citations, conflicting evidence, voice output, and unresolved tensions remain inspectable."
        />
      </ol>

      {leader && (
        <div className="border border-neutral-800 rounded p-4">
          <h3 className="text-sm font-semibold text-neutral-100 mb-2">
            Why this argument ranked higher
          </h3>
          <ArgumentComparison
            leader={leader}
            runnerUp={runnerUp}
            leaderMentions={leaderMentions}
            runnerUpMentions={runnerUpMentions}
            voiceCount={successfulVoices.length}
          />
          <ul className="mt-3 space-y-1 text-xs text-neutral-400">
            {comparisonReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProcessMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-neutral-800 rounded px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-lg font-semibold text-neutral-100">{value}</div>
      <p className="text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function ProcessStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li className="border border-neutral-800 rounded px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="grid place-items-center w-5 h-5 rounded-full bg-neutral-800 text-[11px] text-neutral-300">
          {number}
        </span>
        <span className="text-sm font-medium text-neutral-200">{title}</span>
      </div>
      <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
    </li>
  );
}

function ArgumentComparison({
  leader,
  runnerUp,
  leaderMentions,
  runnerUpMentions,
  voiceCount,
}: {
  leader: CouncilPosition;
  runnerUp: CouncilPosition | null;
  leaderMentions: number;
  runnerUpMentions: number;
  voiceCount: number;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <ArgumentSnapshot
        title="Leading argument"
        position={leader}
        mentions={leaderMentions}
        voiceCount={voiceCount}
      />
      {runnerUp ? (
        <ArgumentSnapshot
          title="Nearest alternative"
          position={runnerUp}
          mentions={runnerUpMentions}
          voiceCount={voiceCount}
        />
      ) : (
        <div className="border border-neutral-900 rounded px-3 py-2 text-sm text-neutral-500">
          No separate runner-up position was returned for this question.
        </div>
      )}
    </div>
  );
}

function ArgumentSnapshot({
  title,
  position,
  mentions,
  voiceCount,
}: {
  title: string;
  position: CouncilPosition;
  mentions: number;
  voiceCount: number;
}) {
  const pct = Math.round(position.weight * 100);
  return (
    <div className="border border-neutral-900 rounded px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{title}</div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-100">{position.label}</span>
        <span className="font-mono text-sm text-amber-300">{pct}%</span>
      </div>
      <p className="text-xs text-neutral-500 mt-1">
        {position.evidence.length} cited passage{position.evidence.length === 1 ? "" : "s"};{" "}
        {mentions}/{voiceCount || 1} voice{voiceCount === 1 ? "" : "s"} named a matching view.
      </p>
    </div>
  );
}

function countEvidenceClassifications(evidence: RetrievedEvidence[], synthesis: CouncilResult) {
  const usedVerseIds = new Set(
    synthesis.positions.flatMap((position) =>
      position.evidence.map((entry) => entry.verse_id),
    ),
  );
  const counts = { used: 0, supporting: 0, conflicting: 0, ignored: 0 };
  const classifications = synthesis.evidence_classification ?? [];

  if (classifications.length === 0) {
    for (const item of evidence) {
      if (usedVerseIds.has(item.verse_id)) counts.used += 1;
      else counts.ignored += 1;
    }
    return counts;
  }

  for (const entry of classifications) {
    counts[entry.status] += 1;
  }
  return counts;
}

function countVoiceMentions(voices: CouncilVoice[], label: string) {
  return voices.filter((voice) =>
    voice.result?.positions.some((position) => labelsOverlap(position.label, label)),
  ).length;
}

function labelsOverlap(a: string, b: string) {
  const first = normalizeLabel(a);
  const second = normalizeLabel(b);
  return first === second || first.includes(second) || second.includes(first);
}

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildComparisonReasons({
  leader,
  runnerUp,
  leaderMentions,
  runnerUpMentions,
  classificationCounts,
  voiceCount,
}: {
  leader: CouncilPosition | null;
  runnerUp: CouncilPosition | null;
  leaderMentions: number;
  runnerUpMentions: number;
  classificationCounts: Record<"used" | "supporting" | "conflicting" | "ignored", number>;
  voiceCount: number;
}) {
  if (!leader) return [];
  const reasons = [
    `The synthesis assigned "${leader.label}" the largest final weight after clustering the voices.`,
  ];
  if (runnerUp) {
    const gap = Math.round((leader.weight - runnerUp.weight) * 100);
    reasons.push(
      `It leads "${runnerUp.label}" by ${gap} percentage point${gap === 1 ? "" : "s"}.`,
    );
  }
  if (leaderMentions > runnerUpMentions) {
    reasons.push(
      `More independent voices named a matching view: ${leaderMentions}/${voiceCount || 1} versus ${runnerUpMentions}/${voiceCount || 1}.`,
    );
  }
  if (leader.evidence.length > (runnerUp?.evidence.length ?? 0)) {
    reasons.push("It carries more cited passages in the final synthesis than the nearest alternative.");
  }
  if (classificationCounts.conflicting > 0) {
    reasons.push(
      `${classificationCounts.conflicting} retrieved passage${classificationCounts.conflicting === 1 ? "" : "s"} remained visible as conflicting evidence, so the ranking is not hiding objections.`,
    );
  }
  return reasons;
}

function ConfidenceBadge({ confidence }: { confidence: "low" | "medium" | "high" }) {
  return (
    <span
      className={
        "text-xs px-2 py-0.5 rounded " +
        (confidence === "high"
          ? "bg-emerald-500/20 text-emerald-200"
          : confidence === "medium"
            ? "bg-amber-500/20 text-amber-200"
            : "bg-neutral-700/40 text-neutral-400")
      }
    >
      confidence: {confidence}
    </span>
  );
}

function CouncilWinnerSummary({
  response,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const sorted = [...response.synthesis.positions].sort((a, b) => b.weight - a.weight);
  const leader = sorted[0];
  const runnerUp = sorted[1] ?? null;
  if (!leader) return null;

  const groups = buildPositionEvidenceGroups(leader, response);
  const successfulVoices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  const leaderMentions = countVoiceMentions(successfulVoices, leader.label);
  const gap = runnerUp ? leader.weight - runnerUp.weight : leader.weight;
  const primaryEvidence = leader.evidence[0];

  return (
    <div
      className="border border-amber-500/30 bg-amber-500/[0.06] rounded p-4 mb-4"
      data-testid="council-winner-summary"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">
            Why this ranked highest
          </div>
          <h3 className="text-base font-semibold text-neutral-100">{leader.label}</h3>
        </div>
        <span className="font-mono text-sm text-amber-200">
          {formatPercent(leader.weight)}
        </span>
      </div>
      <div className="grid md:grid-cols-4 gap-2 text-xs">
        <WinnerMetric
          label="Lead"
          value={runnerUp ? formatPercent(gap) : "Only view"}
          detail={runnerUp ? `over ${runnerUp.label}` : "No runner-up was returned"}
        />
        <WinnerMetric
          label="Voice support"
          value={`${leaderMentions}/${successfulVoices.length || 1}`}
          detail="independent voices named a matching view"
        />
        <WinnerMetric
          label="Evidence"
          value={`${groups.cited.length + groups.supporting.length}`}
          detail={`${groups.challenging.length} challenge${groups.challenging.length === 1 ? "" : "s"} kept visible`}
        />
        <WinnerMetric
          label="Confidence"
          value={response.synthesis.confidence}
          detail={response.synthesis.confidence_rationale ?? "See rationale below"}
        />
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mt-3">{leader.summary}</p>
      {primaryEvidence && (
        <button
          type="button"
          onClick={() =>
            onJumpToVerse(primaryEvidence.verse_id, primaryEvidence.translation_code)
          }
          className="mt-3 text-xs text-amber-300 hover:text-amber-200 hover:underline font-mono"
        >
          Inspect leading citation: {primaryEvidence.citation}
        </button>
      )}
    </div>
  );
}

function WinnerMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-neutral-800 rounded px-3 py-2 bg-neutral-950/50">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-100">{value}</div>
      <p className="text-[11px] text-neutral-500 line-clamp-2">{detail}</p>
    </div>
  );
}

function CouncilPositionComparison({
  response,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const sorted = [...response.synthesis.positions].sort((a, b) => b.weight - a.weight);
  const [leftLabel, setLeftLabel] = useState(sorted[0]?.label ?? "");
  const [rightLabel, setRightLabel] = useState(sorted[1]?.label ?? sorted[0]?.label ?? "");
  if (sorted.length < 2) return null;

  const left = sorted.find((position) => position.label === leftLabel) ?? sorted[0];
  const right =
    sorted.find((position) => position.label === rightLabel && position.label !== left.label) ??
    sorted.find((position) => position.label !== left.label) ??
    sorted[1];
  const successfulVoices = response.voices.filter((voice) => voice.status === "ok" && voice.result);

  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-position-comparison"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-neutral-400">
            Compare Positions
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Put two arguments beside each other to inspect weight, voice support, evidence,
            objections, and stated limits.
          </p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <PositionSelect
          label="First position"
          value={left.label}
          positions={sorted}
          onChange={setLeftLabel}
        />
        <PositionSelect
          label="Second position"
          value={right.label}
          positions={sorted.filter((position) => position.label !== left.label)}
          onChange={setRightLabel}
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <PositionComparisonCard
          position={left}
          response={response}
          voices={successfulVoices}
          onJumpToVerse={onJumpToVerse}
        />
        <PositionComparisonCard
          position={right}
          response={response}
          voices={successfulVoices}
          onJumpToVerse={onJumpToVerse}
        />
      </div>
    </section>
  );
}

function PositionSelect({
  label,
  value,
  positions,
  onChange,
}: {
  label: string;
  value: string;
  positions: CouncilPosition[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-neutral-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-100"
      >
        {positions.map((position) => (
          <option key={position.label} value={position.label}>
            {position.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PositionComparisonCard({
  position,
  response,
  voices,
  onJumpToVerse,
}: {
  position: CouncilPosition;
  response: CouncilResponse;
  voices: CouncilVoice[];
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const groups = buildPositionEvidenceGroups(position, response);
  const mentions = countVoiceMentions(voices, position.label);
  const firstEvidence = groups.cited[0] ?? groups.supporting[0] ?? groups.challenging[0];

  return (
    <article className="border border-neutral-800 rounded p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-neutral-100">{position.label}</h3>
        <span className="font-mono text-sm text-amber-300">
          {formatPercent(position.weight)}
        </span>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">{position.summary}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs mb-3">
        <ComparisonFact label="Voice support" value={`${mentions}/${voices.length || 1}`} />
        <ComparisonFact label="Cited" value={String(groups.cited.length)} />
        <ComparisonFact label="Supporting" value={String(groups.supporting.length)} />
        <ComparisonFact label="Challenging" value={String(groups.challenging.length)} />
      </dl>
      {position.confidence_rationale && (
        <p className="text-xs text-neutral-500 mb-2">
          Confidence: {position.confidence_rationale}
        </p>
      )}
      {position.why_not_higher && (
        <p className="text-xs text-neutral-500 mb-2">
          Limit: {position.why_not_higher}
        </p>
      )}
      {firstEvidence && (
        <button
          type="button"
          onClick={() => onJumpToVerse(firstEvidence.verse_id, firstEvidence.translation_code)}
          className="text-xs text-amber-300 hover:text-amber-200 hover:underline font-mono"
        >
          Inspect {firstEvidence.citation}
        </button>
      )}
    </article>
  );
}

function ComparisonFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-900 rounded px-2 py-1.5">
      <dt className="text-[11px] uppercase tracking-wide text-neutral-600">{label}</dt>
      <dd className="text-sm text-neutral-200">{value}</dd>
    </div>
  );
}

function PositionCard({
  position,
  response,
  highlighted = false,
  onJumpToVerse,
}: {
  position: CouncilPosition;
  response?: CouncilResponse;
  highlighted?: boolean;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const pct = Math.round(position.weight * 100);
  const evidenceTermsByVerse = response ? buildEvidenceTermsByVerse(response) : new Map();
  return (
    <li
      className={
        "border rounded p-4 transition-colors " +
        (highlighted
          ? "border-amber-500/50 bg-amber-500/[0.06]"
          : "border-neutral-800")
      }
      data-testid={highlighted ? "council-focused-position" : undefined}
    >
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-neutral-100">{position.label}</h3>
        <span className="text-sm font-mono text-amber-300">{pct}%</span>
      </header>
      <div className="w-full bg-neutral-900 rounded-full h-1.5 mb-3 overflow-hidden">
        <div className="h-full bg-amber-500/60" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">{position.summary}</p>
      {position.why_not_higher && (
        <p className="text-xs text-neutral-500 border-l border-neutral-800 pl-3 mb-3">
          Why not higher: {position.why_not_higher}
        </p>
      )}
      {position.evidence.length > 0 && (
        <ul className="space-y-2 border-t border-neutral-800 pt-3">
          {position.evidence.map((e, i) => (
            <li key={i} className="text-sm">
              <button
                type="button"
                onClick={() => onJumpToVerse(e.verse_id, e.translation_code)}
                className="text-amber-300 hover:text-amber-200 hover:underline font-mono text-xs"
              >
                {e.citation} ({e.translation_code})
              </button>
              <span
                className="text-neutral-300 italic ml-2"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                "
                <HighlightedText
                  text={e.quote}
                  terms={evidenceTermsByVerse.get(e.verse_id) ?? []}
                />
                "
              </span>
              <p className="text-xs text-neutral-500 mt-0.5">{e.reasoning}</p>
            </li>
          ))}
        </ul>
      )}
      {response && (
        <CouncilEvidenceTabs
          position={position}
          response={response}
          onJumpToVerse={onJumpToVerse}
        />
      )}
    </li>
  );
}

function CouncilEvidenceTabs({
  position,
  response,
  onJumpToVerse,
}: {
  position: CouncilPosition;
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<keyof ReturnType<typeof buildPositionEvidenceGroups>>("cited");
  const groups = buildPositionEvidenceGroups(position, response);
  const rows = groups[activeTab];
  const tabs: Array<[keyof typeof groups, string]> = [
    ["cited", "Cited"],
    ["supporting", "Supporting"],
    ["challenging", "Challenging"],
    ["ignored", "Ignored"],
  ];

  return (
    <div className="border-t border-neutral-800 mt-3 pt-3" data-testid="council-evidence-tabs">
      <div className="flex flex-wrap gap-1 mb-3">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={
              "px-2 py-1 rounded border text-xs " +
              (activeTab === key
                ? "border-amber-500/50 bg-amber-500/15 text-amber-100"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-700")
            }
          >
            {label} ({groups[key].length})
          </button>
        ))}
      </div>
      {activeTab === "challenging" && (
        <p className="text-xs text-neutral-500 mb-2">
          These passages complicate or limit the argument. They do not automatically disprove it.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-500">
          {activeTab === "challenging"
            ? "No challenging evidence was identified for this position."
            : activeTab === "supporting"
              ? "No additional supporting passages were classified beyond the cited evidence."
              : `No ${activeTab} evidence is available for this saved result.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <EvidenceDisplayItem
              key={`${activeTab}-${row.verse_id}-${row.source}`}
              row={row}
              onJumpToVerse={onJumpToVerse}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceDisplayItem({
  row,
  onJumpToVerse,
}: {
  row: EvidenceDisplayRow;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  return (
    <li className="border border-neutral-900 rounded px-3 py-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <button
          type="button"
          onClick={() => onJumpToVerse(row.verse_id, row.translation_code)}
          className="font-mono text-xs text-amber-300 hover:text-amber-200"
        >
          {row.citation} ({row.translation_code})
        </button>
        <span
          className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400"
          title={sourceTooltip(row.source)}
        >
          {sourceDisplay(row.source)}
        </span>
        <span
          className={"text-[10px] px-1.5 py-0.5 rounded " + evidenceStatusClass(row.status)}
          title={evidenceStatusTooltip(row.status)}
        >
          {evidenceStatusLabel(row.status)}
        </span>
      </div>
      <p
        className="text-neutral-300 leading-relaxed"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <HighlightedText text={row.text} terms={row.matched_terms} />
      </p>
      {row.reasoning && <p className="text-xs text-neutral-500 mt-1">{row.reasoning}</p>}
      {row.matched_terms.length > 0 && (
        <p className="text-[11px] text-neutral-600 mt-1">
          Matched terms: {row.matched_terms.join(", ")}
        </p>
      )}
    </li>
  );
}

function CouncilVoiceMatrix({
  response,
  selectedPositionLabel,
  onSelectPosition,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  selectedPositionLabel: string | null;
  onSelectPosition: (label: string) => void;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [selected, setSelected] = useState<{
    row: string;
    cell: number;
    position: CouncilPosition;
  } | null>(null);
  const rows = buildVoiceAgreementMatrix(response);
  const voices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  if (rows.length === 0) return null;

  return (
    <section className="border-t border-neutral-800 pt-5" data-testid="council-voice-matrix">
      <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
        Voice Agreement Matrix
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        This compares the final synthesis against each independent voice. A blank cell means
        that voice did not name a matching position.
      </p>
      <div className="overflow-x-auto border border-neutral-800 rounded">
        <table className="w-full text-xs min-w-[520px]">
          <thead className="bg-neutral-900 text-neutral-500">
            <tr>
              <th className="text-left font-medium px-2 py-2">Position</th>
              <th className="text-right font-medium px-2 py-2">Final</th>
              {voices.map((voice) => (
                <th key={voice.provider} className="text-right font-medium px-2 py-2">
                  {voice.display_name}
                </th>
              ))}
              <th className="text-right font-medium px-2 py-2">Disagreement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isFocused = selectedPositionLabel
                ? labelsOverlap(row.position.label, selectedPositionLabel)
                : false;
              return (
              <tr
                key={row.position.label}
                onClick={() => onSelectPosition(row.position.label)}
                className={
                  "border-t border-neutral-800 cursor-pointer " +
                  (isFocused ? "bg-amber-500/[0.07]" : "hover:bg-neutral-900/50")
                }
              >
                <td className="px-2 py-2 text-neutral-200">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectPosition(row.position.label);
                    }}
                    className="text-left hover:text-amber-200"
                    title="Focus this position in the synthesis cards"
                  >
                    {row.position.label}
                  </button>
                </td>
                <td className="px-2 py-2 text-right font-mono text-amber-300">
                  {formatPercent(row.final_weight)}
                </td>
                {row.cells.map((cell, index) => (
                  <td key={cell.voice.provider} className="px-1 py-1 text-right">
                    {cell.position ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectPosition(row.position.label);
                          setSelected({
                            row: row.position.label,
                            cell: index,
                            position: cell.position as CouncilPosition,
                          });
                        }}
                        className="w-full rounded px-2 py-1 font-mono text-emerald-100"
                        title={`Inspect ${cell.voice.display_name}'s matching position`}
                        style={{
                          backgroundColor: `rgba(16, 185, 129, ${0.12 + (cell.weight ?? 0) * 0.35})`,
                        }}
                      >
                        {formatPercent(cell.weight ?? 0)}
                      </button>
                    ) : (
                      <span className="text-neutral-700">-</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-mono text-neutral-400">
                  {formatPercent(row.disagreement)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedPositionLabel && (
        <p
          className="text-xs text-amber-200 mt-2"
          data-testid="council-matrix-focus"
        >
          Focused position: {selectedPositionLabel}. The matching synthesis card is highlighted above.
        </p>
      )}
      {response.voices.some((voice) => voice.status !== "ok") && (
        <p className="text-xs text-neutral-500 mt-2">
          Failed or skipped voices remain visible in the audit trail below.
        </p>
      )}
      {selected && (
        <div className="border border-neutral-800 rounded p-3 mt-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Provider cell detail
          </div>
          <h3 className="text-sm font-semibold text-neutral-100">{selected.position.label}</h3>
          <p className="text-sm text-neutral-300 mt-1">{selected.position.summary}</p>
          {selected.position.evidence.length > 0 && (
            <ul className="space-y-1 mt-2">
              {selected.position.evidence.map((evidence) => (
                <li key={`${selected.row}-${selected.cell}-${evidence.verse_id}`} className="text-xs">
                  <button
                    type="button"
                    onClick={() => onJumpToVerse(evidence.verse_id, evidence.translation_code)}
                    className="text-amber-300 hover:text-amber-200 font-mono"
                  >
                    {evidence.citation}
                  </button>{" "}
                  <span className="text-neutral-500">{evidence.reasoning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function CouncilRetrievalTrace({
  response,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const rows = buildRetrievalTraceRows(response);
  const citationByVerse = buildRetrievedCitationByVerse(response);
  if (rows.length === 0) return null;
  return (
    <section className="border-t border-neutral-800 pt-5" data-testid="council-retrieval-trace">
      <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
        Retrieval Trace
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Retrieval finds candidate passages. The Council still decides whether each passage is
        used, supporting, conflicting, or ignored.
      </p>
      <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {rows.slice(0, 20).map((row) => (
          <li key={`trace-${row.verse_id}-${row.source}`} className="border border-neutral-800 rounded px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button
                type="button"
                onClick={() => onJumpToVerse(row.verse_id, row.translation_code)}
                className="font-mono text-xs text-amber-300 hover:text-amber-200"
              >
                {row.citation} ({row.translation_code})
              </button>
              <span
                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400"
                title={sourceTooltip(row.source)}
              >
                {row.source_label}
              </span>
              <span
                className={"text-[10px] px-1.5 py-0.5 rounded " + evidenceStatusClass(row.status)}
                title={evidenceStatusTooltip(row.status)}
              >
                {row.status}
              </span>
            </div>
            <RetrievalScoreBar row={row} />
            {row.from_verse_id && (
              <p className="text-[11px] text-neutral-600 mt-1">
                Cross-reference from {citationByVerse.get(row.from_verse_id) ?? `verse id ${row.from_verse_id}`}
              </p>
            )}
            <p
              className="text-xs text-neutral-400 mt-1 leading-relaxed"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              <HighlightedText text={row.text} terms={row.matched_terms} />
            </p>
            {row.matched_terms.length > 0 && (
              <p className="text-[11px] text-neutral-600 mt-1">
                Matched terms: {row.matched_terms.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RetrievalScoreBar({ row }: { row: EvidenceDisplayRow }) {
  const semantic = Math.max(0, Math.min(1, row.semantic_score ?? 0));
  const keyword = Math.max(0, Math.min(1, row.keyword_score ?? 0));
  const crossRef = Math.max(0, Math.min(1, row.cross_reference_weight ?? 0));
  const total = semantic + keyword + crossRef;
  if (total <= 0) return null;
  return (
    <div className="h-1.5 w-full rounded bg-neutral-900 overflow-hidden flex" title="Retrieval contribution">
      {keyword > 0 && <div className="bg-sky-500/70" style={{ width: `${(keyword / total) * 100}%` }} />}
      {semantic > 0 && <div className="bg-emerald-500/70" style={{ width: `${(semantic / total) * 100}%` }} />}
      {crossRef > 0 && <div className="bg-amber-500/70" style={{ width: `${(crossRef / total) * 100}%` }} />}
    </div>
  );
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  const chunks = splitHighlightedText(text, terms);
  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.highlight ? (
          <mark key={`${chunk.text}-${index}`}>{chunk.text}</mark>
        ) : (
          <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
        ),
      )}
    </>
  );
}

function splitHighlightedText(text: string, terms: string[]) {
  const usefulTerms = normalizedHighlightTerms(text, terms);
  if (usefulTerms.length === 0) return [{ text, highlight: false }];
  const pattern = new RegExp(`(${usefulTerms.map(escapeRegExp).join("|")})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlight: usefulTerms.some((term) => part.toLowerCase() === term.toLowerCase()),
    }));
}

function normalizedHighlightTerms(text: string, terms: string[]) {
  const lowerText = text.toLowerCase();
  const seen = new Set<string>();
  return terms
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
    .filter((term) => !COMMON_QUERY_WORDS.has(term.toLowerCase()))
    .filter((term) => lowerText.includes(term.toLowerCase()))
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
}

function buildEvidenceTermsByVerse(response: CouncilResponse) {
  const termsByVerse = new Map<number, string[]>();
  for (const evidence of response.retrieved_evidence ?? []) {
    if (evidence.matched_terms && evidence.matched_terms.length > 0) {
      termsByVerse.set(evidence.verse_id, evidence.matched_terms);
    }
  }
  return termsByVerse;
}

function buildRetrievedCitationByVerse(response: CouncilResponse) {
  const citationByVerse = new Map<number, string>();
  for (const evidence of response.retrieved_evidence ?? []) {
    citationByVerse.set(
      evidence.verse_id,
      `${evidence.book_name} ${evidence.chapter}:${evidence.verse}`,
    );
  }
  return citationByVerse;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMMON_QUERY_WORDS = new Set([
  "the",
  "and",
  "for",
  "what",
  "does",
  "with",
  "that",
  "this",
  "from",
  "about",
  "into",
  "unto",
  "shall",
]);

function CouncilConfidenceRationale({ response }: { response: CouncilResponse }) {
  const factors = buildConfidenceFactors(response);
  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-confidence-rationale"
    >
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm uppercase tracking-wider text-neutral-400">
          Confidence Rationale
        </h2>
        <ConfidenceBadge confidence={factors.level} />
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">
        Confidence is {factors.level} because {factors.rationale}
      </p>
      <ul className="grid md:grid-cols-2 gap-2 text-xs text-neutral-500">
        <li className="border border-neutral-800 rounded px-3 py-2">
          Evidence coverage: {factors.evidence_coverage}
        </li>
        <li className="border border-neutral-800 rounded px-3 py-2">
          Voice agreement: {factors.voice_agreement}
        </li>
        <li className="border border-neutral-800 rounded px-3 py-2">
          Conflicting evidence: {factors.conflicting_count}
        </li>
        <li className="border border-neutral-800 rounded px-3 py-2">
          Provider failures: {factors.provider_failures.length}
        </li>
      </ul>
      {factors.unresolved_tensions.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Unresolved tensions
          </h3>
          <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
            {factors.unresolved_tensions.map((tension) => (
              <li key={tension}>{tension}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CouncilSourceDrawer({ response }: { response: CouncilResponse }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("response");
  const [copied, setCopied] = useState<"tab" | "full" | null>(null);
  const tabs = [
    ["response", "Response JSON", response],
    ["synthesis", "Synthesis", response.synthesis],
    ["voices", "Provider voices", response.voices],
    ["retrieval", "Retrieval options", response.retrieval_options ?? {}],
    ["evidence", "Retrieved evidence", response.retrieved_evidence ?? []],
    ["manifest", "Provider manifest", response.manifest],
  ] as const;
  const current = tabs.find(([key]) => key === active) ?? tabs[0];
  const json = JSON.stringify(current[2], null, 2);
  const fullJson = JSON.stringify(response, null, 2);

  const onCopy = async (value: string, scope: "tab" | "full") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(scope);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard API may be unavailable */
    }
  };

  return (
    <section className="border-t border-neutral-800 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-neutral-400">
            Source Data
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Structured data stored for audit, debugging, and export verification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="px-2 py-1 rounded border border-neutral-800 text-xs text-neutral-300 hover:border-neutral-700"
        >
          {open ? "Hide source data" : "View source data"}
        </button>
      </div>
      {open && (
        <div
          className="border border-neutral-800 rounded mt-3 overflow-hidden"
          data-testid="council-source-drawer"
        >
          <div className="flex items-center gap-1 flex-wrap p-2 border-b border-neutral-800 bg-neutral-950">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={
                  "px-2 py-1 rounded text-xs " +
                  (active === key
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300")
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onCopy(json, "tab")}
              className="ml-auto px-2 py-1 rounded border border-neutral-800 text-xs text-neutral-300"
            >
              {copied === "tab" ? "Copied tab" : "Copy tab"}
            </button>
            <button
              type="button"
              onClick={() => onCopy(fullJson, "full")}
              className="px-2 py-1 rounded border border-neutral-800 text-xs text-neutral-300"
            >
              {copied === "full" ? "Copied full JSON" : "Copy full JSON"}
            </button>
          </div>
          <pre
            className="max-h-96 overflow-auto p-3 text-xs text-neutral-300 whitespace-pre-wrap"
            data-testid="council-source-json"
          >
            {json}
          </pre>
        </div>
      )}
    </section>
  );
}

function VoicesAuditTrail({
  voices,
  manifest,
  onJumpToVerse,
}: {
  voices: CouncilVoice[];
  manifest: CouncilProviderInfo[];
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  // Merge: one row per manifest entry. If the provider ran, attach its voice data.
  const rows = manifest.map((m) => {
    const voice = voices.find((v) => v.provider === m.name);
    return { manifest: m, voice };
  });

  return (
    <section className="border-t border-neutral-800 pt-5">
      <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-3">
        Voices (audit trail)
      </h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <VoiceRow
            key={r.manifest.name}
            manifest={r.manifest}
            voice={r.voice}
            onJumpToVerse={onJumpToVerse}
          />
        ))}
      </ul>
    </section>
  );
}

function CouncilEvidenceAudit({
  evidence,
  synthesis,
  onJumpToVerse,
}: {
  evidence: RetrievedEvidence[];
  synthesis: CouncilResult;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const used = new Set(
    synthesis.positions.flatMap((p) => p.evidence.map((e) => e.verse_id)),
  );
  const classifications = new Map(
    (synthesis.evidence_classification ?? []).map((entry) => [entry.verse_id, entry]),
  );
  if (evidence.length === 0) return null;
  return (
    <section className="border-t border-neutral-800 pt-5">
      <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-3">
        Retrieved Evidence
      </h2>
      <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {evidence.map((e) => {
          const classified = classifications.get(e.verse_id);
          const status = classified?.status ?? (used.has(e.verse_id) ? "used" : "ignored");
          return (
            <li
              key={`${e.source}-${e.translation_code}-${e.verse_id}`}
              className="border border-neutral-800 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => onJumpToVerse(e.verse_id, e.translation_code)}
                  className="font-mono text-xs text-amber-300 hover:text-amber-200"
                >
                  {e.book_name} {e.chapter}:{e.verse} ({e.translation_code})
                </button>
                <span
                  className="text-[10px] uppercase tracking-wide text-neutral-500"
                  title={sourceTooltip(e.source)}
                >
                  {sourceDisplay(e.source)}
                </span>
                <span
                  className={
                    "ml-auto text-[10px] px-1.5 py-0.5 rounded " +
                    evidenceStatusClass(status)
                  }
                  title={evidenceStatusTooltip(status)}
                >
                  {evidenceStatusLabel(status)}
                </span>
              </div>
              <p
                className="text-sm text-neutral-300 leading-relaxed"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {e.text}
              </p>
              {classified?.reasoning && (
                <p className="text-xs text-neutral-500 mt-1">{classified.reasoning}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function evidenceStatusLabel(status: "used" | "supporting" | "conflicting" | "ignored") {
  if (status === "used") return "used";
  if (status === "supporting") return "supporting";
  if (status === "conflicting") return "conflicting";
  return "ignored";
}

function evidenceStatusClass(status: "used" | "supporting" | "conflicting" | "ignored") {
  if (status === "used") return "bg-emerald-500/15 text-emerald-300";
  if (status === "supporting") return "bg-sky-500/15 text-sky-300";
  if (status === "conflicting") return "bg-amber-500/15 text-amber-300";
  return "bg-neutral-800 text-neutral-500";
}

function evidenceStatusTooltip(status: "used" | "supporting" | "conflicting" | "ignored") {
  if (status === "used") return "Used directly in a final Council position.";
  if (status === "supporting") return "Supports at least one position but was not a primary citation.";
  if (status === "conflicting") return "Complicates or limits at least one position.";
  return "Retrieved as candidate evidence but not used in the final argument.";
}

function sourceDisplay(source: string) {
  if (source === "explicit-reference") return "explicit reference";
  if (source === "fts") return "keyword";
  if (source === "cross-ref") return "cross-ref";
  return source || "retrieved";
}

function sourceTooltip(source: string) {
  if (source === "explicit-reference") return "Retrieved because the question named this passage directly.";
  if (source === "fts") return "Retrieved by keyword/full-text search.";
  if (source === "semantic") return "Retrieved by semantic similarity.";
  if (source === "cross-ref") return "Retrieved from cross-reference links.";
  if (source === "selected-range") return "Included from the selected passage range.";
  if (source === "cited") return "Cited directly by a Council position.";
  return "Retrieved candidate evidence.";
}

function VoiceRow({
  manifest,
  voice,
  onJumpToVerse,
}: {
  manifest: CouncilProviderInfo;
  voice?: CouncilVoice;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!manifest.available) {
    return (
      <li className="border border-neutral-900 rounded px-3 py-2 text-sm text-neutral-600">
        <span className="font-mono text-xs mr-2">{manifest.name}</span>
        {manifest.display_name} — no key configured
      </li>
    );
  }

  if (!voice) {
    return (
      <li className="border border-neutral-900 rounded px-3 py-2 text-sm text-neutral-500">
        <span className="font-mono text-xs mr-2">{manifest.name}</span>
        {manifest.display_name} — available but did not run
      </li>
    );
  }

  const isError = voice.status === "error";
  const canExpand = voice.status === "ok" && voice.result;

  return (
    <li className="border border-neutral-800 rounded">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((x) => !x)}
        disabled={!canExpand}
        className={
          "w-full flex items-center justify-between px-3 py-2 text-sm " +
          (canExpand ? "hover:bg-neutral-900/60 cursor-pointer" : "cursor-default")
        }
      >
        <div className="flex items-center gap-2">
          <span
            className={
              "font-mono text-xs w-16 text-left " +
              (isError ? "text-red-400" : "text-emerald-400")
            }
          >
            {isError ? "✗ error" : "✓ ok"}
          </span>
          <span className="text-neutral-100">{voice.display_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {(voice.duration_ms / 1000).toFixed(1)}s
          </span>
          {canExpand && (
            <span className="text-neutral-500 text-xs">{expanded ? "▾" : "▸"}</span>
          )}
        </div>
      </button>
      {isError && (
        <div className="px-3 py-2 border-t border-neutral-800 text-xs text-red-300">
          {voice.error}
        </div>
      )}
      {expanded && voice.result && (
        <div className="border-t border-neutral-800 p-4">
          <CouncilResultView
            result={voice.result}
            heading={`${voice.display_name} — independent analysis`}
            onJumpToVerse={onJumpToVerse}
          />
        </div>
      )}
    </li>
  );
}
