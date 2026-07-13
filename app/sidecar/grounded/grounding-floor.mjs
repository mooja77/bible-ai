// Grounded Council — Channel A: the deterministic GROUNDING FLOOR.
//
// The only mechanism allowed to force a regen / mark a run ungrounded. It is
// purely deterministic (no LLM): every verse_id the synthesis cites — in any
// position's evidence, supporting/challenging ids, argument-map nodes, or the
// evidence_classification — MUST be a member of the retrieved evidence set. A
// citation to a verse that was never retrieved is a hallucinated reference.
//
// This mirrors TRIANGULON's Stage-1 floor (membership oracle), with verse_id as
// the membership key instead of web numbers/hosts.

import { buildEvidenceSet } from "./evidence-set.mjs";

const arr = (v) => (Array.isArray(v) ? v : []);

function pushId(out, rawId, position, field) {
  const id = Number(rawId);
  if (Number.isSafeInteger(id) && id > 0) out.push({ verse_id: id, position, field });
}

/**
 * Every verse_id the synthesis cites, with where it was cited (for audit + regen).
 * @returns {Array<{verse_id:number, position:string, field:string}>}
 */
export function collectCitedVerseIds(synthesis) {
  const cited = [];
  for (const p of arr(synthesis?.positions)) {
    const label = typeof p?.label === "string" && p.label ? p.label : "(unlabelled)";
    for (const e of arr(p?.evidence)) pushId(cited, e?.verse_id, label, "evidence");
    for (const id of arr(p?.supporting_evidence_ids)) pushId(cited, id, label, "supporting");
    for (const id of arr(p?.challenging_evidence_ids)) pushId(cited, id, label, "challenging");
    for (const node of arr(p?.argument_map?.nodes)) {
      for (const id of arr(node?.verse_ids)) pushId(cited, id, label, "argument_map");
    }
  }
  for (const c of arr(synthesis?.evidence_classification)) {
    pushId(cited, c?.verse_id, "(classification)", "evidence_classification");
  }
  return cited;
}

/**
 * @typedef {Object} GroundingReport
 * @property {boolean} hard_fail
 * @property {number|null} citation_accuracy   in-corpus citations / total citations; null when absent
 * @property {"verified"|"failed"|"unverifiable"} verification_status
 * @property {number[]} out_of_corpus_verse_ids
 * @property {Array<{verse_id:number,position:string,field:string,reason:string}>} violations
 * @property {string[]} uncited_positions      positions whose only citations are out-of-corpus
 * @property {number} cited_count
 * @property {number} in_corpus_count
 * @property {number} [regen_attempts]
 */

/**
 * Adjudicate a synthesis against the retrieved evidence.
 * HARD-FAIL if ANY cited verse_id is absent from the corpus, OR citation_accuracy
 * is below the floor, OR a position's only citations are all out-of-corpus.
 *
 * @param {object} synthesis  a CouncilResult
 * @param {Array} evidence    retrieved_evidence rows
 * @param {{citationAccuracyFloor?: number}} [opts]
 * @returns {GroundingReport}
 */
export function runGroundingFloor(synthesis, evidence, opts = {}) {
  const floor = typeof opts.citationAccuracyFloor === "number" ? opts.citationAccuracyFloor : 0.95;
  const { ids } = buildEvidenceSet(evidence);
  const cited = collectCitedVerseIds(synthesis);

  const violations = [];
  const outOfCorpus = new Set();
  let inCorpus = 0;
  for (const c of cited) {
    if (ids.has(c.verse_id)) {
      inCorpus++;
    } else {
      outOfCorpus.add(c.verse_id);
      violations.push({ ...c, reason: "verse_id not present in retrieved evidence" });
    }
  }

  // A correct verse_id with a fabricated quotation is still an ungrounded
  // claim. Verify visible quotations against the exact retrieved corpus row.
  const evidenceById = new Map(
    arr(evidence).map((row) => [Number(row?.verse_id), row]),
  );
  for (const p of arr(synthesis?.positions)) {
    const label = typeof p?.label === "string" && p.label ? p.label : "(unlabelled)";
    for (const entry of arr(p?.evidence)) {
      const id = Number(entry?.verse_id);
      const row = evidenceById.get(id);
      if (!row) continue; // membership violation already recorded above
      const claimed = normaliseQuote(entry?.quote);
      const canonical = normaliseQuote(row?.text);
      if (!claimed || !canonical || !canonical.includes(claimed)) {
        violations.push({
          verse_id: id,
          position: label,
          field: "evidence.quote",
          reason: !claimed
            ? "citation quote is missing"
            : "citation quote does not match retrieved corpus text",
        });
      }
    }
  }

  // Every asserted position must cite at least one in-corpus verse. Absence is
  // unverifiable, never perfect accuracy.
  const uncited_positions = [];
  for (const p of arr(synthesis?.positions)) {
    const pcited = collectCitedVerseIds({ positions: [p] });
    if (!pcited.some((c) => ids.has(c.verse_id))) {
      uncited_positions.push(typeof p?.label === "string" && p.label ? p.label : "(unlabelled)");
    }
  }

  const cited_count = cited.length;
  const citation_accuracy = cited_count === 0 ? null : inCorpus / cited_count;
  const unverifiable = cited_count === 0;
  const hard_fail =
    unverifiable ||
    outOfCorpus.size > 0 ||
    violations.length > 0 ||
    citation_accuracy < floor ||
    uncited_positions.length > 0;

  return {
    hard_fail,
    verification_status: unverifiable ? "unverifiable" : hard_fail ? "failed" : "verified",
    citation_accuracy,
    out_of_corpus_verse_ids: [...outOfCorpus],
    violations,
    uncited_positions,
    cited_count,
    in_corpus_count: inCorpus,
  };
}

function normaliseQuote(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, " ")
    .trim();
}

/** Replace model-rendered quotations with the authoritative retrieved text. */
export function hydrateEvidenceQuotes(synthesis, evidence) {
  if (!synthesis || !Array.isArray(synthesis.positions)) return synthesis;
  const evidenceById = new Map(
    arr(evidence).map((row) => [Number(row?.verse_id), row]),
  );
  for (const position of synthesis.positions) {
    for (const entry of arr(position?.evidence)) {
      const row = evidenceById.get(Number(entry?.verse_id));
      if (!row) continue;
      entry.quote = row.text;
      entry.citation = `${row.book_name} ${row.chapter}:${row.verse}`;
      entry.translation_code = row.translation_code;
      entry.quote_source = "retrieved_corpus";
    }
  }
  return synthesis;
}

/**
 * A precise instruction for the synthesizer to repair an ungrounded draft —
 * naming exactly the verse_ids it must drop or replace. Fed to a regen pass.
 * @param {GroundingReport} report
 */
export function buildRegenNote(report) {
  const ids = report.out_of_corpus_verse_ids.join(", ");
  const lines = [
    "",
    "## GROUNDING FAILURE — the draft is not verifiable against the provided evidence.",
    "Re-issue the SAME synthesis but cite ONLY verse_ids that appear in the evidence above.",
    "Every listed position must include at least one citation and its quote must be copied exactly from the supplied evidence text.",
    "Do not invent or recall verses from memory. If a position can no longer cite an in-evidence verse, fold it into dissent_notes or unresolved_tensions instead of listing it as a position.",
  ];
  if (ids) {
    lines.splice(
      2,
      0,
      `These verse_ids do not exist in the evidence set and MUST be removed or replaced: ${ids}.`,
    );
  }
  if (report.uncited_positions.length > 0) {
    lines.push(
      `These positions have no in-evidence citation and must be re-grounded or removed: ${report.uncited_positions.join("; ")}.`,
    );
  }
  return lines.join("\n");
}
