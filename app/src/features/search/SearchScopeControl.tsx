export type SearchScope = "scripture" | "notes";

const OPTIONS: Array<{ value: SearchScope; label: string }> = [
  { value: "scripture", label: "Scripture" },
  { value: "notes", label: "My notes" },
];

interface Props {
  value: SearchScope;
  onChange: (value: SearchScope) => void;
}

export function SearchScopeControl({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Search scope"
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
            data-testid={`search-scope-${opt.value}`}
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
