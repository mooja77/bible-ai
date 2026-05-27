import type { Translation, Verse } from "../../lib/bible";
import type { ReaderDensity } from "./types";

export function InterleavedReader({
  bookName,
  chapter,
  translations,
  chapterData,
  loading,
  fontScale,
  density,
  onJumpToVerse,
}: {
  bookName: string;
  chapter: number;
  translations: Translation[];
  chapterData: Record<string, Verse[]>;
  loading: boolean;
  fontScale: number;
  density: ReaderDensity;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const primary = translations[0];
  const primaryVerses = primary ? (chapterData[primary.code] ?? []) : [];
  const verseNumbers = Array.from(
    new Set(
      translations.flatMap((t) => (chapterData[t.code] ?? []).map((v) => v.verse)),
    ),
  ).sort((a, b) => a - b);

  return (
    <article
      data-testid="interleaved-reader"
      className={
        "reader-panel max-w-5xl mx-auto " +
        (density === "compact" ? "px-4 py-5" : "px-6 py-8")
      }
    >
      <header
        className={
          "border-b border-neutral-800 " +
          (density === "compact" ? "mb-4 pb-3" : "mb-6 pb-4")
        }
      >
        <h1
          className={
            "font-semibold text-neutral-100 " +
            (density === "compact" ? "text-2xl" : "text-3xl")
          }
        >
          {bookName} {chapter}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          {translations.map((t) => t.code).join(" / ")}
        </p>
      </header>

      {loading ? (
        <div className="space-y-3" aria-label="Loading chapter">
          <div className="h-4 w-5/6 rounded bg-neutral-800/70 animate-pulse" />
          <div className="h-4 w-11/12 rounded bg-neutral-800/50 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-neutral-800/40 animate-pulse" />
        </div>
      ) : primaryVerses.length === 0 ? (
        <p className="text-neutral-500 italic">No verses for this chapter.</p>
      ) : (
        <div className={density === "compact" ? "space-y-2" : "space-y-4"}>
          {verseNumbers.map((verseNo) => {
            const anchor =
              primaryVerses.find((v) => v.verse === verseNo) ??
              translations
                .flatMap((t) => chapterData[t.code] ?? [])
                .find((v) => v.verse === verseNo);
            return (
              <section
                key={verseNo}
                id={anchor ? `v-${anchor.verse_id}` : undefined}
                data-testid="interleaved-verse"
                className={
                  "soft-card grid " +
                  (density === "compact"
                    ? "grid-cols-[2.75rem_1fr] gap-2 px-3 py-2"
                    : "grid-cols-[3.5rem_1fr] gap-3 px-4 py-3")
                }
              >
                <button
                  type="button"
                  onClick={() => anchor && onJumpToVerse(anchor.verse_id, primary.code)}
                  className="text-left text-xs font-mono text-amber-300 hover:text-amber-200"
                >
                  {verseNo}
                </button>
                <div className={density === "compact" ? "space-y-1.5" : "space-y-2.5"}>
                  {translations.map((t) => {
                    const verse = (chapterData[t.code] ?? []).find((v) => v.verse === verseNo);
                    return (
                      <div
                        key={t.code}
                        className={
                          "grid gap-3 " +
                          (density === "compact"
                            ? "grid-cols-[3rem_1fr]"
                            : "grid-cols-[4rem_1fr]")
                        }
                      >
                        <span className="font-mono text-xs text-neutral-500">{t.code}</span>
                        <p
                          className={
                            "text-neutral-200 " +
                            (density === "compact"
                              ? "text-sm leading-snug"
                              : "text-base leading-relaxed")
                          }
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: `${fontScale}em`,
                          }}
                        >
                          {verse?.text ?? ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}
