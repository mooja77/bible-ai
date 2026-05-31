import type {
  CouncilPosition,
  CouncilResponse,
  CouncilResult,
  RetrievedEvidence,
} from "../../lib/bible";
import { countVoiceMentions } from "./councilTransparency";

export function CouncilProcessView({ response }: { response: CouncilResponse }) {
  const synthesis = response.synthesis;
  const sortedPositions = [...synthesis.positions].sort((a, b) => b.weight - a.weight);
  const leader = sortedPositions[0] ?? null;
  const runnerUp = sortedPositions[1] ?? null;
  const successfulVoices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  const availableVoices = response.manifest.filter((provider) => provider.available);
  const classificationCounts = countEvidenceClassifications(
    response.retrieved_evidence ?? [],
    synthesis,
  );
  const leaderMentions = leader ? countVoiceMentions(successfulVoices, leader.label) : 0;
  const runnerUpMentions = runnerUp ? countVoiceMentions(successfulVoices, runnerUp.label) : 0;
  const comparisonReasons = buildComparisonReasons({
    leader,
    runnerUp,
    leaderMentions,
    runnerUpMentions,
    classificationCounts,
    voiceCount: successfulVoices.length,
  });

  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-process-view"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm tracking-wider text-neutral-400">
          How the Council reached this
        </h2>
        <span className="text-xs text-neutral-500">
          {successfulVoices.length}/{availableVoices.length || response.manifest.length} voices ran
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <ProcessMetric
          label="Evidence considered"
          value={String(response.evidence_count ?? response.retrieved_evidence?.length ?? 0)}
          detail={`${classificationCounts.used} used, ${classificationCounts.conflicting} conflicting`}
        />
        <ProcessMetric
          label="Independent voices"
          value={String(successfulVoices.length)}
          detail="Each available voice judged the same evidence before synthesis."
        />
        <ProcessMetric
          label="Preserved positions"
          value={String(sortedPositions.length)}
          detail="Lower-weighted views remain visible instead of being erased."
        />
      </div>

      <ol className="grid md:grid-cols-4 gap-2 mb-4">
        <ProcessStep
          number="1"
          title="Retrieve evidence"
          body="The app gathers candidate passages using the selected retrieval settings."
        />
        <ProcessStep
          number="2"
          title="Separate analysis"
          body="Each configured voice weighs defensible positions without seeing the other voices first."
        />
        <ProcessStep
          number="3"
          title="Cluster arguments"
          body="The synthesis groups equivalent positions, preserves dissent, and normalizes weights."
        />
        <ProcessStep
          number="4"
          title="Expose the audit"
          body="Citations, conflicting evidence, voice output, and unresolved tensions remain inspectable."
        />
      </ol>

      {leader && (
        <div className="soft-card p-4">
          <h3 className="text-sm font-semibold text-neutral-100 mb-2">
            Why this argument ranked higher
          </h3>
          <ArgumentComparison
            leader={leader}
            runnerUp={runnerUp}
            leaderMentions={leaderMentions}
            runnerUpMentions={runnerUpMentions}
            voiceCount={successfulVoices.length}
          />
          <ul className="mt-3 space-y-1 text-xs text-neutral-400">
            {comparisonReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProcessMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="soft-card px-3 py-2">
      <div className="text-xs tracking-wide text-neutral-500">{label}</div>
      <div className="text-lg font-semibold text-neutral-100">{value}</div>
      <p className="text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function ProcessStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li className="soft-card px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="grid place-items-center w-5 h-5 rounded-full bg-neutral-800 text-[0.6875rem] text-neutral-300">
          {number}
        </span>
        <span className="text-sm font-medium text-neutral-200">{title}</span>
      </div>
      <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
    </li>
  );
}

function ArgumentComparison({
  leader,
  runnerUp,
  leaderMentions,
  runnerUpMentions,
  voiceCount,
}: {
  leader: CouncilPosition;
  runnerUp: CouncilPosition | null;
  leaderMentions: number;
  runnerUpMentions: number;
  voiceCount: number;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <ArgumentSnapshot
        title="Leading argument"
        position={leader}
        mentions={leaderMentions}
        voiceCount={voiceCount}
      />
      {runnerUp ? (
        <ArgumentSnapshot
          title="Nearest alternative"
          position={runnerUp}
          mentions={runnerUpMentions}
          voiceCount={voiceCount}
        />
      ) : (
        <div className="border border-neutral-900 rounded px-3 py-2 text-sm text-neutral-500">
          No separate runner-up position was returned for this question.
        </div>
      )}
    </div>
  );
}

function ArgumentSnapshot({
  title,
  position,
  mentions,
  voiceCount,
}: {
  title: string;
  position: CouncilPosition;
  mentions: number;
  voiceCount: number;
}) {
  const pct = Math.round(position.weight * 100);
  return (
    <div className="border border-neutral-900 rounded px-3 py-2">
      <div className="text-xs tracking-wide text-neutral-500 mb-1">{title}</div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-100">{position.label}</span>
        <span className="font-mono text-sm text-amber-300">{pct}%</span>
      </div>
      <p className="text-xs text-neutral-500 mt-1">
        {position.evidence.length} cited passage{position.evidence.length === 1 ? "" : "s"};{" "}
        {mentions}/{voiceCount || 1} voice{voiceCount === 1 ? "" : "s"} named a matching view.
      </p>
    </div>
  );
}

function countEvidenceClassifications(evidence: RetrievedEvidence[], synthesis: CouncilResult) {
  const usedVerseIds = new Set(
    synthesis.positions.flatMap((position) =>
      position.evidence.map((entry) => entry.verse_id),
    ),
  );
  const counts = { used: 0, supporting: 0, conflicting: 0, ignored: 0 };
  const classifications = synthesis.evidence_classification ?? [];

  if (classifications.length === 0) {
    for (const item of evidence) {
      if (usedVerseIds.has(item.verse_id)) counts.used += 1;
      else counts.ignored += 1;
    }
    return counts;
  }

  for (const entry of classifications) {
    counts[entry.status] += 1;
  }
  return counts;
}

function buildComparisonReasons({
  leader,
  runnerUp,
  leaderMentions,
  runnerUpMentions,
  classificationCounts,
  voiceCount,
}: {
  leader: CouncilPosition | null;
  runnerUp: CouncilPosition | null;
  leaderMentions: number;
  runnerUpMentions: number;
  classificationCounts: Record<"used" | "supporting" | "conflicting" | "ignored", number>;
  voiceCount: number;
}) {
  if (!leader) return [];
  const reasons = [
    `The synthesis assigned "${leader.label}" the largest final weight after clustering the voices.`,
  ];
  if (runnerUp) {
    const gap = Math.round((leader.weight - runnerUp.weight) * 100);
    reasons.push(
      `It leads "${runnerUp.label}" by ${gap} percentage point${gap === 1 ? "" : "s"}.`,
    );
  }
  if (leaderMentions > runnerUpMentions) {
    reasons.push(
      `More independent voices named a matching view: ${leaderMentions}/${voiceCount || 1} versus ${runnerUpMentions}/${voiceCount || 1}.`,
    );
  }
  if (leader.evidence.length > (runnerUp?.evidence.length ?? 0)) {
    reasons.push("It carries more cited passages in the final synthesis than the nearest alternative.");
  }
  if (classificationCounts.conflicting > 0) {
    reasons.push(
      `${classificationCounts.conflicting} retrieved passage${classificationCounts.conflicting === 1 ? "" : "s"} remained visible as conflicting evidence, so the ranking is not hiding objections.`,
    );
  }
  return reasons;
}
