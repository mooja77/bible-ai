// Grounded Council — Stage 4: the SOFT LAYER (Channel B, advisory, deterministic).
//
// TRIANGULON keeps the trust-critical floor (Channel A) separate from a soft layer
// that may only RANK / FLAG, never block. This module is that soft layer's
// deterministic core for the Council. It composes the signals the earlier stages
// already produced — grounding (Channel A), the cross-family judge, and the
// evidence-route diversity report — plus inter-voice disagreement, into three honest outputs:
//
//   1. semantic_entropy  — how much the voices actually diverge (0 = consensus).
//   2. confidence_adjustment — the model's stated confidence, READ DOWN when the
//      support uses overlapping evidence routes, the floor flagged ungrounded
//      citations, the judge was unsure, or the voices diverge. This is a
//      deterministic heuristic, not empirical calibration against labelled outcomes.
//   3. tick — an integrity checklist (grounded? corroborated? dissent kept?
//      cross-examined? limits disclosed? uncertainty surfaced?).
//
// The kill-test skeptic (an adversarial LLM refutation pass) is the soft layer's
// one non-deterministic member and is intentionally orchestrated separately in
// kill-test.mjs because it needs a live provider.

function normalizeLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function labelsOverlap(a, b) {
  const first = normalizeLabel(a);
  const second = normalizeLabel(b);
  if (!first || !second) return false;
  return first === second || first.includes(second) || second.includes(first);
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Highest-weight position (the leading view). */
function topPosition(positions) {
  if (!Array.isArray(positions) || positions.length === 0) return null;
  return positions.reduce((best, p) =>
    (Number(p?.weight) || 0) > (Number(best?.weight) || 0) ? p : best,
  );
}

/**
 * Inter-voice disagreement as normalized Shannon entropy over the position each
 * voice favors (clustered by label). 0 = every voice favors the same view;
 * → 1 = voices split evenly across distinct views. Needs ≥2 voices.
 */
export function semanticEntropy(voices) {
  const ok = (Array.isArray(voices) ? voices : []).filter(
    (v) => v?.result && Array.isArray(v.result.positions) && v.result.positions.length > 0,
  );
  if (ok.length < 2) {
    return { available: false, value: null, label: "not enough voices", voice_count: ok.length, clusters: 0 };
  }
  const favored = ok.map((v) => topPosition(v.result.positions)?.label).filter(Boolean);
  const clusters = [];
  for (const label of favored) {
    const hit = clusters.find((c) => labelsOverlap(c.key, label));
    if (hit) hit.count += 1;
    else clusters.push({ key: label, count: 1 });
  }
  const total = favored.length;
  const k = clusters.length;
  let value = 0;
  if (k > 1) {
    let h = 0;
    for (const c of clusters) {
      const p = c.count / total;
      h -= p * Math.log(p);
    }
    value = h / Math.log(k); // normalize to 0..1
  }
  value = round2(value);
  const label = value === 0 ? "consensus" : value < 0.66 ? "some divergence" : "high divergence";
  return { available: true, value, label, voice_count: total, clusters: k };
}

const LEVEL_SCORE = { high: 3, medium: 2, low: 1 };
const SCORE_BAND = (s) => (s >= 3 ? "high" : s === 2 ? "moderate" : s === 1 ? "low" : "contested");
const BAND_RANK = { contested: 0, low: 1, moderate: 2, high: 3 };

/**
 * Adjust stated confidence DOWN for the soft-layer signals. Advisory only; the
 * output is not a calibrated probability or an empirically validated score.
 */
export function adjustConfidence({ stated, leaderRouteDiversity, grounding, judge, entropy, killTest }) {
  const statedScore = LEVEL_SCORE[stated] ?? 2;
  let score = statedScore;
  const reasons = [];

  if (grounding?.hard_fail) {
    score -= 2;
    reasons.push("the grounding floor flagged ungrounded citations");
  }
  if (killTest?.available && killTest?.parsed) {
    if (killTest.severity === "fatal") {
      score -= 2;
      reasons.push("an adversarial kill-test found a fatal objection to the leading view");
    } else if (killTest.severity === "serious") {
      score -= 1;
      reasons.push("an adversarial kill-test found a serious objection to the leading view");
    }
  }
  if (judge?.available && judge?.parsed) {
    if (judge.verdict === "unsound") {
      score -= 2;
      reasons.push("the cross-family judge found it unsound");
    } else if (judge.verdict === "mixed") {
      score -= 1;
      reasons.push("the cross-family judge had mixed findings");
    }
  }
  if (leaderRouteDiversity) {
    const classification = leaderRouteDiversity.route_classification ?? leaderRouteDiversity.independence;
    if (classification === "overlapping" || classification === "correlated") {
      score -= 1;
      reasons.push("the leading view's support is correlated (shared proof-texts), not independent");
    } else if (classification === "single_source") {
      score -= 1;
      reasons.push("the leading view rests on a single voice");
    }
  }
  if (typeof entropy === "number" && entropy >= 0.66) {
    score -= 1;
    reasons.push("the voices diverge substantially");
  }

  const band = SCORE_BAND(score);
  const statedBand = SCORE_BAND(statedScore);
  return {
    stated: stated ?? null,
    adjusted: band,
    empirically_calibrated: false,
    method: "deterministic_read_down_v1",
    downgraded: BAND_RANK[band] < BAND_RANK[statedBand],
    reasons,
  };
}

function buildTick({ synthesis, leader, leaderRouteDiversity, grounding, judge, entropy }) {
  const positionCount = Array.isArray(synthesis?.positions) ? synthesis.positions.length : 0;
  const checks = [
    {
      id: "grounded",
      label: "Citations grounded in the evidence",
      pass: !grounding?.hard_fail,
      detail: grounding?.hard_fail
        ? `${grounding.out_of_corpus_verse_ids?.length ?? 0} citation(s) not in the retrieved evidence`
        : "every cited verse is in the retrieved evidence",
    },
    {
      id: "corroborated",
      label: "Leading view supported by distinct evidence routes",
      pass:
        (leaderRouteDiversity?.route_classification ?? leaderRouteDiversity?.independence) ===
        "distinct" || leaderRouteDiversity?.independence === "independent",
      detail: leaderRouteDiversity
        ? `evidence-route status is ${(leaderRouteDiversity.route_classification ?? leaderRouteDiversity.independence).replace("_", " ")}`
        : "evidence-route diversity could not be assessed",
    },
    {
      id: "dissent_preserved",
      label: "Dissent preserved",
      pass: positionCount >= 2,
      detail: `${positionCount} position(s) kept in the final answer`,
    },
    {
      id: "cross_examined",
      label: "Cross-examined by a different model family",
      pass: !!(judge?.available && judge?.parsed),
      detail: judge?.available ? `judged by ${judge.judge_provider ?? "another family"}` : "no cross-family judge ran",
    },
    {
      id: "limits_disclosed",
      label: "Limits & weak points disclosed",
      pass: !!(leader?.weakest_link || leader?.what_would_change_this),
      detail: leader?.weakest_link || leader?.what_would_change_this ? "weakest link / change conditions stated" : "no limits stated",
    },
    {
      id: "uncertainty_surfaced",
      label: "Uncertainty across voices surfaced",
      pass: !!entropy?.available,
      detail: entropy?.available ? `voices: ${entropy.label}` : "single voice — no spread to measure",
    },
  ];
  return checks;
}

/**
 * Assemble the deterministic soft layer. Pure; always resolves. Composes the
 * grounding / judge / evidence-route reports already on the response with
 * inter-voice entropy into a confidence adjustment + an integrity checklist.
 */
export function buildSoftLayer({ synthesis, voices, grounding, judge, evidenceRouteDiversity, killTest }) {
  const positions = Array.isArray(synthesis?.positions) ? synthesis.positions : [];
  if (positions.length === 0) {
    return { available: false };
  }
  const leader = topPosition(positions);
  const leaderRouteDiversity =
    leader && Array.isArray(evidenceRouteDiversity?.positions)
      ? evidenceRouteDiversity.positions.find((p) => labelsOverlap(p.label, leader.label)) ?? null
      : null;
  const entropy = semanticEntropy(voices);
  const confidence = adjustConfidence({
    stated: synthesis?.confidence ?? null,
    leaderRouteDiversity,
    grounding,
    judge,
    entropy: entropy.value,
    killTest,
  });
  const tick = buildTick({ synthesis, leader, leaderRouteDiversity, grounding, judge, entropy });
  const tick_passed = tick.filter((c) => c.pass).length;
  return {
    available: true,
    semantic_entropy: entropy,
    confidence,
    tick,
    tick_passed,
    tick_total: tick.length,
  };
}

export const __test = { semanticEntropy, adjustConfidence, topPosition, labelsOverlap };
