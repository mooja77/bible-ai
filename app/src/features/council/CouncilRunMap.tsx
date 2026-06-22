import { Fragment } from "react";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  type CouncilRunState,
  type StageId,
  type StageStatus,
} from "./councilRun";

/**
 * The live "you are here" map of a Council run — the centrepiece process view.
 * Everything is labelled in plain language: named stages that light up in
 * sequence as the real backend events arrive, the actual voices weighing in,
 * and the outcome. No abstract decoration — each part says what it is, and the
 * connectors fill as progress flows from one stage to the next.
 */

function StageNode({
  id,
  status,
  meta,
  index,
}: {
  id: StageId;
  status: StageStatus;
  meta?: string;
  index: number;
}) {
  return (
    <div
      data-testid={`runmap-stage-${id}`}
      data-status={status}
      className="flex min-w-0 flex-1 flex-col items-center text-center"
    >
      <span
        className={
          "grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold " +
          (status === "done"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            : status === "active"
              ? "border-amber-400/50 bg-amber-400/15 text-amber-200 runmap-active-pulse"
              : status === "failed"
                ? "border-red-500/40 bg-red-500/15 text-red-300"
                : "border-neutral-700 text-neutral-600")
        }
        aria-hidden="true"
      >
        {status === "done" ? "✓" : status === "failed" ? "✕" : index + 1}
      </span>
      <span
        className={
          "mt-2 text-xs font-medium leading-tight " +
          (status === "pending" ? "text-neutral-600" : "text-neutral-200")
        }
      >
        {STAGE_LABELS[id]}
      </span>
      <span className="mt-0.5 h-3.5 text-[0.6875rem] text-neutral-500">{meta ?? ""}</span>
    </div>
  );
}

function Connector({ filled, flowing }: { filled: boolean; flowing: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="mt-4 h-[3px] flex-1 self-start overflow-hidden rounded-full bg-neutral-800"
    >
      <div
        className={
          "h-full rounded-full transition-all duration-500 ease-out " +
          (filled
            ? "w-full bg-emerald-500/50"
            : flowing
              ? "w-1/2 bg-amber-400/50 runmap-flow-pulse"
              : "w-0 bg-transparent")
        }
      />
    </div>
  );
}

export function CouncilRunMap({ runState, elapsed }: { runState: CouncilRunState; elapsed: number }) {
  const stageMeta = (id: StageId): string | undefined => {
    const status = runState.stages[id];
    if (id === "retrieval" && runState.evidenceCount != null && status !== "pending") {
      return `${runState.evidenceCount} verses`;
    }
    if (id === "voices" && runState.voices.length > 0) {
      const done = runState.voices.filter((v) => v.status !== "active").length;
      return `${done}/${runState.voices.length}`;
    }
    if (status === "active") return `${elapsed}s`;
    if (runState.notes[id]) return runState.notes[id];
    return undefined;
  };

  return (
    <section
      className="surface-panel rounded-lg p-4 space-y-4"
      data-testid="council-run-map"
      aria-label="Council progress"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="section-kicker">What the Council is doing</span>
        {!runState.complete && <span className="text-xs text-neutral-500 tabular-nums">{elapsed}s</span>}
      </div>

      {/* Named stage flow — lights up left → right as real events arrive. */}
      <div className="flex items-start">
        {STAGE_ORDER.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && (
              <Connector
                filled={runState.stages[STAGE_ORDER[i - 1]] === "done"}
                flowing={runState.stages[id] === "active"}
              />
            )}
            <StageNode id={id} status={runState.stages[id]} meta={stageMeta(id)} index={i} />
          </Fragment>
        ))}
      </div>

      {/* The actual voices weighing in. */}
      {runState.voices.length > 0 && (
        <div className="space-y-1.5">
          <span className="section-kicker">Voices weighing in</span>
          <ul className="flex flex-wrap gap-2" data-testid="runmap-voices">
            {runState.voices.map((v) => (
              <li
                key={v.provider}
                data-testid={`runmap-voice-${v.provider}`}
                data-status={v.status}
                className={
                  "flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm " +
                  (v.status === "done"
                    ? "border-emerald-500/30 text-neutral-200"
                    : v.status === "failed"
                      ? "border-red-500/30 text-neutral-400"
                      : "border-amber-400/30 text-neutral-200")
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    "inline-block h-2 w-2 rounded-full " +
                    (v.status === "done"
                      ? "bg-emerald-400"
                      : v.status === "failed"
                        ? "bg-red-400"
                        : "bg-amber-300 runmap-active-pulse")
                  }
                />
                {v.display_name}
                <span className="text-[0.6875rem] text-neutral-500">
                  {v.status === "done" ? "ready" : v.status === "failed" ? "no answer" : "thinking…"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The outcome. */}
      {runState.verdict && (
        <div
          className="soft-card flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2"
          data-testid="runmap-verdict"
        >
          <span className="section-kicker">Outcome</span>
          <span className="text-sm font-semibold text-amber-300">{runState.verdict.leader_label}</span>
          <span className="text-xs text-neutral-500">{runState.verdict.confidence} confidence</span>
        </div>
      )}
    </section>
  );
}
