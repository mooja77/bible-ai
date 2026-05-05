import type { Book } from "../../lib/bible";

interface Props {
  books: Book[];
  selectedBookId: number | null;
  onSelect: (book: Book) => void;
}

export function BookList({ books, selectedBookId, onSelect }: Props) {
  const ot = books.filter((b) => b.testament === "OT");
  const nt = books.filter((b) => b.testament === "NT");

  return (
    <div className="flex flex-col gap-4 text-sm">
      <Section title="Old Testament" books={ot} selectedBookId={selectedBookId} onSelect={onSelect} />
      <Section title="New Testament" books={nt} selectedBookId={selectedBookId} onSelect={onSelect} />
    </div>
  );
}

function Section({
  title,
  books,
  selectedBookId,
  onSelect,
}: {
  title: string;
  books: Book[];
  selectedBookId: number | null;
  onSelect: (book: Book) => void;
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{title}</h3>
      <ul className="space-y-0.5">
        {books.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              onClick={() => onSelect(book)}
              className={
                "w-full text-left px-2 py-1 rounded transition-colors " +
                (book.id === selectedBookId
                  ? "bg-amber-500/20 text-amber-200"
                  : "hover:bg-neutral-800 text-neutral-200")
              }
            >
              {book.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
