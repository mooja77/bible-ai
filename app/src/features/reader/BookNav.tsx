import { useEffect } from "react";
import type { Book } from "../../lib/bible";
import { BookList } from "./BookList";
import { ChapterGrid } from "./ChapterGrid";

interface BookNavProps {
  open: boolean;
  onClose: () => void;
  books: Book[];
  selectedBookId: number | null;
  selectedChapter: number | null;
  selectedBook: Book | null;
  onSelectBook: (book: Book) => void;
  onSelectChapter: (chapter: number) => void;
}

/**
 * Left slide-in drawer that hosts book + chapter navigation on demand. This is
 * the additive replacement for the persistent sidebar's BookList/ChapterGrid;
 * the sidebar copies remain until T7 removes them. Closes on backdrop click,
 * Escape, and after a chapter is picked so the user lands in the reader.
 */
export function BookNav({
  open,
  onClose,
  books,
  selectedBookId,
  selectedChapter,
  selectedBook,
  onSelectBook,
  onSelectChapter,
}: BookNavProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        data-testid="book-nav"
        role="dialog"
        aria-label="Book navigation"
        className="book-nav surface-panel absolute left-0 top-12 bottom-0 z-10 flex w-[260px] flex-col border-r border-neutral-800"
        style={{
          animation: "book-nav-slide-in 150ms cubic-bezier(0,0,0.2,1)",
        }}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <BookList
            books={books}
            selectedBookId={selectedBookId}
            onSelect={onSelectBook}
          />
        </div>
        {selectedBook && (
          <div className="border-t border-neutral-800 p-4">
            <h3 className="nav-section-title mb-2">
              {selectedBook.name} · Chapters
            </h3>
            <ChapterGrid
              chapterCount={selectedBook.chapter_count}
              selectedChapter={selectedChapter}
              onSelect={(chapter) => {
                onSelectChapter(chapter);
                onClose();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
