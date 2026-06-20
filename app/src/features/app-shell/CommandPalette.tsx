import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type CommandItem = {
  id: string;
  label: string;
  detail: string;
  run: () => void;
  category?: string;
  icon?: ReactNode;
};

const DEFAULT_CATEGORY = "Commands";

// Forgiving fuzzy scorer: case-insensitive, subsequence + token-overlap aware.
// Returns 0 for no match (caller hides those), higher = better.
function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const haystack = text.toLowerCase();

  let score = 0;

  // Strong signal: contiguous substring (and a prefix bonus).
  const idx = haystack.indexOf(q);
  if (idx === 0) score += 120;
  else if (idx > 0) score += 80;

  // Token overlap: each query token that appears in the text.
  const queryTokens = q.split(/\s+/).filter(Boolean);
  const textTokens = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of queryTokens) {
    if (textTokens.some((t) => t.startsWith(token))) score += 30;
    else if (textTokens.some((t) => t.includes(token))) score += 18;
  }

  // Subsequence: every query char appears in order ("lnk" -> "link").
  // Reward adjacency so tighter matches rank higher.
  let cursor = 0;
  let lastHit = -1;
  let matched = 0;
  for (let i = 0; i < haystack.length && cursor < q.length; i += 1) {
    if (haystack[i] === q[cursor]) {
      matched += 1;
      if (lastHit >= 0 && i === lastHit + 1) score += 3;
      lastHit = i;
      cursor += 1;
    }
  }
  if (cursor === q.length) {
    // Full subsequence match — scale by how much of the query matched.
    score += 20 + matched;
  } else {
    // Incomplete subsequence with no substring/token hit means no match.
    if (score === 0) return 0;
  }

  return score;
}

export function CommandPalette({
  query,
  onQueryChange,
  items,
  onClose,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  items: CommandItem[];
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Rank items by fuzzy score against label + detail; hide zero-score.
  const ranked = useMemo(() => {
    const q = query.trim();
    const scored = items
      .map((item) => ({
        item,
        score: fuzzyScore(q, `${item.label} ${item.detail}`),
      }))
      .filter((entry) => entry.score > 0);
    if (q) scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.item).slice(0, 40);
  }, [items, query]);

  // Group preserving the (already ranked) order; flatten gives the nav order.
  const groups = useMemo(() => {
    const order: string[] = [];
    const byCategory = new Map<string, CommandItem[]>();
    for (const item of ranked) {
      const category = item.category ?? DEFAULT_CATEGORY;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
        order.push(category);
      }
      byCategory.get(category)!.push(item);
    }
    return order.map((category) => ({ category, items: byCategory.get(category)! }));
  }, [ranked]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  const runSelected = () => {
    const selected = flat[selectedIndex] ?? flat[0];
    if (!selected) return;
    selected.run();
    onClose();
  };

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center px-4 pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="surface-panel w-full max-w-xl rounded-lg overflow-hidden shadow-2xl"
        style={{
          animation: "command-palette-in 110ms cubic-bezier(0,0,0.2,1)",
        }}
      >
        <style>
          {`@keyframes command-palette-in {
            from { opacity: 0; transform: translateY(-6px) scale(0.99); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }`}
        </style>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "Enter") {
              event.preventDefault();
              runSelected();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedIndex((index) => Math.min(flat.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((index) => Math.max(0, index - 1));
            }
          }}
          placeholder="Search commands, books, workspaces..."
          className="w-full bg-neutral-950/80 border-b border-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />
        {flat.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">No matching commands.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1" data-testid="command-palette-results">
            {groups.map((group) => (
              <div key={group.category}>
                <p className="px-4 pt-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-neutral-500">
                  {group.category}
                </p>
                <ul>
                  {group.items.map((item) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const active = selectedIndex === index;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            item.run();
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={
                            "flex w-full items-center gap-3 px-4 py-2 text-left " +
                            (active
                              ? "bg-amber-500/15 text-amber-100"
                              : "text-neutral-300 hover:bg-neutral-900")
                          }
                          style={active ? { boxShadow: "inset 2px 0 0 var(--accent)" } : undefined}
                        >
                          {item.icon ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-neutral-400">
                              {item.icon}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{item.label}</span>
                            <span className="block truncate text-xs text-neutral-500">
                              {item.detail}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
