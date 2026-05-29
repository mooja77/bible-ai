import { useState } from "react";
import type { CouncilResponse } from "../../lib/bible";

export function CouncilSourceDrawer({ response }: { response: CouncilResponse }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("response");
  const [copied, setCopied] = useState<"tab" | "full" | null>(null);
  const tabs = [
    ["response", "Response JSON", response],
    ["synthesis", "Synthesis", response.synthesis],
    ["voices", "Provider voices", response.voices],
    ["retrieval", "Retrieval options", response.retrieval_options ?? {}],
    ["evidence", "Retrieved evidence", response.retrieved_evidence ?? []],
    ["manifest", "Provider manifest", response.manifest],
  ] as const;
  const current = tabs.find(([key]) => key === active) ?? tabs[0];
  const json = JSON.stringify(current[2], null, 2);
  const fullJson = JSON.stringify(response, null, 2);

  const onCopy = async (value: string, scope: "tab" | "full") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(scope);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard API may be unavailable */
    }
  };

  return (
    <section className="border-t border-neutral-800 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm tracking-wider text-neutral-400">
            Source Data
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Structured data stored for audit, debugging, and export verification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="px-2 py-1 rounded border border-neutral-800 text-xs text-neutral-300 hover:border-neutral-700"
        >
          {open ? "Hide source data" : "View source data"}
        </button>
      </div>
      {open && (
        <div
          className="border border-neutral-800 rounded mt-3 overflow-hidden"
          data-testid="council-source-drawer"
        >
          <div className="flex items-center gap-1 flex-wrap p-2 border-b border-neutral-800 bg-neutral-950">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={
                  "px-2 py-1 rounded text-xs " +
                  (active === key
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300")
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onCopy(json, "tab")}
              className="ml-auto px-2 py-1 rounded border border-neutral-800 text-xs text-neutral-300"
            >
              {copied === "tab" ? "Copied tab" : "Copy tab"}
            </button>
            <button
              type="button"
              onClick={() => onCopy(fullJson, "full")}
              className="px-2 py-1 rounded border border-neutral-800 text-xs text-neutral-300"
            >
              {copied === "full" ? "Copied full JSON" : "Copy full JSON"}
            </button>
          </div>
          <pre
            className="max-h-96 overflow-auto p-3 text-xs text-neutral-300 whitespace-pre-wrap"
            data-testid="council-source-json"
          >
            {json}
          </pre>
        </div>
      )}
    </section>
  );
}
