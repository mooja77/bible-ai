import type { Book } from "./bible";

export function formatVerseId(verseId: number, books: Book[]) {
  const bookId = Math.floor(verseId / 1_000_000);
  const chapter = Math.floor((verseId % 1_000_000) / 1000);
  const verse = verseId % 1000;
  const book = books.find((b) => b.id === bookId);
  return `${book?.name ?? `Book ${bookId}`} ${chapter}:${verse}`;
}

function resolveBook(rawBook: string, books: Book[]): Book | undefined {
  const normalizedBook = normalizeReferenceBook(rawBook);
  if (!normalizedBook) return undefined;
  return [...books]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => {
      const names = [
        b.name,
        b.osis_code,
        b.name.replace(/^(\d)\s+/, "$1"),
        b.name.replace(/^(\d)\s+/, "$1 "),
        // People overwhelmingly type the singular form when citing one psalm
        // ("Psalm 23"), while the corpus book name is the canonical "Psalms".
        ...(b.name === "Psalms" ? ["Psalm"] : []),
      ];
      return names.some((name) => normalizeReferenceBook(name) === normalizedBook);
    });
}

export function parseReference(input: string, books: Book[]) {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/);
  if (!match) {
    // No chapter given (e.g. "John", "1 John") — open the book at chapter 1 if
    // the whole input resolves to a known book.
    const bookOnly = resolveBook(trimmed, books);
    if (!bookOnly) return null;
    return {
      book: bookOnly,
      chapter: 1,
      endChapter: 1,
      verseId: bookOnly.id * 1_000_000 + 1 * 1000 + 1,
      endVerseId: bookOnly.id * 1_000_000 + 1 * 1000 + 1,
      citation: `${bookOnly.name} 1`,
    };
  }
  const [, rawBook, rawChapter, rawVerse, rawEndChapter, rawEndVerse] = match;
  const book = resolveBook(rawBook, books);
  if (!book) return null;
  // A bare chapter reference ("John 3") has no verse — navigate to the top of
  // the chapter (verse 1) and cite the chapter, not "John 3:1".
  const chapterOnly = rawVerse === undefined;
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
  const verseId = book.id * 1_000_000 + chapter * 1000 + verse;
  const endVerseId = book.id * 1_000_000 + endChapter * 1000 + endVerse;
  return {
    book,
    chapter,
    endChapter,
    verseId,
    endVerseId,
    citation: chapterOnly
      ? `${book.name} ${chapter}`
      : endVerseId > verseId
        ? endChapter === chapter
          ? `${book.name} ${chapter}:${verse}-${endVerse}`
          : `${book.name} ${chapter}:${verse}-${endChapter}:${endVerse}`
        : `${book.name} ${chapter}:${verse}`,
  };
}

function normalizeReferenceBook(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
