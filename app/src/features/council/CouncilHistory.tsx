import { useState } from "react";
import {
  deleteCouncilSession,
  type CouncilSessionSummary,
} from "../../lib/bible";

interface Props {
  sessions: CouncilSessionSummary[];
  onSelect: (id: number) => void;
  onChanged: (deletedId: number) => void; // called after a confirmed delete
  disabled?: boolean;
}

export function CouncilHistory({ sessions, onSelect, onChanged, disabled = false }: Props) {
  if (sessions.length === 0) return null;
  return (
    <section className="border-t border-neutral-800 pt-4">
      <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
        History ({sessions.length})
      </h3>
      <ul className="space-y-1">
        {sessions.map((s) => (
          <HistoryRow
            key={s.id}
            session={s}
            onSelect={onSelect}
            onChanged={onChanged}
            disabled={disabled}
          />
        ))}
      </ul>
    </section>
  );
}

function HistoryRow({
  session,
  onSelect,
  onChanged,
  disabled,
}: {
  session: CouncilSessionSummary;
  onSelect: (id: number) => void;
  onChanged: (deletedId: number) => void;
  disabled: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteCouncilSession(session.id);
      onChanged(session.id);
    } catch (error) {
      setDeleteError(`Could not delete this session: ${String(error)}`);
      setDeleting(false);
    }
  };

  return (
    <li className="group">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-900/60 transition-colors">
        <button
          type="button"
          onClick={() => onSelect(session.id)}
          disabled={disabled}
          className="flex-1 text-left text-sm text-neutral-200 truncate"
          title={session.question}
        >
          <span className="text-xs text-neutral-500 mr-2 font-mono">
            {relativeTime(session.created_at)}
          </span>
          {session.question}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || deleting}
          aria-label="Delete session"
          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-neutral-500 hover:text-red-400 text-sm px-1 transition-opacity"
        >
          {deleting ? "…" : "×"}
        </button>
      </div>
      {deleteError ? (
        <p role="alert" className="px-2 pb-1 text-xs text-red-300">
          {deleteError}
        </p>
      ) : null}
    </li>
  );
}

/** Show a SQL "datetime('now')" UTC timestamp as a short relative form. */
export function relativeTime(sqlTs: string, now = Date.now()): string {
  const value = sqlTs.trim();
  // SQLite returns 'YYYY-MM-DD HH:MM:SS' without a zone. Imported backups may
  // already contain a complete ISO timestamp, so only append Z to SQLite's
  // exact naive-UTC shape.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return value || "Unknown time";
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
