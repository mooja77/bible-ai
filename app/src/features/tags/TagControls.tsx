import { useState } from "react";
import type { Tag, ItemTag } from "../../lib/bible";

export function TagFilterBar({
  allTags,
  selectedTagId,
  onSelect,
}: {
  allTags: Tag[];
  selectedTagId: number | null;
  onSelect: (id: number | null) => void;
}) {
  if (allTags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mb-2" data-testid="bookmark-tag-filter">
      {allTags.map((t) => {
        const active = selectedTagId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(active ? null : t.id)}
            aria-pressed={active}
            className={
              "px-1.5 py-0.5 rounded text-[0.6875rem] border transition-colors " +
              (active
                ? "border-amber-500 text-amber-200 bg-amber-500/10"
                : "border-neutral-700 text-neutral-400 hover:text-neutral-200")
            }
          >
            {t.name}
          </button>
        );
      })}
      {selectedTagId !== null && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="px-1 text-[0.6875rem] text-neutral-500 hover:text-neutral-300"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function ItemTagRow({
  testIdPrefix,
  tags,
  allTags,
  onAttach,
  onDetach,
}: {
  testIdPrefix: string;
  tags: ItemTag[];
  allTags: Tag[];
  onAttach: (name: string) => void;
  onDetach: (tagId: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const datalistId = `tag-options-${testIdPrefix}`;

  const submit = () => {
    const name = value.trim();
    setValue("");
    setAdding(false);
    if (name) onAttach(name);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {tags.map((t) => (
        <span
          key={t.tag_id}
          data-testid={`${testIdPrefix}-tag-chip`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] bg-neutral-800 text-neutral-300"
        >
          {t.name}
          <button
            type="button"
            onClick={() => onDetach(t.tag_id)}
            aria-label={`Remove tag ${t.name}`}
            className="text-neutral-500 hover:text-red-400"
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <>
          <input
            autoFocus
            list={datalistId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                setValue("");
                setAdding(false);
              }
            }}
            onBlur={submit}
            placeholder="tag…"
            aria-label="Add tag"
            data-testid={`${testIdPrefix}-tag-input`}
            className="settings-input h-5 w-20 text-[0.6875rem] px-1"
          />
          <datalist id={datalistId}>
            {allTags.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Add tag"
          data-testid={`${testIdPrefix}-add-tag`}
          className="px-1 text-[0.6875rem] text-neutral-500 hover:text-amber-300"
        >
          + tag
        </button>
      )}
    </div>
  );
}
