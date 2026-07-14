import { useCallback, useEffect, useRef, useState } from "react";
import {
  askCouncil,
  cancelCouncil,
  getCouncilSession,
  listCouncilSessions,
  upsertCouncilJudgment,
  exportStudyPacket,
  type ArgumentAnnotation,
  type CouncilJudgment,
  type CouncilResponse,
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
import { buildStudyPacketFiles } from "./studyPacket";
import { AddToTheologyMenu } from "./AddToTheologyMenu";
import { CouncilVoicePreview } from "./CouncilVoicePanels";
import { CouncilRunCanvas } from "./CouncilRunCanvas";
import { CouncilReasoningCanvas } from "./CouncilReasoningCanvas";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { useCouncilRun } from "./useCouncilRun";
import { CouncilVoiceMatrix } from "./CouncilVoiceMatrix";
import { CouncilPositionComparison } from "./CouncilPositionComparison";
import { CouncilRetrievalTrace } from "./CouncilRetrievalTrace";
import { CouncilSourceDrawer } from "./CouncilSourceDrawer";
import { CouncilEvidenceAudit } from "./CouncilEvidenceAudit";
import { CouncilResultView } from "./CouncilResultView";
import { CouncilConfidenceRationale } from "./CouncilConfidenceRationale";
import { VoicesAuditTrail } from "./CouncilVoicesAudit";
import { ErrorState } from "../../components/StateViews";
import { ReasoningExplorer } from "./explorer/ReasoningExplorer";

/** Client-side inactivity backstop. Individual provider stages can legitimately
 * take up to ten minutes, while the Rust host owns the thirty-minute overall
 * deadline. Resetting this timer on progress prevents a valid long run from
 * being cancelled just before synthesis finishes. */
const COUNCIL_INACTIVITY_TIMEOUT_MS = 660_000;
const COUNCIL_TIMEOUT_MESSAGE =
  "The Council is taking longer than expected and may be stuck. This usually " +
  "means a slow or unreachable AI provider. Check your connection and provider " +
  "settings, then try again.";

/** Run a Council request with a timer that is restarted by each progress event.
 * Tests may shrink the window via `window.__BIBLE_AI_COUNCIL_TIMEOUT_MS__`. */
async function withCouncilInactivityTimeout<T>(
  start: (markActivity: () => void) => Promise<T>,
): Promise<T> {
  const override = (
    window as unknown as { __BIBLE_AI_COUNCIL_TIMEOUT_MS__?: number }
  ).__BIBLE_AI_COUNCIL_TIMEOUT_MS__;
  const ms =
    typeof override === "number" && override > 0 ? override : COUNCIL_INACTIVITY_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout: ((reason: string) => void) | undefined;
  let active = true;
  const timeout = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const markActivity = () => {
    if (!active) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => rejectTimeout?.(COUNCIL_TIMEOUT_MESSAGE), ms);
  };
  markActivity();
  try {
    return await Promise.race([start(markActivity), timeout]);
  } finally {
    active = false;
    if (timer) clearTimeout(timer);
  }
}

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
  /** Navigate the user to the Settings mode to connect an AI provider. */
  onOpenSettings?: () => void;
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
  onOpenSettings,
}: Props) {
  const [question, setQuestion] = useState("");
  const [startingView, setStartingView] = useState("");
  const [response, setResponse] = useState<CouncilResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { runState, reset: resetRun, handleEvent: onCouncilProgress } = useCouncilRun();
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
  const [packetStatus, setPacketStatus] = useState<string | null>(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
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

  const handleSessionDeleted = useCallback(
    (deletedId: number) => {
      // The delete command has already succeeded, so remove the row
      // immediately. Refresh afterward to reconcile with the database without
      // making the visible result depend on another asynchronous round trip.
      setSessions((current) => current.filter((session) => session.id !== deletedId));
      if (activeSessionId === deletedId) {
        councilViewRequestId.current += 1;
        setResponse(null);
        setActiveSessionId(null);
        setJudgment(null);
        setArgumentAnnotations([]);
        setShowExplorer(false);
        setShowFullAnalysis(false);
      }
      refreshSessions();
    },
    [activeSessionId, refreshSessions],
  );

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
    setShowExplorer(false);
    setShowFullAnalysis(false);
    setLoading(true);
    resetRun();
    try {
      const r = await withCouncilInactivityTimeout((markActivity) =>
        askCouncil(
          q,
          undefined,
          {
            strategy,
            include_cross_refs: includeCrossRefs,
            translation_code: translationCode,
            testament: testament === "all" ? null : testament,
            book_id: bookId || null,
            // Clamp to the supported range: the number input does not constrain
            // typed values, and the backend rejects out-of-range limits.
            evidence_limit: Math.min(120, Math.max(10, Math.round(evidenceLimit) || 60)),
          },
          (event) => {
            markActivity();
            onCouncilProgress(event);
          },
        ),
      );
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
      if (String(e).includes("Council is taking longer than expected")) {
        await cancelCouncil().catch(() => undefined);
      }
      if (requestId === councilViewRequestId.current) setError(String(e));
    } finally {
      if (requestId === councilViewRequestId.current) setLoading(false);
    }
  };

  const onCancelCouncil = async () => {
    councilViewRequestId.current += 1;
    setLoading(false);
    setError(null);
    setPacketStatus(null);
    try {
      await cancelCouncil();
    } catch (e) {
      setError(`Could not stop the Council run: ${String(e)}`);
    }
  };

  const onExportPacket = async () => {
    if (!response) return;
    setPacketStatus(null);
    try {
      const files = buildStudyPacketFiles(question, response, judgment);
      const path = await exportStudyPacket(question.slice(0, 60) || "council", files);
      setPacketStatus(`Study Packet exported to ${path}`);
    } catch (e) {
      setPacketStatus(`Packet export failed: ${String(e)}`);
    }
  };

  const onAskFollowUp = (text: string) => {
    setQuestion(text); // reflect what's being asked in the input
    void onAsk(text); // submit immediately with the explicit text
  };

  const onSelectSession = async (id: number) => {
    if (loading) return;
    const requestId = ++councilViewRequestId.current;
    resetRun();
    // Reset view-state toggles SYNCHRONOUSLY (before the async load) so a slow
    // session fetch can't race a user toggling the audit panels in the gap —
    // otherwise full-analysis/explorer could stay open from the prior result
    // and a click would close (not open) them.
    setShowExplorer(false);
    setShowFullAnalysis(false);
    setSelectedPositionLabel(null);
    setArgumentAnnotations([]);
    try {
      const stored = await getCouncilSession(id);
      if (requestId !== councilViewRequestId.current) return;
      if (stored) {
        setQuestion(stored.question);
        setResponse(stored.response);
        setActiveSessionId(stored.id);
        setJudgment(null);
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
          each provide an analysis; an available provider synthesises. Minority views are preserved.
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
        {(loading || runState.started) && !response && (
          <CouncilRunCanvas runState={runState} question={question} elapsed={elapsed} />
        )}
        {loading ? (
          <button
            type="button"
            onClick={onCancelCouncil}
            data-testid="council-cancel"
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        ) : !response ? (
          <CouncilVoicePreview settings={settings} onOpenSettings={onOpenSettings} />
        ) : null}
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

      {response && !response.sensitive_topic && (
        <>
          {/* The reasoning canvas is the lead of the Council result — the
             editorial "how & why" story — isolated in its own ErrorBoundary so a
             render fault degrades locally instead of taking down the view. It
             carries the verdict-card testids; the dense audit panels stay behind
             "Full analysis" below. */}
          <ErrorBoundary title="The reasoning view ran into a problem">
            <CouncilReasoningCanvas response={response} question={question} />
          </ErrorBoundary>
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
              <button
                type="button"
                onClick={() => void onExportPacket()}
                data-testid="export-study-packet"
                className="btn-secondary px-2 py-1 text-xs"
              >
                Export Study Packet
              </button>
            </span>
          </div>
          {packetStatus && (
            <p
              className="text-xs text-neutral-400 mb-2 break-words"
              data-testid="packet-export-status"
            >
              {packetStatus}
            </p>
          )}
          {response.retrieval_fallback_reason && (
            <p
              className="text-xs text-amber-300/90 mb-2"
              data-testid="council-retrieval-fallback"
            >
              Note: {response.retrieval_fallback_reason}
            </p>
          )}
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
        </>
      )}

      <CouncilHistory
        sessions={sessions}
        onSelect={onSelectSession}
        onChanged={handleSessionDeleted}
        disabled={loading}
      />

      {error && (
        <div data-testid="council-error" className="space-y-2">
          <ErrorState message={error} title="The Council could not finish" />
          <button
            type="button"
            onClick={() => onAsk()}
            disabled={loading || !question.trim()}
            className="btn-secondary px-3 py-1.5 text-sm"
            data-testid="council-retry"
          >
            Try again
          </button>
        </div>
      )}

      {response?.sensitive_topic && (
        <div
          className="soft-card p-4 border border-amber-500/40 bg-amber-500/10"
          data-testid="sensitive-topic-notice"
          role="alert"
        >
          <p className="text-sm font-semibold text-amber-100">
            If this is urgent, please reach out for real help.
          </p>
          <p className="mt-2 text-sm text-amber-100/90 leading-relaxed">
            {response.sensitive_topic.message}
          </p>
        </div>
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
        <option value="hybrid">Search: keyword + meaning</option>
        <option value="keyword">Search: keyword</option>
        <option value="semantic">Search: by meaning</option>
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
        Include cross-references
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        Max passages
        <input
          type="number"
          min={10}
          max={120}
          value={evidenceLimit}
          onChange={(e) => setEvidenceLimit(Number(e.target.value))}
          className="settings-input text-xs"
          aria-label="Maximum passages to consider"
        />
      </label>
    </div>
  );
}
