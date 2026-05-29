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

export function CouncilRunningPanel({ settings, elapsed }: { settings?: AppSettings; elapsed: number }) {
  const active = getCouncilVoices(settings).voices.filter((v) => v.active);
  const rows = active.length > 0 ? active : [{ label: "Council", active: true }];
  return (
    <div className="soft-card p-3" data-testid="council-running-panel">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-xs tracking-wider text-neutral-500">Consulting the Council</h2>
        <span className="text-xs text-neutral-500">{elapsed}s</span>
      </div>
      <ul className="space-y-1">
        {rows.map((v) => (
          <li key={v.label} className="flex items-center gap-2 text-sm text-neutral-300">
            <span
              className="inline-block w-2 h-2 rounded-full bg-amber-400/80 animate-pulse"
              aria-hidden="true"
            />
            <span>{v.label}</span>
            <span className="text-xs text-neutral-500">consulting…</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-600 mt-2">
        Voices run in parallel; large models can take a while. Each voice is capped, so a slow one
        won't hold up the rest.
      </p>
    </div>
  );
}

function hasSettingValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}
