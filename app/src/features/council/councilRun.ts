import type { CouncilProgressEvent } from "../../lib/bible";

export type StageId =
  | "safety"
  | "retrieval"
  | "scope"
  | "depth"
  | "voices"
  | "synthesis"
  | "grounding"
  | "judge"
  | "verdict";
export type StageStatus = "pending" | "active" | "done" | "failed" | "skipped";

export const STAGE_ORDER: StageId[] = [
  "safety",
  "retrieval",
  "scope",
  "depth",
  "voices",
  "synthesis",
  "grounding",
  "judge",
  "verdict",
];

export const STAGE_LABELS: Record<StageId, string> = {
  safety: "Safety check",
  retrieval: "Gather evidence",
  scope: "Map the positions",
  depth: "Dig per position",
  voices: "Voices weigh in",
  synthesis: "Agreement & conflict",
  grounding: "Grounding check",
  judge: "Cross-family judge",
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
  /** Candidate positions enumerated by the scope pass. */
  positionsScoped: number | null;
  /** How many positions have had their targeted retrieval finish. */
  positionsRetrieved: number;
  /** Verses added to the corpus by per-position (depth) retrieval. */
  depthVerses: number;
  verdict: { leader_label: string; leader_weight: number; confidence: string } | null;
  complete: boolean;
}

function pendingStages(): Record<StageId, StageStatus> {
  return STAGE_ORDER.reduce(
    (acc, id) => {
      acc[id] = "pending";
      return acc;
    },
    {} as Record<StageId, StageStatus>,
  );
}

export function initialRunState(): CouncilRunState {
  return {
    started: false,
    stages: pendingStages(),
    notes: {},
    voices: [],
    evidenceCount: null,
    positionsScoped: null,
    positionsRetrieved: 0,
    depthVerses: 0,
    verdict: null,
    complete: false,
  };
}

function set(state: CouncilRunState, id: StageId, status: StageStatus): void {
  state.stages[id] = status;
}

/** Mark every stage BEFORE `id` that is still "active" as "done" — a later stage
 * starting proves the earlier one finished even if we missed its done event. */
function closeActiveBefore(state: CouncilRunState, id: StageId): void {
  const cutoff = STAGE_ORDER.indexOf(id);
  for (let i = 0; i < cutoff; i += 1) {
    const stage = STAGE_ORDER[i];
    if (state.stages[stage] === "active") set(state, stage, "done");
  }
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
  const bool = (k: string) => event[k] === true;

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
    case "scope_started":
      closeActiveBefore(state, "scope");
      set(state, "scope", "active");
      break;
    case "scope_done": {
      const count = num("position_count");
      state.positionsScoped = count;
      set(state, "scope", "done");
      state.notes.scope =
        count && count > 0
          ? `${count} candidate position${count === 1 ? "" : "s"} identified.`
          : "No distinct positions surfaced; voices proceed unframed.";
      break;
    }
    case "position_retrieval_started":
      closeActiveBefore(state, "depth");
      set(state, "depth", "active");
      break;
    case "position_retrieval_done": {
      set(state, "depth", "active");
      state.positionsRetrieved += 1;
      state.depthVerses += num("count") ?? 0;
      break;
    }
    case "position_retrieval_failed":
      set(state, "depth", "active");
      state.positionsRetrieved += 1;
      break;
    case "depth_done":
      if (state.stages.depth !== "skipped") set(state, "depth", "done");
      break;
    case "voice_started": {
      closeActiveBefore(state, "voices");
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
    case "grounding_started":
      closeActiveBefore(state, "grounding");
      set(state, "grounding", "active");
      break;
    case "regen_started":
      state.notes.grounding = "Ungrounded citation found — repairing…";
      break;
    case "regen_done":
      if (bool("adopted")) state.notes.grounding = "Citation repaired by regeneration.";
      break;
    case "grounding_done": {
      set(state, "grounding", "done");
      const out = num("out_of_corpus") ?? 0;
      const regen = num("regen_attempts") ?? 0;
      state.notes.grounding = bool("hard_fail")
        ? `${out} citation${out === 1 ? "" : "s"} could not be grounded.`
        : regen > 0
          ? `All citations grounded (repaired in ${regen} pass${regen === 1 ? "" : "es"}).`
          : "Every cited verse is grounded in the evidence.";
      break;
    }
    case "judge_started":
      closeActiveBefore(state, "judge");
      set(state, "judge", "active");
      break;
    case "judge_done": {
      set(state, "judge", "done");
      const verdict = str("verdict");
      const provider = str("provider");
      state.notes.judge = bool("available")
        ? `Cross-family verdict: ${verdict || "—"}${provider ? ` (${provider})` : ""}.`
        : "No second-family model check available.";
      break;
    }
    case "judged": {
      closeActiveBefore(state, "verdict");
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
        // Stages that never fired (e.g. scope/depth fail-soft fallback) collapse
        // to "skipped" rather than hanging "pending" after the run finishes.
        else if (state.stages[id] === "pending") set(state, id, "skipped");
      }
      break;
  }
  return state;
}
