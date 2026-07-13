import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key.slice(2), next);
    i += 1;
  } else {
    args.set(key.slice(2), "true");
  }
}

const fixturePath = resolve(
  args.get("fixture") ?? "tests/fixtures/council-real-results.json",
);
const minQuestions = Number(args.get("min-questions") ?? 20);
const minProviders = Number(args.get("min-providers") ?? 2);
const requirePerQuestion = args.get("require-per-question") !== "false";
const requireGroundedStages = args.get("require-grounded-stages") !== "false";

const normalize = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase("und")
  .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, " ")
  .trim();

function explicitChapterRefs(question) {
  const refs = [];
  const pattern = /\b((?:[1-3]\s*)?[A-Z][a-z]+)\s+(\d{1,3})(?::\d{1,3})?/g;
  for (const match of String(question).matchAll(pattern)) {
    refs.push({ book: normalize(match[1]), chapter: Number(match[2]) });
  }
  return refs;
}

const failures = [];
if (!existsSync(fixturePath)) {
  failures.push(`fixture missing: ${fixturePath}`);
} else {
  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  if (payload.mock_mode !== false) failures.push("fixture must be non-mock");
  if (payload.complete !== true) failures.push("fixture must be a completed run");
  if ((payload.results ?? []).length < minQuestions) {
    failures.push(`expected at least ${minQuestions} results, found ${(payload.results ?? []).length}`);
  }
  if ((payload.errors ?? []).length > 0) {
    failures.push(`expected no sidecar request errors, found ${payload.errors.length}`);
  }

  const providerCounts = new Map();
  const groundedStageFailures = [];
  for (const result of payload.results ?? []) {
    const okVoices = (result.response?.voices ?? []).filter(
      (voice) => voice.status === "ok" && voice.provider !== "mock",
    );
    for (const voice of okVoices) {
      providerCounts.set(voice.provider, (providerCounts.get(voice.provider) ?? 0) + 1);
    }
    if (requirePerQuestion && okVoices.length < minProviders) {
      failures.push(
        `question "${result.question}" had ${okVoices.length} successful non-mock provider(s)`,
      );
    }

    if (requireGroundedStages) {
      const response = result.response ?? {};
      const evidence = response.retrieved_evidence ?? result.evidence ?? [];
      const label = result.slug ?? result.question;
      const missingStages = ["grounding", "scope", "judge", "soft_layer", "kill_test"]
        .filter((key) => !response[key]);
      if (!response.evidence_route_diversity && !response.independence) {
        missingStages.push("evidence_route_diversity");
      }
      if (missingStages.length) {
        groundedStageFailures.push(`${label}: missing ${missingStages.join(", ")}`);
      }
      if (!Array.isArray(evidence) || evidence.length === 0) {
        groundedStageFailures.push(`${label}: no persisted retrieved evidence`);
      }
      if (
        !response.grounding ||
        response.grounding.hard_fail !== false ||
        response.grounding.verification_status !== "verified" ||
        !(response.grounding.cited_count > 0)
      ) {
        groundedStageFailures.push(`${label}: grounding is not positively verified`);
      }
      const evidenceById = new Map(evidence.map((row) => [Number(row.verse_id), row]));
      for (const position of response.synthesis?.positions ?? []) {
        if (!Array.isArray(position.evidence) || position.evidence.length === 0) {
          groundedStageFailures.push(`${label}: position "${position.label}" has no visible evidence`);
          continue;
        }
        for (const citation of position.evidence) {
          const row = evidenceById.get(Number(citation.verse_id));
          if (!row || normalize(citation.quote) !== normalize(row.text)) {
            groundedStageFailures.push(
              `${label}: position "${position.label}" has a quote not hydrated from retrieved evidence`,
            );
          }
        }
      }
      for (const ref of explicitChapterRefs(result.question)) {
        const present = evidence.some(
          (row) => normalize(row.book_name) === ref.book && Number(row.chapter) === ref.chapter,
        );
        if (!present) {
          groundedStageFailures.push(
            `${label}: explicit primary passage ${ref.book} ${ref.chapter} was not retrieved`,
          );
        }
      }
    }
  }

  if (providerCounts.size < minProviders) {
    failures.push(
      `expected at least ${minProviders} successful providers across run, found ${providerCounts.size}`,
    );
  }

  const weakOutputCount = (payload.results ?? []).filter((result) =>
    (result.weakness_flags ?? []).some((flag) => flag !== "limited_provider_coverage"),
  ).length;
  if (weakOutputCount > 0) {
    failures.push(`${weakOutputCount} result(s) still have output-level weakness flags`);
  }
  if (groundedStageFailures.length > 0) {
    failures.push(
      `${groundedStageFailures.length} grounded-stage check(s) failed:\n  ${groundedStageFailures
        .slice(0, 25)
        .join("\n  ")}${groundedStageFailures.length > 25 ? "\n  …" : ""}`,
    );
  }

  if (failures.length === 0) {
    console.log("Real Council QA gate passed:");
    console.log(`- fixture: ${fixturePath}`);
    console.log(`- results: ${(payload.results ?? []).length}`);
    console.log(
      `- providers: ${Array.from(providerCounts.entries())
        .map(([provider, count]) => `${provider}=${count}`)
        .join(", ")}`,
    );
  }
}

if (failures.length > 0) {
  console.error("Real Council QA gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
