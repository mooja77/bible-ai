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
