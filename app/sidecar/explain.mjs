export function explainPassage({ passage = [] } = {}) {
  const citation = formatPassageCitation(passage);
  return {
    citation,
    summary: `${citation} is presented in its immediate textual context. Read the surrounding chapter before building a doctrine from the passage alone.`,
    context: "This explanation mode is intentionally concise and distinct from the Council workflow. Use Council for disputed theological questions.",
    key_terms: [],
    cross_references: [],
    cautions: ["Check genre, speaker, covenant context, and surrounding argument."],
  };
}

export function formatPassageCitation(passage = []) {
  if (!Array.isArray(passage) || passage.length === 0) return "Passage";
  const start = passage[0];
  const end = passage[passage.length - 1];
  if (passage.length === 1) return formatVerseRef(start);

  const startBook = verseBook(start);
  const endBook = verseBook(end);
  const startChapter = verseNumberPart(start?.chapter, "?");
  const endChapter = verseNumberPart(end?.chapter, "?");
  const startVerse = verseNumberPart(start?.verse, "?");
  const endVerse = verseNumberPart(end?.verse, "?");

  if (startBook === endBook && startChapter === endChapter) {
    return `${startBook} ${startChapter}:${startVerse}-${endVerse}`;
  }
  if (startBook === endBook) {
    return `${startBook} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
  }
  return `${formatVerseRef(start)}-${formatVerseRef(end)}`;
}

function formatVerseRef(value) {
  return `${verseBook(value)} ${verseNumberPart(value?.chapter, "?")}:${verseNumberPart(
    value?.verse,
    "?",
  )}`;
}

function verseBook(value) {
  return typeof value?.book_name === "string" && value.book_name.trim()
    ? value.book_name.trim()
    : "Passage";
}

function verseNumberPart(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? String(value) : fallback;
}
