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
            {runState.verdict.confidence} confidence
          </span>
        </div>
      ) : null}
    </section>
  );
}
