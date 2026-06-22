import { useEffect, useRef } from "react";
import type { CouncilResponse } from "../../lib/bible";

/**
 * Cinematic hero reveal — the "Hollywood" moment that plays once when a Council
 * result lands, then settles into the legible CouncilReasoningCanvas beneath it.
 *
 * A dark "Council chamber" stage where the real reasoning is dramatized on a 2D
 * Canvas: evidence streams as motes of light into the voice orbs, each voice's
 * positions drift out and MIGRATE into glowing clusters (agreement pulls
 * together, dissent stays apart), then the leading cluster IGNITES gold — the
 * verdict. Driven entirely by the real CouncilResponse (voices, positions,
 * clusters, leader). Reduced-motion users skip straight to the settled canvas.
 *
 * Every moving thing is labelled (voice names, the leading view) — stunning
 * BECAUSE legible, not despite it.
 */

const DUR = {
  intro: 0.45,
  evidenceEnd: 1.7,
  flowEnd: 3.3,
  clusterEnd: 4.9,
  igniteEnd: 5.9,
  end: 6.7,
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface Orb {
  x: number;
  y: number;
  r: number;
  color: string;
  name: string;
}
interface Node {
  ox: number; // origin (at its voice orb)
  oy: number;
  cx: number; // cluster target
  cy: number;
  color: string;
  clusterId: string;
  leader: boolean;
}
interface Mote {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  delay: number;
  speed: number;
  color: string;
  size: number;
}

export function CouncilHeroReveal({
  response,
  onDone,
  replayKey,
}: {
  response: CouncilResponse;
  onDone: () => void;
  replayKey: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let start = 0;
    let cancelled = false;

    // ---- resolve the editorial palette into concrete canvas colours ----
    const accent = cssVar("--accent", "#b08400");
    const voiceColors = [
      cssVar("--c-voice-a", "#3b6fb0"),
      cssVar("--c-voice-b", "#1f9d7a"),
      cssVar("--c-voice-c", "#b06a2e"),
      cssVar("--c-voice-d", "#8a5bd0"),
    ];

    // ---- derive the scene from the REAL result ----
    const okVoices = (response.voices ?? []).filter((v) => v.status === "ok");
    const voiceList = okVoices.length > 0 ? okVoices : [{ provider: "council", display_name: "The Council" } as { provider: string; display_name: string }];
    const positions = response.synthesis?.positions ?? [];
    const ranked = [...positions];
    const leaderLabel = ranked[0]?.label ?? "Leading view";
    const leaderCluster = (ranked[0] as { cluster_id?: string })?.cluster_id ?? "leader";

    // cluster groupings (fallback: one cluster per position; or a single cluster)
    const clusterIds: string[] = [];
    const positionList = positions.length > 0 ? positions : [{ label: leaderLabel } as { label: string; cluster_id?: string }];
    for (const p of positionList) {
      const cid = (p as { cluster_id?: string }).cluster_id ?? (p as { label?: string }).label ?? "c";
      if (!clusterIds.includes(cid)) clusterIds.push(cid);
    }

    let orbs: Orb[] = [];
    let nodes: Node[] = [];
    let motes: Mote[] = [];
    let W = 0;
    let H = 0;
    let evidenceSrc = { x: 0, y: 0 };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      evidenceSrc = { x: W / 2, y: H * 0.9 };

      // voice orbs across the upper third
      const n = voiceList.length;
      orbs = voiceList.map((v, i) => {
        const span = W * 0.74;
        const x = n === 1 ? W / 2 : W * 0.13 + (span * i) / (n - 1);
        return {
          x,
          y: H * 0.3,
          r: Math.max(16, Math.min(34, W / 22)),
          color: voiceColors[i % voiceColors.length],
          name: v.display_name,
        };
      });

      // cluster centroids across the lower-middle
      const cN = clusterIds.length;
      const clusterPos: Record<string, { x: number; y: number }> = {};
      clusterIds.forEach((cid, i) => {
        const span = W * 0.6;
        const x = cN === 1 ? W / 2 : W * 0.2 + (span * i) / (cN - 1);
        clusterPos[cid] = { x, y: H * 0.66 };
      });

      // position nodes: born at a voice orb, migrate to their cluster centroid
      nodes = positionList.map((p, i) => {
        const cid = (p as { cluster_id?: string }).cluster_id ?? (p as { label?: string }).label ?? "c";
        const orb = orbs[i % orbs.length];
        const target = clusterPos[cid] ?? { x: W / 2, y: H * 0.66 };
        const jitter = (i % 3) - 1;
        return {
          ox: orb.x + jitter * 10,
          oy: orb.y + 6,
          cx: target.x + jitter * 16,
          cy: target.y + (Math.floor(i / Math.max(cN, 1)) % 2) * 14,
          color: orb.color,
          clusterId: cid,
          leader: cid === leaderCluster,
        };
      });

      // evidence motes: rise from the source, then flow into the orbs
      const count = Math.min(90, 28 + positionList.length * 6 + orbs.length * 8);
      motes = Array.from({ length: count }, (_, i) => {
        const orb = orbs[i % orbs.length];
        return {
          sx: evidenceSrc.x + (Math.sin(i * 12.9) * W) / 5,
          sy: evidenceSrc.y + (i % 7) * 6,
          tx: orb.x + Math.cos(i) * orb.r * 0.6,
          ty: orb.y + Math.sin(i) * orb.r * 0.6,
          delay: (i / count) * 0.9,
          speed: 0.8 + (i % 5) * 0.12,
          color: orb.color,
          size: 1.2 + (i % 3) * 0.7,
        };
      });
    };

    const phase = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

    const paintBackground = (alpha: number) => {
      // warm near-black chamber with a soft central glow
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#14110d");
      g.addColorStop(1, "#0b0a08");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.6);
      rg.addColorStop(0, "rgba(176,132,0,0.10)");
      rg.addColorStop(1, "rgba(176,132,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    };

    const draw = (now: number) => {
      if (cancelled) return;
      if (!start) start = now;
      const t = (now - start) / 1000;

      const introA = clamp01(t / DUR.intro);
      const outroA = 1 - clamp01((t - (DUR.end - 0.8)) / 0.8);
      const stageA = Math.min(introA, outroA);

      paintBackground(stageA);

      // ---------- EVIDENCE → FLOW : motes rise then stream into orbs ----------
      ctx.globalCompositeOperation = "lighter";
      const flow = phase(t, DUR.intro, DUR.flowEnd);
      for (const m of motes) {
        const local = clamp01((flow - m.delay) * m.speed);
        if (local <= 0) continue;
        const e = easeInOutCubic(local);
        // arc: rise from source, curve into the orb
        const midx = lerp(m.sx, m.tx, 0.5);
        const midy = Math.min(m.sy, m.ty) - H * 0.12;
        const x = lerp(lerp(m.sx, midx, e), lerp(midx, m.tx, e), e);
        const y = lerp(lerp(m.sy, midy, e), lerp(midy, m.ty, e), e);
        const a = (local < 0.85 ? 1 : 1 - (local - 0.85) / 0.15) * stageA;
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = m.color;
        ctx.shadowColor = m.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ---------- VOICE ORBS : brighten as evidence arrives ----------
      const orbLit = phase(t, DUR.evidenceEnd, DUR.flowEnd);
      orbs.forEach((o) => {
        const pulse = 1 + 0.06 * Math.sin(t * 3 + o.x);
        const lit = easeOutCubic(orbLit) * (0.55 + 0.45 * pulse);
        const r = o.r * (0.7 + 0.3 * easeOutCubic(orbLit));
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 2.4);
        grad.addColorStop(0, o.color);
        grad.addColorStop(0.4, o.color + "cc");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = lit * stageA;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        // solid core
        ctx.globalAlpha = (0.85 * easeOutCubic(orbLit)) * stageA;
        ctx.fillStyle = o.color;
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ---------- POSITION NODES MIGRATE INTO CLUSTERS ----------
      const mig = easeInOutCubic(phase(t, DUR.flowEnd, DUR.clusterEnd));
      const appear = phase(t, DUR.flowEnd - 0.3, DUR.flowEnd + 0.2);
      // cluster connective light (draw lines between same-cluster nodes once migrated)
      if (mig > 0.2) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[i].clusterId !== nodes[j].clusterId) continue;
            const ax = lerp(nodes[i].ox, nodes[i].cx, mig);
            const ay = lerp(nodes[i].oy, nodes[i].cy, mig);
            const bx = lerp(nodes[j].ox, nodes[j].cx, mig);
            const by = lerp(nodes[j].oy, nodes[j].cy, mig);
            ctx.globalAlpha = (mig - 0.2) * 0.5 * stageA;
            ctx.strokeStyle = nodes[i].leader ? accent : nodes[i].color;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }
      nodes.forEach((nd) => {
        const x = lerp(nd.ox, nd.cx, mig);
        const y = lerp(nd.oy, nd.cy, mig);
        const col = nd.leader && t > DUR.clusterEnd ? accent : nd.color;
        ctx.globalAlpha = clamp01(appear) * stageA;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // ---------- LEADER IGNITES ----------
      const ign = phase(t, DUR.clusterEnd, DUR.igniteEnd);
      if (ign > 0) {
        const leaderNode = nodes.find((n) => n.leader);
        const lx = leaderNode ? leaderNode.cx : W / 2;
        const ly = leaderNode ? leaderNode.cy : H * 0.66;
        const e = easeOutCubic(ign);
        // expanding ring
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (1 - e) * stageA;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(lx, ly, e * W * 0.22, 0, Math.PI * 2);
        ctx.stroke();
        // gold bloom
        const bloom = ctx.createRadialGradient(lx, ly, 0, lx, ly, 80 + e * 60);
        bloom.addColorStop(0, accent);
        bloom.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = (0.6 + 0.4 * Math.sin(t * 6)) * e * stageA;
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(lx, ly, 80 + e * 60, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---------- LABELS (legibility) ----------
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      // voice names appear with the orbs
      ctx.globalAlpha = easeOutCubic(orbLit) * stageA;
      ctx.fillStyle = "rgba(245,240,230,0.92)";
      ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
      orbs.forEach((o) => ctx.fillText(o.name, o.x, o.y + o.r * 1.7));
      // kicker
      ctx.globalAlpha = stageA * 0.7;
      ctx.fillStyle = accent;
      ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(
        flow < 1 ? "WEIGHING THE EVIDENCE" : mig < 1 ? "THE VOICES CONVERGE" : "THE LEADING VIEW",
        W / 2,
        H * 0.1,
      );
      // leader label on ignite
      if (ign > 0.2) {
        const leaderNode = nodes.find((n) => n.leader);
        const lx = leaderNode ? leaderNode.cx : W / 2;
        const ly = leaderNode ? leaderNode.cy : H * 0.66;
        ctx.globalAlpha = clamp01((ign - 0.2) / 0.4) * stageA;
        ctx.fillStyle = "rgba(248,244,236,0.96)";
        ctx.font = "600 16px Georgia, 'Times New Roman', serif";
        ctx.fillText(leaderLabel, lx, ly + 34);
      }

      ctx.globalAlpha = 1;

      if (t >= DUR.end) {
        doneRef.current();
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    layout();
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  return (
    <div className="council-hero" role="presentation">
      <canvas ref={canvasRef} className="council-hero-canvas" />
      <button type="button" className="council-hero-skip" onClick={() => doneRef.current()}>
        Skip ›
      </button>
    </div>
  );
}
