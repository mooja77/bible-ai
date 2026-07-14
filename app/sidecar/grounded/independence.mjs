// Grounded Council — Stage 3: EVIDENCE-ROUTE DIVERSITY (Channel B, advisory).
//
// Multiple providers are not statistically independent evidence of truth. This
// deterministic report asks the narrower, observable question: when provider
// analyses land on the same position, do they cite distinct verse sets or reuse
// the same proof-texts? Over-counting shared routes inflates confidence.
//
// This is deterministic and flags-only (never blocks): it ranks each position's
// agreement as distinct / overlapping / single_source.

/** Normalize a position label for order-independent comparison. */
function normalizeLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Loose label match: equal or one contains the other (mirrors the UI matrix). */
function labelsOverlap(a, b) {
  const first = normalizeLabel(a);
  const second = normalizeLabel(b);
  if (!first || !second) return false;
  return first === second || first.includes(second) || second.includes(first);
}

/** Cited verse_ids for a single voice position: supporting ids + evidence ids. */
function citedIds(position) {
  const ids = [];
  if (Array.isArray(position?.supporting_evidence_ids)) {
    ids.push(...position.supporting_evidence_ids);
  }
  if (Array.isArray(position?.evidence)) {
    ids.push(...position.evidence.map((e) => e?.verse_id));
  }
  const out = new Set();
  for (const raw of ids) {
    const id = Number(raw);
    if (Number.isSafeInteger(id) && id > 0) out.add(id);
  }
  return [...out];
}

function jaccard(aSet, bSet) {
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter += 1;
  const union = aSet.size + bSet.size - inter;
  return union === 0 ? 0 : inter / union;
}

function meanPairwiseJaccard(sets) {
  if (sets.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      total += jaccard(sets[i], sets[j]);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

/** Verses cited by EVERY supporter (the shared proof-texts). */
function intersectAll(sets) {
  const nonEmpty = sets.filter((s) => s.size > 0);
  if (nonEmpty.length === 0) return [];
  let acc = new Set(nonEmpty[0]);
  for (let i = 1; i < nonEmpty.length; i += 1) {
    acc = new Set([...acc].filter((x) => nonEmpty[i].has(x)));
  }
  return [...acc];
}

/** Count distinct non-empty citation signatures = distinct evidence routes. */
function distinctRoutes(idLists) {
  const sigs = new Set();
  for (const ids of idLists) {
    if (ids.length === 0) continue;
    sigs.add([...ids].sort((a, b) => a - b).join(","));
  }
  return sigs.size;
}

// A position whose supporters' citation sets overlap at or above this share is
// treated as an overlapping rather than distinct route.
const ECHO_OVERLAP_THRESHOLD = 0.67;

function analysePosition(position, okVoices) {
  const labels = [position?.label, ...(position?.source_position_labels ?? [])].filter(Boolean);
  const supporters = [];
  for (const v of okVoices) {
    const match = v.result.positions.find((p) => labels.some((l) => labelsOverlap(p.label, l)));
    if (match) supporters.push({ provider: v.provider, ids: citedIds(match) });
  }
  const n = supporters.length;
  const label = position?.label ?? "";

  if (n <= 1) {
    return {
      label,
      supporting_voice_count: n,
      distinct_route_count: n === 1 && supporters[0].ids.length > 0 ? 1 : 0,
      shared_verse_ids: [],
      mean_overlap: 0,
      route_classification: "single_source",
      note:
        n === 1
          ? "Only one provider voice argued this position — no second evidence route to compare."
          : "No provider analysis argued this synthesized position.",
    };
  }

  const sets = supporters.map((s) => new Set(s.ids));
  const meanOverlap = meanPairwiseJaccard(sets);
  const shared = intersectAll(sets);
  const routes = distinctRoutes(supporters.map((s) => s.ids));
  const routeDiverse = routes >= 2 && meanOverlap < ECHO_OVERLAP_THRESHOLD;

  return {
    label,
    supporting_voice_count: n,
    distinct_route_count: routes,
    shared_verse_ids: shared,
    mean_overlap: Math.round(meanOverlap * 100) / 100,
    route_classification: routeDiverse ? "distinct" : "overlapping",
    note: routeDiverse
      ? `${n} provider analyses converge from ${routes} distinct evidence routes.`
      : `${n} voices agree but lean on the same ${shared.length || "few"} proof-text${
          shared.length === 1 ? "" : "s"
        } — agreement may reflect a shared evidence route rather than distinct support.`,
  };
}

function summarise(positions) {
  const counts = { distinct: 0, overlapping: 0, single_source: 0 };
  for (const position of positions) {
    counts[position.route_classification] = (counts[position.route_classification] ?? 0) + 1;
  }
  const note =
    counts.overlapping > 0
      ? `${counts.overlapping} position${counts.overlapping === 1 ? "" : "s"} rest on shared proof-texts — treat this as overlapping evidence routes, not extra corroboration.`
      : counts.distinct > 0
        ? "Some provider agreement uses distinct evidence routes; this is diversity of support, not statistical independence."
        : "Agreement could not be compared for evidence-route diversity.";
  return {
    distinct_count: counts.distinct,
    overlapping_count: counts.overlapping,
    single_source_count: counts.single_source,
    note,
  };
}

/**
 * Assess the diversity of cited evidence routes per synthesized position.
 * @returns {{available: boolean, positions: Array, distinct_count: number,
 *   overlapping_count: number, single_source_count: number, note: string}}
 */
export function buildEvidenceRouteDiversityReport(synthesis, voices) {
  const positions = Array.isArray(synthesis?.positions) ? synthesis.positions : [];
  const okVoices = (Array.isArray(voices) ? voices : []).filter(
    (v) => v?.result && Array.isArray(v.result.positions),
  );
  // Route diversity is only meaningful when more than one voice could agree.
  if (positions.length === 0 || okVoices.length < 2) {
    return {
      available: false,
      positions: [],
      distinct_count: 0,
      overlapping_count: 0,
      single_source_count: 0,
      note:
        okVoices.length < 2
          ? "Evidence-route diversity needs at least two provider analyses to compare."
          : "No positions to assess for evidence-route diversity.",
    };
  }
  const reportPositions = positions.map((p) => analysePosition(p, okVoices));
  return { available: true, positions: reportPositions, ...summarise(reportPositions) };
}

export const __test = {
  citedIds,
  jaccard,
  meanPairwiseJaccard,
  distinctRoutes,
  labelsOverlap,
  ECHO_OVERLAP_THRESHOLD,
};
