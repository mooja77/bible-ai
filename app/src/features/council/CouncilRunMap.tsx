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

/**
 * Decorative real-time process canvas (aria-hidden — the accessible truth is the
 * stage grid + voice pills + verdict below). Reads the live CouncilRunState each
 * frame and renders the council as a left→right flow:
 *   question → evidence → voice nodes → synthesis → verdict
 * Nodes light up and particles travel along edges exactly as the real backend
 * events advance each stage; concurring voices stay lit at the verdict, dropped
 * (failed) voices fade — making agreement vs. conflict visible.
 */
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

    // Pull theme colours from CSS tokens (warm gold/indigo in light/dark).
    const css = getComputedStyle(canvas);
    const tok = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    const VOICE = [
      tok("--c-voice-a", "#1a4fa8"),
      tok("--c-voice-b", "#0d6e5a"),
      tok("--c-voice-c", "#7a5a00"),
      tok("--c-voice-d", "#8a1f5e"),
    ];
    const ACCENT = tok("--accent", "#b8902f");
    const DONE = tok("--c-support", "#047857");
    const FAIL = "#c0392b";
    const INK = tok("--c-leader", ACCENT);
    const LINE = "rgba(140,140,150,0.30)";

    const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
    const withAlpha = (hex: string, a: number) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) return hex;
      const n = parseInt(m[1], 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };

    const node = (x: number, y: number, r: number, color: string, glow: number) => {
      if (glow > 0) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r + 10 * glow);
        g.addColorStop(0, withAlpha(color, 0.55 * glow));
        g.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r + 10 * glow, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const edge = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      lit: number,
      color: string,
      flow: number,
      t: number,
    ) => {
      ctx.strokeStyle = lit > 0 ? withAlpha(color, 0.18 + 0.5 * lit) : LINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (flow > 0) {
        const count = 3;
        for (let k = 0; k < count; k += 1) {
          const p = (((t / 1000) + k / count) % 1 + 1) % 1;
          const px = lerp(x1, x2, p);
          const py = lerp(y1, y2, p);
          // Fade each particle in/out across its travel so motion reads clearly.
          const fade = Math.sin(p * Math.PI);
          ctx.fillStyle = withAlpha(color, (0.45 + 0.5 * flow) * fade);
          ctx.beginPath();
          ctx.arc(px, py, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const draw = (t: number) => {
      const s = stateRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const yc = h / 2;
      ctx.clearRect(0, 0, w, h);
      const pulse = (speed: number) => 0.5 + 0.5 * Math.sin(t / speed);

      const xQuestion = w * 0.07;
      const xEvidence = w * 0.28;
      const xVoice = w * 0.54;
      const xSynth = w * 0.78;
      const xVerdict = w * 0.94;

      const safetyFailed = s.stages.safety === "failed";
      const retrActive = s.stages.retrieval === "active";
      const retrDone = s.stages.retrieval === "done";
      const voicesActive = s.stages.voices === "active";
      const synthActive = s.stages.synthesis === "active";
      const synthDone = s.stages.synthesis === "done";
      const verdictDone = s.stages.verdict === "done";

      const voices = s.voices;
      const vc = voices.length;
      const vTop = h * 0.2;
      const vBot = h * 0.8;
      const voiceY = (i: number) => (vc <= 1 ? yc : lerp(vTop, vBot, i / (vc - 1)));

      // A path stays gently "alive" (slow particle flow) once it's established,
      // so there is always visible motion — not only during the brief run.
      const established = retrDone || vc > 0;
      // Edges: question → evidence
      edge(
        xQuestion,
        yc,
        xEvidence,
        yc,
        retrActive || established ? 1 : 0.2,
        ACCENT,
        retrActive ? 1 : established ? 0.4 : 0,
        t,
      );
      // Edges: evidence → each voice, and voice → synthesis
      voices.forEach((v, i) => {
        const vy = voiceY(i);
        const vColor = v.status === "failed" ? FAIL : VOICE[i % VOICE.length];
        const inLit = v.status === "done" || v.status === "failed" ? 1 : voicesActive ? 0.6 : 0.2;
        const inFlow = v.status === "active" ? 1 : v.status === "done" ? 0.4 : 0;
        edge(xEvidence, yc, xVoice, vy, inLit, vColor, inFlow, t);
        const outLit = synthDone || verdictDone ? (v.status === "done" ? 1 : 0.12) : synthActive && v.status === "done" ? 0.8 : 0.12;
        const outFlow = synthActive && v.status === "done" ? 1 : verdictDone && v.status === "done" ? 0.4 : 0;
        edge(xVoice, vy, xSynth, yc, outLit, v.status === "done" ? DONE : LINE, outFlow, t);
      });
      // Edge: synthesis → verdict
      edge(xSynth, yc, xVerdict, yc, verdictDone ? 1 : synthActive ? 0.4 : 0.12, INK, verdictDone ? 0.5 : synthActive ? 0.7 : 0, t);

      // Nodes — lit nodes "breathe" gently so the map stays alive after the run.
      const breathe = (base: number, amp: number, speed: number) => base + amp * pulse(speed);
      node(
        xQuestion,
        yc,
        5.5,
        safetyFailed ? FAIL : ACCENT,
        s.started && !retrDone ? pulse(420) : established ? breathe(0.2, 0.12, 1500) : 0.15,
      );
      node(
        xEvidence,
        yc,
        6,
        established ? DONE : ACCENT,
        retrActive ? pulse(360) : established ? breathe(0.24, 0.14, 1400) : 0.1,
      );
      voices.forEach((v, i) => {
        const vy = voiceY(i);
        const vColor = v.status === "failed" ? FAIL : VOICE[i % VOICE.length];
        const glow =
          v.status === "active" ? pulse(300) : v.status === "done" ? breathe(0.26, 0.18, 1150) : 0;
        node(xVoice, vy, v.status === "failed" ? 4 : 6, vColor, glow);
      });
      node(
        xSynth,
        yc,
        6.5,
        synthDone || verdictDone ? INK : ACCENT,
        synthActive ? pulse(320) : synthDone || verdictDone ? breathe(0.24, 0.14, 1250) : 0.08,
      );
      node(
        xVerdict,
        yc,
        verdictDone ? 8 : 4,
        verdictDone ? INK : LINE,
        verdictDone ? breathe(0.5, 0.28, 900) : 0,
      );

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="w-full h-44" data-testid="runmap-canvas" aria-hidden="true" />;
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
