import type { CouncilResponse } from "../../lib/bible";

export function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  const chunks = splitHighlightedText(text, terms);
  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.highlight ? (
          <mark key={`${chunk.text}-${index}`}>{chunk.text}</mark>
        ) : (
          <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
        ),
      )}
    </>
  );
}

function splitHighlightedText(text: string, terms: string[]) {
  const usefulTerms = normalizedHighlightTerms(text, terms);
  if (usefulTerms.length === 0) return [{ text, highlight: false }];
  const pattern = new RegExp(`(${usefulTerms.map(escapeRegExp).join("|")})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlight: usefulTerms.some((term) => part.toLowerCase() === term.toLowerCase()),
    }));
}

function normalizedHighlightTerms(text: string, terms: string[]) {
  const lowerText = text.toLowerCase();
  const seen = new Set<string>();
  return terms
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
    .filter((term) => !COMMON_QUERY_WORDS.has(term.toLowerCase()))
    .filter((term) => lowerText.includes(term.toLowerCase()))
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
}

export function buildEvidenceTermsByVerse(response: CouncilResponse) {
  const termsByVerse = new Map<number, string[]>();
  for (const evidence of response.retrieved_evidence ?? []) {
    if (evidence.matched_terms && evidence.matched_terms.length > 0) {
      termsByVerse.set(evidence.verse_id, evidence.matched_terms);
    }
  }
  return termsByVerse;
}

export function buildRetrievedCitationByVerse(response: CouncilResponse) {
  const citationByVerse = new Map<number, string>();
  for (const evidence of response.retrieved_evidence ?? []) {
    citationByVerse.set(
      evidence.verse_id,
      `${evidence.book_name} ${evidence.chapter}:${evidence.verse}`,
    );
  }
  return citationByVerse;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMMON_QUERY_WORDS = new Set([
  "the",
  "and",
  "for",
  "what",
  "does",
  "with",
  "that",
  "this",
  "from",
  "about",
  "into",
  "unto",
  "shall",
]);
