export function LoadingState({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return <p className={`text-neutral-500 italic text-sm ${className}`}>{label}</p>;
}

export function EmptyState({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return <p className={`text-neutral-500 italic text-sm ${className}`}>{message}</p>;
}

export function ErrorState({
  message,
  title = "Error",
  className = "",
}: {
  message: string;
  title?: string | null;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300 ${className}`}
    >
      {title ? <p className="font-semibold mb-1">{title}</p> : null}
      {/* whitespace-pre-wrap preserves newlines in raw error strings, in the app font (not monospace) */}
      <div className="whitespace-pre-wrap">{message}</div>
    </div>
  );
}
