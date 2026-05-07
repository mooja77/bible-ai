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
      <h3 className="nav-section-title mb-2">{title}</h3>
      <ul className="space-y-0.5">
        {books.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              onClick={() => onSelect(book)}
              className={
                "w-full text-left px-2.5 py-1.5 rounded-md transition-colors " +
                (book.id === selectedBookId
                  ? "bg-amber-500/15 text-amber-100"
                  : "hover:bg-neutral-800/80 text-neutral-300")
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
