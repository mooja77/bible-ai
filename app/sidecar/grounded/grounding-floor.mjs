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
 * @property {number} citation_accuracy        in-corpus citations / total citations
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

  // Each position that cites anything must cite at least one in-corpus verse.
  const uncited_positions = [];
  for (const p of arr(synthesis?.positions)) {
    const pcited = collectCitedVerseIds({ positions: [p] });
    if (pcited.length > 0 && !pcited.some((c) => ids.has(c.verse_id))) {
      uncited_positions.push(typeof p?.label === "string" && p.label ? p.label : "(unlabelled)");
    }
  }

  const cited_count = cited.length;
  const citation_accuracy = cited_count === 0 ? 1 : inCorpus / cited_count;
  const hard_fail =
    outOfCorpus.size > 0 || citation_accuracy < floor || uncited_positions.length > 0;

  return {
    hard_fail,
    citation_accuracy,
    out_of_corpus_verse_ids: [...outOfCorpus],
    violations,
    uncited_positions,
    cited_count,
    in_corpus_count: inCorpus,
  };
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
    "## GROUNDING FAILURE — you cited verses that are NOT in the provided evidence.",
    `These verse_ids do not exist in the evidence set and MUST be removed or replaced: ${ids}.`,
    "Re-issue the SAME synthesis but cite ONLY verse_ids that appear in the evidence above.",
    "Do not invent or recall verses from memory. If a position can no longer cite an in-evidence verse, fold it into dissent_notes or unresolved_tensions instead of listing it as a position.",
  ];
  if (report.uncited_positions.length > 0) {
    lines.push(
      `These positions have no in-evidence citation and must be re-grounded or removed: ${report.uncited_positions.join("; ")}.`,
    );
  }
  return lines.join("\n");
}
