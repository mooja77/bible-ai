import type { CouncilProgressEvent } from "../../lib/bible";

export type StageId = "safety" | "retrieval" | "voices" | "synthesis" | "verdict";
export type StageStatus = "pending" | "active" | "done" | "failed" | "skipped";

export const STAGE_ORDER: StageId[] = [
  "safety",
  "retrieval",
  "voices",
  "synthesis",
  "verdict",
];

export const STAGE_LABELS: Record<StageId, string> = {
  safety: "Safety check",
  retrieval: "Gather evidence",
  voices: "Voices weigh in",
  synthesis: "Review & judge",
  verdict: "Outcome",
};

export interface VoiceRun {
  provider: string;
  display_name: string;
  status: "active" | "done" | "failed";
}

export interface CouncilRunState {
  started: boolean;
  stages: Record<StageId, StageStatus>;
  notes: Partial<Record<StageId, string>>;
  voices: VoiceRun[];
  evidenceCount: number | null;
  verdict: { leader_label: string; leader_weight: number; confidence: string } | null;
  complete: boolean;
}

export function initialRunState(): CouncilRunState {
  return {
    started: false,
    stages: { safety: "pending", retrieval: "pending", voices: "pending", synthesis: "pending", verdict: "pending" },
    notes: {},
    voices: [],
    evidenceCount: null,
    verdict: null,
    complete: false,
  };
}

function set(state: CouncilRunState, id: StageId, status: StageStatus): void {
  state.stages[id] = status;
}

/** Fold one progress event into a new state (pure: returns a fresh object). */
export function reduceRunEvent(prev: CouncilRunState, event: CouncilProgressEvent): CouncilRunState {
  const state: CouncilRunState = {
    ...prev,
    stages: { ...prev.stages },
    notes: { ...prev.notes },
    voices: prev.voices.map((v) => ({ ...v })),
  };
  const str = (k: string) => (typeof event[k] === "string" ? (event[k] as string) : "");
  const num = (k: string) => (typeof event[k] === "number" ? (event[k] as number) : null);

  switch (event.kind) {
    case "run_started":
      state.started = true;
      break;
    case "safety_checked":
      set(state, "safety", str("status") === "blocked" ? "failed" : "done");
      break;
    case "retrieval_started":
      set(state, "retrieval", "active");
      break;
    case "retrieval_fallback":
      state.notes.retrieval = str("reason") || "fell back to keyword search";
      break;
    case "retrieval_done":
      set(state, "retrieval", "done");
      state.evidenceCount = num("count");
      break;
    case "voice_started": {
      if (state.stages.voices === "pending") set(state, "voices", "active");
      const provider = str("provider");
      if (!state.voices.some((v) => v.provider === provider)) {
        state.voices.push({ provider, display_name: str("display_name") || provider, status: "active" });
      }
      break;
    }
    case "voice_done":
    case "voice_failed": {
      const provider = str("provider");
      const v = state.voices.find((x) => x.provider === provider);
      if (v) v.status = event.kind === "voice_done" ? "done" : "failed";
      break;
    }
    case "synthesis_started":
      set(state, "voices", "done");
      set(state, "synthesis", "active");
      break;
    case "synthesis_fallback":
      state.notes.synthesis = str("reason") || "synthesis failed; used the lead voice";
      break;
    case "judged": {
      if (state.stages.voices !== "done") set(state, "voices", "done");
      set(state, "synthesis", state.stages.synthesis === "active" ? "done" : "skipped");
      set(state, "verdict", "done");
      const conf = str("confidence");
      state.verdict = {
        leader_label: str("leader_label"),
        leader_weight: num("leader_weight") ?? 0,
        confidence: conf || "unknown",
      };
      break;
    }
    case "run_complete":
      state.complete = true;
      for (const id of STAGE_ORDER) {
        if (state.stages[id] === "active") set(state, id, "done");
      }
      break;
  }
  return state;
}
