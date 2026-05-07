import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search (press / )"
        className="settings-input pr-8 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 text-sm px-1"
        >
          ×
        </button>
      )}
    </div>
  );
}
