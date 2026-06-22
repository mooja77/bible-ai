import type { CouncilRunState, StageId, StageStatus } from "./councilRun";

/**
 * Live "watch it think" canvas — the reasoning canvas's run-phase. Built from the
 * REAL CouncilRunState (streamed backend events, not timing): the same numbered
 * editorial timeline as the completed canvas, with each band lighting up as its
 * stage actually advances and the voices appearing/finishing on real voice
 * events. On completion CouncilPanel swaps this for the full CouncilReasoningCanvas.
 *
 * Carries the run-map testids (council-run-map, runmap-stage-*, runmap-voices,
 * runmap-verdict) so the live progression stays e2e-covered.
 */

const VOICE_VARS = ["--c-voice-a", "--c-voice-b", "--c-voice-c", "--c-voice-d"];

function nodeClass(status: StageStatus): string {
  if (status === "done") return "reasoning-run-node-done";
  if (status === "active") return "reasoning-run-node-active";
  if (status === "failed") return "reasoning-run-node-failed";
  return "reasoning-run-node-pending";
}

function LiveBand({
  step,
  kicker,
  title,
  status,
  runmapStage,
  children,
}: {
  step: number;
  kicker: string;
  title: string;
  status: StageStatus;
  runmapStage?: StageId;
  children: React.ReactNode;
}) {
  return (
    <div
      className="reasoning-band"
      {...(runmapStage ? { "data-testid": `runmap-stage-${runmapStage}`, "data-status": status } : {})}
    >
      <span
        className={`reasoning-band-node ${nodeClass(status)} ${status === "active" ? "runmap-active-pulse" : ""}`}
        aria-hidden="true"
      >
        {status === "done" ? "✓" : status === "failed" ? "✕" : String(step).padStart(2, "0")}
      </span>
      <div className="space-y-2">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h3 className="editorial-section-h2 mt-0.5">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CouncilRunCanvas({
  runState,
  question,
  elapsed,
}: {
  runState: CouncilRunState;
  question: string;
  elapsed: number;
}) {
  const s = runState.stages;
  const voiceColor = (provider: string) => {
    const i = runState.voices.findIndex((v) => v.provider === provider);
    return `var(${VOICE_VARS[(i >= 0 ? i : 0) % VOICE_VARS.length]})`;
  };

  return (
    <section className="reasoning-canvas" aria-label="The Council is working" aria-live="polite">
      <header className="reasoning-canvas-head">
        <p className="section-kicker" style={{ textAlign: "center" }}>The Council is thinking…</p>
        <p className="reasoning-question">{question}</p>
        {!runState.complete && (
          <p className="reasoning-dateline tabular-nums">{elapsed}s elapsed</p>
        )}
      </header>

      <div className="reasoning-timeline" data-testid="council-run-map">
        {/* 01 · Evidence */}
        <LiveBand
          step={1}
          kicker="Evidence gathered"
          title="What scriptures were weighed"
          status={s.retrieval}
          runmapStage="retrieval"
        >
          <p className="reasoning-note">
            {s.retrieval === "done"
              ? `${runState.evidenceCount ?? 0} verses gathered.`
              : s.retrieval === "active"
                ? "Searching Scripture…"
                : "Waiting to gather scriptures."}
          </p>
        </LiveBand>

        {/* 02 · Voices */}
        <LiveBand step={2} kicker="The voices weigh in" title="Each model's independent view" status={s.voices}>
          {runState.voices.length === 0 ? (
            <p className="reasoning-note">The voices are preparing…</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" data-testid="runmap-voices">
              {runState.voices.map((v) => (
                <li key={v.provider}>
                  <span
                    className="voice-chip"
                    data-testid={`runmap-voice-${v.provider}`}
                    data-status={v.status}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "voice-chip-dot" + (v.status === "active" ? " runmap-active-pulse" : "")
                      }
                      style={{
                        background:
                          v.status === "failed" ? "var(--c-challenge)" : voiceColor(v.provider),
                      }}
                    />
                    <span className="text-neutral-200">{v.display_name}</span>
                    <span className="reasoning-faint">
                      {v.status === "done" ? "ready" : v.status === "failed" ? "no answer" : "thinking…"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </LiveBand>

        {/* 03 · Agreement & conflict */}
        <LiveBand
          step={3}
          kicker="Agreement & conflict"
          title="Where the voices converge and clash"
          status={s.synthesis}
        >
          <p className="reasoning-note">
            {s.synthesis === "pending"
              ? "Waiting for the voices to finish."
              : "Comparing the views and clustering positions…"}
          </p>
        </LiveBand>

        {/* 04 · The judge weighs */}
        <LiveBand
          step={4}
          kicker="The judge weighs"
          title="How the leading view is reached"
          status={s.synthesis}
        >
          <p className="reasoning-note">
            {s.synthesis === "done" || s.verdict !== "pending"
              ? "Weighing the clustered positions…"
              : "Waiting for synthesis."}
          </p>
        </LiveBand>

        {/* 05 · Outcome */}
        <LiveBand
          step={5}
          kicker="Outcome"
          title={runState.verdict ? runState.verdict.leader_label : "Reaching an outcome…"}
          status={s.verdict}
          runmapStage="verdict"
        >
          {runState.verdict ? (
            <div data-testid="runmap-verdict" className="text-sm text-neutral-300 capitalize">
              {runState.verdict.confidence} confidence
            </div>
          ) : (
            <p className="reasoning-note">The Council has not reached an outcome yet.</p>
          )}
        </LiveBand>
      </div>
    </section>
  );
}
