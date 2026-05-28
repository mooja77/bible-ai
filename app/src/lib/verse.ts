import type { Book } from "./bible";

export function formatVerseId(verseId: number, books: Book[]) {
  const bookId = Math.floor(verseId / 1_000_000);
  const chapter = Math.floor((verseId % 1_000_000) / 1000);
  const verse = verseId % 1000;
  const book = books.find((b) => b.id === bookId);
  return `${book?.name ?? `Book ${bookId}`} ${chapter}:${verse}`;
}

export function parseReference(input: string, books: Book[]) {
  const match = input.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/);
  if (!match) return null;
  const [, rawBook, rawChapter, rawVerse, rawEndChapter, rawEndVerse] = match;
  const normalizedBook = normalizeReferenceBook(rawBook);
  const book = [...books]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => {
      const names = [
        b.name,
        b.osis_code,
        b.name.replace(/^(\d)\s+/, "$1"),
        b.name.replace(/^(\d)\s+/, "$1 "),
      ];
      return names.some((name) => normalizeReferenceBook(name) === normalizedBook);
    });
  if (!book) return null;
  const chapter = Number(rawChapter);
  const verse = Number(rawVerse ?? "1");
  const endChapter = Number(rawEndChapter ?? rawChapter);
  const endVerse = Number(rawEndVerse ?? rawVerse ?? "1");
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapter_count) return null;
  if (!Number.isInteger(endChapter) || endChapter < chapter || endChapter > book.chapter_count) {
    return null;
  }
  if (!Number.isInteger(verse) || verse < 1 || verse > 999) return null;
  if (!Number.isInteger(endVerse) || endVerse < 1 || endVerse > 999) return null;
  if (endChapter === chapter && endVerse < verse) return null;
  const endVerseId = book.id * 1_000_000 + endChapter * 1000 + endVerse;
  return {
    book,
    chapter,
    endChapter,
    verseId: book.id * 1_000_000 + chapter * 1000 + verse,
    endVerseId,
    citation:
      endVerseId > book.id * 1_000_000 + chapter * 1000 + verse
        ? endChapter === chapter
          ? `${book.name} ${chapter}:${verse}-${endVerse}`
          : `${book.name} ${chapter}:${verse}-${endChapter}:${endVerse}`
        : `${book.name} ${chapter}:${verse}`,
  };
}

function normalizeReferenceBook(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
