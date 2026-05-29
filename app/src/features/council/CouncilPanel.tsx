import { useCallback, useEffect, useRef, useState } from "react";
import {
  askCouncil,
  getCouncilSession,
  listCouncilSessions,
  upsertCouncilJudgment,
  type ArgumentAnnotation,
  type CouncilResult,
  type CouncilPosition,
  type CouncilJudgment,
  type CouncilResponse,
  type CouncilVoice,
  type CouncilProviderInfo,
  type CouncilSessionSummary,
  type AppSettings,
  type Book,
  type Translation,
  type Testament,
} from "../../lib/bible";
import { CouncilJudgmentPanel, readPayloadJudgment, createEmptyJudgment } from "./CouncilJudgmentPanel";
import { CouncilHistory } from "./CouncilHistory";
import { CouncilProcessView } from "./CouncilProcessView";
import { CouncilResearchTrail } from "./CouncilResearchTrail";
import { CouncilArgumentMaps } from "./CouncilArgumentMaps";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";
import { CopyAsMarkdownButton } from "./CouncilMarkdownExport";
import { AddToTheologyMenu } from "./AddToTheologyMenu";
import { CouncilVoicePreview, CouncilRunningPanel } from "./CouncilVoicePanels";
import { CouncilVoiceMatrix } from "./CouncilVoiceMatrix";
import { CouncilPositionComparison } from "./CouncilPositionComparison";
import { CouncilRetrievalTrace } from "./CouncilRetrievalTrace";
import { CouncilSourceDrawer } from "./CouncilSourceDrawer";
import { CouncilEvidenceAudit } from "./CouncilEvidenceAudit";
import { HighlightedText, buildEvidenceTermsByVerse } from "./councilHighlight";
import { ErrorState } from "../../components/StateViews";
import {
  buildConfidenceFactors,
  buildPositionEvidenceGroups,
  countVoiceMentions,
  evidenceStatusClass,
  evidenceStatusLabel,
  evidenceStatusTooltip,
  formatPercent,
  labelsOverlap,
  sourceDisplay,
  sourceTooltip,
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
  const [startingView, setStartingView] = useState("");
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
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<CouncilJudgment | null>(null);
  const [argumentAnnotations, setArgumentAnnotations] = useState<ArgumentAnnotation[]>([]);
  const councilViewRequestId = useRef(0);
  const sessionListRequestId = useRef(0);

  const refreshSessions = useCallback(() => {
    const requestId = ++sessionListRequestId.current;
    listCouncilSessions(30)
      .then((rows) => {
        if (requestId === sessionListRequestId.current) setSessions(rows);
      })
      .catch(() => {
        if (requestId === sessionListRequestId.current) setSessions([]);
      });
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
      councilViewRequestId.current += 1;
      setQuestion(restoredResult.question);
      setResponse(restoredResult.response);
      setActiveSessionId(restoredResult.response.session_id ?? null);
      setJudgment(readPayloadJudgment(restoredResult.response));
      setError(null);
      setLoading(false);
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

  const onAsk = async (overrideQuestion?: unknown) => {
    // Guard the function itself, not just the button: the Ctrl/⌘+Enter
    // shortcut also calls onAsk, and a second in-flight request would
    // queue behind the sidecar mutex and discard the first result.
    if (loading) return;
    // `onClick={onAsk}` passes a MouseEvent (non-string) → use the input's
    // question; follow-up chaining passes an explicit string.
    const q = (typeof overrideQuestion === "string" ? overrideQuestion : question).trim();
    if (!q) return;
    const requestId = ++councilViewRequestId.current;
    setError(null);
    setResponse(null);
    setActiveSessionId(null);
    setJudgment(null);
    setArgumentAnnotations([]);
    setLoading(true);
    try {
      const r = await askCouncil(q, undefined, {
        strategy,
        include_cross_refs: includeCrossRefs,
        translation_code: translationCode,
        testament: testament === "all" ? null : testament,
        book_id: bookId || null,
        // Clamp to the supported range: the number input does not constrain
        // typed values, and the backend rejects out-of-range limits.
        evidence_limit: Math.min(120, Math.max(10, Math.round(evidenceLimit) || 60)),
      });
      if (requestId !== councilViewRequestId.current) return;
      setResponse(r);
      setActiveSessionId(r.session_id ?? null);
      if (r.session_id && startingView.trim()) {
        const initialJudgment = {
          ...createEmptyJudgment(r.session_id, r),
          before_judgment: startingView.trim(),
        };
        await upsertCouncilJudgment(initialJudgment);
        if (requestId !== councilViewRequestId.current) return;
        setJudgment(initialJudgment);
      }
      refreshSessions();
    } catch (e) {
      if (requestId === councilViewRequestId.current) setError(String(e));
    } finally {
      if (requestId === councilViewRequestId.current) setLoading(false);
    }
  };

  const onAskFollowUp = (text: string) => {
    setQuestion(text); // reflect what's being asked in the input
    void onAsk(text); // submit immediately with the explicit text
  };

  const onSelectSession = async (id: number) => {
    const requestId = ++councilViewRequestId.current;
    setLoading(false);
    try {
      const stored = await getCouncilSession(id);
      if (requestId !== councilViewRequestId.current) return;
      if (stored) {
        setQuestion(stored.question);
        setResponse(stored.response);
        setActiveSessionId(stored.id);
        setJudgment(null);
        setArgumentAnnotations([]);
        setSelectedPositionLabel(null);
        setError(null);
      }
    } catch (e) {
      if (requestId === councilViewRequestId.current) setError(String(e));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <header className="surface-panel rounded-lg px-5 py-4">
        <h1 className="text-2xl font-semibold text-neutral-100">The Council</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Ask a disputed theological question. Available voices
          each analyse independently; Claude synthesises. Minority views are preserved.
        </p>
      </header>

      <div className="surface-panel rounded-lg p-4 space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Council question"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              onAsk();
            }
          }}
          placeholder="e.g. Should women hold leadership positions in the church?"
          rows={3}
          className="settings-input min-h-28 resize-y"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">Ctrl/⌘+Enter to submit</p>
          <button
            type="button"
            onClick={onAsk}
            disabled={loading || !question.trim()}
            className="btn-primary px-3 py-1.5 text-sm"
          >
            {loading ? `Thinking… ${elapsed}s` : "Ask the Council"}
          </button>
        </div>
        <label className="block space-y-1">
          <span className="text-xs tracking-wider text-neutral-500">
            My starting view before AI
          </span>
          <textarea
            value={startingView}
            onChange={(e) => setStartingView(e.target.value)}
            placeholder="Optional: write what you currently think and why before seeing the Council result."
            rows={2}
            className="settings-input resize-y"
          />
        </label>
        {loading ? (
          <CouncilRunningPanel settings={settings} elapsed={elapsed} />
        ) : (
          <CouncilVoicePreview settings={settings} />
        )}
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

      {error && <ErrorState message={error} />}

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
                  session_id: activeSessionId,
                  judgment,
                  argument_annotations: argumentAnnotations,
                  response,
                }}
              />
              <AddToTheologyMenu
                sessionId={activeSessionId}
                question={question}
                response={response}
              />
              <CopyAsMarkdownButton response={response} question={question} judgment={judgment} />
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
          <CouncilResearchTrail response={response} />
          <CouncilArgumentMaps
            sessionId={activeSessionId}
            response={response}
            onAnnotationsChange={setArgumentAnnotations}
          />
          <CouncilJudgmentPanel
            sessionId={activeSessionId}
            response={response}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            onAskFollowUp={onAskFollowUp}
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
        </>
      )}
    </div>
  );
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
    <div className="soft-card grid md:grid-cols-3 gap-2 p-3">
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
        <option value="DC">Deuterocanon</option>
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
          <h2 className="text-sm tracking-wider text-neutral-400">{heading}</h2>
          <ConfidenceBadge confidence={result.confidence} />
        </div>
        {response && <SynthesisModeBanner response={response} />}
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
          <h3 className="text-sm tracking-wider text-neutral-400 mb-2">
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
          <h3 className="text-sm tracking-wider text-neutral-400 mb-2">
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
          <h3 className="text-sm tracking-wider text-neutral-400 mb-2">
            Dissent notes
          </h3>
          <p className="text-sm text-neutral-300 leading-relaxed">{result.dissent_notes}</p>
        </section>
      )}
    </div>
  );
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
          <div className="text-xs tracking-wide text-amber-300 mb-1">
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
      <div className="text-[11px] tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-100">{value}</div>
      <p className="text-[11px] text-neutral-500 line-clamp-2">{detail}</p>
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
          className="text-[10px] tracking-wide px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400"
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

function CouncilConfidenceRationale({ response }: { response: CouncilResponse }) {
  const factors = buildConfidenceFactors(response);
  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-confidence-rationale"
    >
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm tracking-wider text-neutral-400">
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
          <h3 className="text-xs tracking-wide text-neutral-500 mb-1">
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
      <h2 className="text-sm tracking-wider text-neutral-400 mb-3">
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
          {isError && voice.error_category && (
            <span className="meta-pill text-xs text-red-300 border-red-500/40">
              {voice.error_category}
            </span>
          )}
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
        <div className="px-3 py-2 border-t border-neutral-800 text-xs">
          {voice.error_hint && (
            <p className="text-amber-200 mb-1">{voice.error_hint}</p>
          )}
          <p className="text-red-300">{voice.error}</p>
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
