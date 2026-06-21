/** The asked question, rendered in serif and centered — the editorial header
 *  of the Council canvas. Presentational only. */
export function CouncilQuestion({ question }: { question: string }) {
  if (!question.trim()) return null;
  return (
    <p
      className="font-serif text-xl sm:text-2xl text-neutral-100 text-center leading-snug"
      style={{ fontFamily: "var(--font-serif)" }}
    >
      {question}
    </p>
  );
}
