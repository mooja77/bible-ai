import { useEffect, useRef, useState } from "react";

export type CommandItem = {
  id: string;
  label: string;
  detail: string;
  run: () => void;
};

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

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const runSelected = () => {
    const selected = items[selectedIndex] ?? items[0];
    if (!selected) return;
    selected.run();
    onClose();
  };

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
      <div className="surface-panel w-full max-w-xl rounded-lg overflow-hidden">
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
              setSelectedIndex((index) => Math.min(items.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((index) => Math.max(0, index - 1));
            }
          }}
          placeholder="Search commands, books, workspaces..."
          className="w-full bg-neutral-950/80 border-b border-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">No matching commands.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1" data-testid="command-palette-results">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={
                    "w-full text-left px-4 py-2 " +
                    (selectedIndex === index
                      ? "bg-amber-500/15 text-amber-100"
                      : "text-neutral-300 hover:bg-neutral-900")
                  }
                >
                  <span className="block text-sm">{item.label}</span>
                  <span className="block text-xs text-neutral-500">{item.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
