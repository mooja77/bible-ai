import { useState } from "react";
import {
  deleteCouncilSession,
  type CouncilSessionSummary,
} from "../../lib/bible";

interface Props {
  sessions: CouncilSessionSummary[];
  onSelect: (id: number) => void;
  onChanged: () => void; // called after delete so parent refreshes
}

export function CouncilHistory({ sessions, onSelect, onChanged }: Props) {
  if (sessions.length === 0) return null;
  return (
    <section className="border-t border-neutral-800 pt-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
        History ({sessions.length})
      </h3>
      <ul className="space-y-1">
        {sessions.map((s) => (
          <HistoryRow key={s.id} session={s} onSelect={onSelect} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function HistoryRow({
  session,
  onSelect,
  onChanged,
}: {
  session: CouncilSessionSummary;
  onSelect: (id: number) => void;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteCouncilSession(session.id);
      onChanged();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <li className="group">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-900/60 transition-colors">
        <button
          type="button"
          onClick={() => onSelect(session.id)}
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
          disabled={deleting}
          aria-label="Delete session"
          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 text-sm px-1 transition-opacity"
        >
          {deleting ? "…" : "×"}
        </button>
      </div>
    </li>
  );
}

/** Show a SQL "datetime('now')" UTC timestamp as a short relative form. */
function relativeTime(sqlTs: string): string {
  // SQLite returns 'YYYY-MM-DD HH:MM:SS' in UTC. Treat as UTC.
  const iso = sqlTs.replace(" ", "T") + "Z";
  const then = new Date(iso).getTime();
  const now = Date.now();
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
