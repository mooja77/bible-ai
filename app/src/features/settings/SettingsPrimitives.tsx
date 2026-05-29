import type { ReactNode } from "react";

export type SetupPath = "personal" | "local" | "gateway";
export type DataSourceStatus = "bundled" | "user-imported" | "deferred";

export function SetupPathButton({
  active,
  label,
  detail,
  onClick,
  testId,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={
        "text-left rounded-md border px-3 py-2 transition-colors " +
        (active
          ? "border-amber-500/45 bg-amber-500/12 text-amber-100"
          : "border-neutral-800 bg-neutral-950/35 text-neutral-300 hover:border-neutral-600")
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-neutral-500 mt-0.5">{detail}</span>
    </button>
  );
}

export function SetupPathDetails({ path }: { path: SetupPath }) {
  const details =
    path === "personal"
      ? {
          title: "Use the user's own API subscriptions",
          body: "Best for hosted quality. Add one or more provider API keys, save, then test. A ChatGPT or Claude consumer subscription is separate from API billing.",
          steps: [
            "Create an API key in OpenAI, Anthropic, or Google AI Studio.",
            "Paste only the providers this user wants billed to their own account.",
            "Save and test, then check Council voice preview before submitting.",
          ],
        }
      : path === "gateway"
        ? {
            title: "Use a managed team gateway",
            body: "Best for public or team deployments. The gateway owns provider routing, policy, and billing so end users do not manage provider keys.",
            steps: [
              "Enter the gateway URL supplied by the app owner or team.",
              "Paste the optional gateway token if the gateway requires one.",
              "Save and test gateway health before running Council.",
            ],
          }
        : {
            title: "Use local or no hosted-key mode",
            body: "Best for offline reading or users who already have Claude Code configured locally. Ollama can support semantic retrieval, but Council voices still need Claude Code, a provider key, or a gateway.",
            steps: [
              "Use Claude Code login if available for Claude voice and synthesis.",
              "Set an Ollama host if local semantic retrieval should be tested.",
              "Run the setup test so skipped voices are visible before Council use.",
            ],
          };

  return (
    <div>
      <p className="text-sm font-medium text-neutral-100">{details.title}</p>
      <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{details.body}</p>
      <ol className="mt-3 grid gap-2">
        {details.steps.map((step, index) => (
          <li key={step} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm text-neutral-300">
            <span className="grid place-items-center h-6 w-6 rounded-full bg-neutral-900 text-xs text-amber-200 border border-neutral-800">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SetupCheckPill({
  label,
  state,
  detail,
}: {
  label: string;
  state: "ok" | "warning" | "pending";
  detail: string;
}) {
  const tone =
    state === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : state === "warning"
        ? "border-red-500/25 bg-red-500/10 text-red-200"
        : "border-neutral-800 bg-neutral-950/35 text-neutral-300";
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <p className="text-xs tracking-wider opacity-75">{label}</p>
      <p className="text-sm mt-0.5">{detail}</p>
    </div>
  );
}

export function ProviderMiniStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-neutral-300">{label}</span>
      <span
        className={
          "text-[11px] px-2 py-0.5 rounded " +
          (active
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-neutral-900 text-neutral-500")
        }
      >
        {active ? "set" : "not set"}
      </span>
    </div>
  );
}

export function SourceStatusBadge({ status }: { status: DataSourceStatus }) {
  const label =
    status === "bundled" ? "Bundled" : status === "deferred" ? "Deferred" : "User-imported";
  const tone =
    status === "bundled"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "deferred"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-sky-500/15 text-sky-300";
  return <span className={`text-[11px] px-2 py-0.5 rounded ${tone}`}>{label}</span>;
}

export function ProviderStatusCard({
  label,
  configured,
  status,
  detail,
}: {
  label: string;
  configured: boolean;
  status?: boolean;
  detail?: string | null;
}) {
  const state =
    status === undefined ? (configured ? "configured" : "missing") : status ? "ok" : "check";
  return (
    <div className="soft-card px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-200">{label}</p>
        <span
          className={
            "text-[11px] px-2 py-0.5 rounded " +
            (state === "ok"
              ? "bg-emerald-500/15 text-emerald-300"
              : state === "configured"
                ? "bg-sky-500/15 text-sky-300"
                : state === "check"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-neutral-800 text-neutral-500")
          }
        >
          {state}
        </span>
      </div>
      {detail && <p className="text-xs text-neutral-500 mt-1">{detail}</p>}
    </div>
  );
}

export function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-card px-3 py-2">
      <p className="text-xs tracking-wider text-neutral-500">{label}</p>
      <p className="text-sm text-neutral-300 mt-1">{value}</p>
    </div>
  );
}

export function DiagnosticRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <p className="text-neutral-200">{label}</p>
        {detail && <p className="text-xs text-neutral-500 mt-0.5">{detail}</p>}
      </div>
      <span
        className={
          "text-xs px-2 py-0.5 rounded " +
          (ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/10 text-red-300")
        }
      >
        {ok ? "ok" : "check"}
      </span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
