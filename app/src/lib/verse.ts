import type { Book } from "./bible";

export function formatVerseId(verseId: number, books: Book[]) {
  const bookId = Math.floor(verseId / 1_000_000);
  const chapter = Math.floor((verseId % 1_000_000) / 1000);
  const verse = verseId % 1000;
  const book = books.find((b) => b.id === bookId);
  return `${book?.name ?? `Book ${bookId}`} ${chapter}:${verse}`;
}
