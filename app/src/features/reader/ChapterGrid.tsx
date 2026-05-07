interface Props {
  chapterCount: number;
  selectedChapter: number | null;
  onSelect: (chapter: number) => void;
}

export function ChapterGrid({ chapterCount, selectedChapter, onSelect }: Props) {
  const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-8 gap-1">
      {chapters.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          className={
            "text-xs py-1 rounded-md transition-colors " +
            (n === selectedChapter
              ? "bg-amber-500/25 text-amber-100"
              : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800")
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}
