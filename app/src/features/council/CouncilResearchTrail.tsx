import type { CouncilResponse, ResearchTrailEvent } from "../../lib/bible";

export function CouncilResearchTrail({ response }: { response: CouncilResponse }) {
  const trail = buildResearchTrail(response);
  return (
    <section className="surface-panel rounded-lg p-4" data-testid="council-research-trail">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">Research Trail</h2>
          <p className="text-sm text-neutral-500 mt-1">
            The visible path from question to retrieval, evidence, voices, synthesis, and limits.
          </p>
        </div>
        <span className="text-xs text-neutral-600">{trail.length} events</span>
      </div>
      <ol className="space-y-3">
        {trail.map((event, index) => (
          <li key={event.id} className="grid grid-cols-[2rem_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={
                  "w-7 h-7 rounded-full grid place-items-center text-xs border " +
                  (event.status === "warning"
                    ? "border-amber-500/50 text-amber-200 bg-amber-500/10"
                    : event.status === "error"
                      ? "border-red-500/50 text-red-200 bg-red-500/10"
                      : "border-emerald-500/40 text-emerald-200 bg-emerald-500/10")
                }
              >
                {index + 1}
              </span>
            </div>
            <div className="soft-card p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-neutral-100">{event.label}</h3>
                <span className="text-[0.625rem] tracking-wide px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  {event.event_type}
                </span>
                {event.related_position && (
                  <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">
                    {event.related_position}
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-400">{event.detail}</p>
              {event.related_verse_ids?.length ? (
                <p className="text-[0.6875rem] text-neutral-600 mt-1">
                  Verse IDs: {event.related_verse_ids.slice(0, 8).join(", ")}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function buildResearchTrail(response: CouncilResponse) {
  const existing = response.synthesis.research_trail;
  if (existing?.length) return existing;
  const events: ResearchTrailEvent[] = [
    {
      id: "fallback-question",
      label: "Question submitted",
      detail: "The user submitted a disputed question to the Council.",
      event_type: "question" as const,
      status: "complete" as const,
      related_position: null,
      related_verse_ids: [],
    },
    {
      id: "fallback-retrieval",
      label: "Evidence retrieved",
      detail: `${response.evidence_count ?? response.retrieved_evidence?.length ?? 0} candidate evidence rows were retrieved by ${response.retrieval_mode ?? "the configured"} retrieval path.`,
      event_type: "retrieval" as const,
      status: "complete" as const,
      related_position: null,
      related_verse_ids: (response.retrieved_evidence ?? [])
        .slice(0, 12)
        .map((evidence) => evidence.verse_id),
    },
    {
      id: "fallback-voices",
      label: "Voices compared",
      detail: `${response.voices.filter((voice) => voice.status === "ok").length} voice(s) returned a result; ${response.voices.filter((voice) => voice.status === "error").length} failed.`,
      event_type: "voice" as const,
      status: response.voices.some((voice) => voice.status === "error")
        ? ("warning" as const)
        : ("complete" as const),
      related_position: null,
      related_verse_ids: [],
    },
    {
      id: "fallback-synthesis",
      label: "Positions weighted",
      detail: `${response.synthesis.positions.length} position(s) were preserved in the final synthesis.`,
      event_type: "synthesis" as const,
      status: "complete" as const,
      related_position: response.synthesis.positions[0]?.label ?? null,
      related_verse_ids: response.synthesis.positions[0]?.evidence.map((evidence) => evidence.verse_id) ?? [],
    },
  ];
  if (response.synthesis.unresolved_tensions?.length) {
    events.push({
      id: "fallback-limits",
      label: "Unresolved tensions retained",
      detail: response.synthesis.unresolved_tensions.join(" "),
      event_type: "limitation",
      status: "warning",
      related_position: null,
      related_verse_ids: [],
    });
  }
  return events;
}
