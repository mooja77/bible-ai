import { useEffect, useState } from "react";

// Benign browser noise that should never alarm the user.
const IGNORED_PATTERNS = ["ResizeObserver loop"];

function describe(value: unknown): string {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === "string") return value;
  if (value == null) return "Unknown error";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function GlobalErrorNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const show = (raw: string) => {
      const text = raw.trim();
      if (!text || IGNORED_PATTERNS.some((p) => text.includes(p))) return;
      setMessage(text);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      show(describe(event.reason));
    };
    const onError = (event: ErrorEvent) => {
      console.error("Uncaught error:", event.error ?? event.message);
      show(describe(event.error ?? event.message));
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  // Auto-dismiss the current message after a comfortable delay.
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="alert"
      data-testid="global-error-notice"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-red-900/60 bg-red-950/90 px-4 py-3 text-sm text-red-200 shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold mb-1">Unexpected error</p>
          <p className="whitespace-pre-wrap break-words">{message}</p>
        </div>
        <button
          type="button"
          data-testid="global-error-dismiss"
          onClick={() => setMessage(null)}
          className="shrink-0 text-xs text-red-100 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
