import type { AppSettings } from "../../lib/bible";

function getCouncilVoices(settings?: AppSettings) {
  const googleReady = hasSettingValue(settings?.google_api_key);
  const openAiReady = hasSettingValue(settings?.openai_api_key);
  const anthropicReady = hasSettingValue(settings?.anthropic_api_key);
  const gatewayReady = hasSettingValue(settings?.managed_gateway_url);
  const voices = [
    {
      label: "Claude",
      state: anthropicReady ? "will run" : "will try",
      detail: anthropicReady
        ? `Anthropic API ${settings?.anthropic_model || "claude-sonnet-4-6"} handles Claude voice and synthesis.`
        : `Claude Code ${settings?.claude_model ?? "sonnet"} handles synthesis if the local login is available.`,
      active: true,
    },
    {
      label: "Gateway",
      state: gatewayReady ? "will run" : "optional",
      detail: gatewayReady
        ? "Managed gateway will run as a Council voice without direct provider keys on this device."
        : "Add a managed gateway URL in Settings for team/public deployments.",
      active: gatewayReady,
    },
    {
      label: "Gemini",
      state: googleReady ? "will run" : "needs key",
      detail: googleReady
        ? `Google API key is set for ${settings?.gemini_model || "gemini-2.5-flash"}.`
        : "Add a Google API key in Settings.",
      active: googleReady,
    },
    {
      label: "OpenAI",
      state: openAiReady ? "will run" : "needs key",
      detail: openAiReady
        ? `OpenAI API key is set for ${settings?.openai_model || "gpt-5"}.`
        : "Add an OpenAI API key in Settings.",
      active: openAiReady,
    },
  ];
  const noProvidersConfigured = !googleReady && !openAiReady && !anthropicReady && !gatewayReady;
  return { voices, noProvidersConfigured };
}

export function CouncilVoicePreview({ settings }: { settings?: AppSettings }) {
  const { voices, noProvidersConfigured } = getCouncilVoices(settings);
  return (
    <div
      className="soft-card p-3"
      data-testid="council-voice-preview"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-xs tracking-wider text-neutral-500">
          Voices before submit
        </h2>
        <span className="text-xs text-neutral-600">
          {voices.filter((voice) => voice.active).length}/{voices.length} enabled
        </span>
      </div>
      {noProvidersConfigured && (
        <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          No AI provider is configured yet. The Council will try your local Claude
          Code login — for reliable multi-voice analysis, open <strong>Settings</strong>{" "}
          to add an OpenAI, Google, or Anthropic key.
        </div>
      )}
      <div className="grid md:grid-cols-4 gap-2">
        {voices.map((voice) => (
          <div key={voice.label} className="soft-card px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-neutral-200">{voice.label}</span>
              <span
                className={
                  "text-[11px] px-2 py-0.5 rounded " +
                  (voice.active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-neutral-800 text-neutral-500")
                }
              >
                {voice.state}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{voice.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The visible stages of a Council run, in order. The first two complete quickly;
 * "Consulting the helpers" is where the bulk of the time goes (and where the live
 * per-helper cards appear). The timing is an honest *estimate* derived from
 * elapsed seconds — we never claim the last stages finished, since the panel is
 * replaced by the result the moment the run completes.
 */
const COUNCIL_STAGES = [
  { id: "understand", label: "Understanding your question" },
  { id: "search", label: "Searching Scripture" },
  { id: "consult", label: "Consulting the helpers" },
  { id: "compare", label: "Comparing the views" },
  { id: "summary", label: "Writing the summary" },
] as const;

/** Index of the stage that is currently "active", estimated from elapsed time. */
function estimateActiveStage(elapsed: number): number {
  if (elapsed < 2) return 0; // understanding
  if (elapsed < 5) return 1; // searching
  return 2; // consulting — holds here (the long part); compare/summary stay upcoming
}

export function CouncilRunningPanel({ settings, elapsed }: { settings?: AppSettings; elapsed: number }) {
  const active = getCouncilVoices(settings).voices.filter((v) => v.active);
  const helpers = active.length > 0 ? active : [{ label: "Council", active: true }];
  const activeStage = estimateActiveStage(elapsed);

  return (
    <div className="soft-card p-3" data-testid="council-running-panel">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-xs tracking-wider text-neutral-500">Working on your question</h2>
        <span className="text-xs text-neutral-500 tabular-nums">{elapsed}s</span>
      </div>

      {/* Pipeline of stages — what the app is doing right now. */}
      <ol className="space-y-1.5" aria-label="Council progress">
        {COUNCIL_STAGES.map((stage, index) => {
          const status =
            index < activeStage ? "done" : index === activeStage ? "active" : "upcoming";
          return (
            <li key={stage.id} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={
                  "grid place-items-center w-4 h-4 rounded-full shrink-0 text-[10px] " +
                  (status === "done"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : status === "active"
                      ? "bg-amber-400/20 text-amber-300 council-stage-pulse"
                      : "border border-neutral-700 text-transparent")
                }
              >
                {status === "done" ? "✓" : status === "active" ? "●" : ""}
              </span>
              <span
                className={
                  status === "upcoming"
                    ? "text-neutral-600"
                    : status === "active"
                      ? "text-neutral-200"
                      : "text-neutral-400"
                }
              >
                {stage.label}
                {status === "active" ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Live per-helper cards, shown while the helpers are consulting. */}
      {activeStage >= 2 && (
        <ul className="mt-3 grid sm:grid-cols-2 gap-1.5" aria-label="AI helpers working">
          {helpers.map((v, index) => (
            <li
              key={v.label}
              className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/40 px-2.5 py-1.5 text-sm text-neutral-300"
            >
              <span className="council-thinking shrink-0" aria-hidden="true" style={{ animationDelay: `${index * 160}ms` }}>
                <span />
                <span />
                <span />
              </span>
              <span className="truncate">{v.label}</span>
              <span className="ml-auto text-[11px] text-neutral-500">thinking…</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-neutral-600 mt-3">
        The helpers work in parallel, so a slow one won't hold up the rest. Larger models can take a
        little while.
      </p>
    </div>
  );
}

function hasSettingValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}
