import type { SearchStrategy } from "../../lib/bible";

const OPTIONS: Array<{ value: SearchStrategy; label: string; hint: string }> = [
  { value: "keyword", label: "Keyword", hint: "Exact word matches" },
  { value: "semantic", label: "Meaning", hint: "Related by meaning (needs Ollama)" },
  { value: "hybrid", label: "Both", hint: "Keyword and meaning combined" },
];

interface Props {
  value: SearchStrategy;
  onChange: (value: SearchStrategy) => void;
}

export function SearchStrategyControl({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Search mode"
      className="flex rounded-md border border-[color:var(--border-subtle)] overflow-hidden text-xs"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.hint}
            data-testid={`search-strategy-${opt.value}`}
            className={
              "flex-1 px-2 py-1 transition-colors " +
              (active
                ? "bg-amber-500/15 text-amber-300 font-medium"
                : "text-neutral-400 hover:text-neutral-200")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
