import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      args.set(key.slice(2), value);
      index += 1;
    }
  }
  return args;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function text(value, fallback = "Not supplied.") {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  return fallback;
}

function list(values, render = (value) => text(value)) {
  if (!Array.isArray(values) || values.length === 0) return "- None recorded.";
  return values.map((value) => `- ${render(value)}`).join("\n");
}

function citation(evidence) {
  const book = evidence?.book_name ?? evidence?.book_osis ?? "Unknown";
  const chapter = evidence?.chapter ?? "?";
  const verse = evidence?.verse ?? "?";
  return `${book} ${chapter}:${verse}`;
}

function providerSection(voice) {
  const result = voice?.result ?? {};
  const positions = Array.isArray(result.positions) ? result.positions : [];
  const tensions = Array.isArray(result.unresolved_tensions) ? result.unresolved_tensions : [];
  const lines = [
    `#### ${text(voice?.display_name, text(voice?.provider, "Unnamed provider"))}`,
    "",
    `- Status: ${text(voice?.status, "unknown")}`,
    `- Confidence stated by provider: ${text(result.confidence, "not supplied")}`,
    "",
    "Provider synthesis:",
    "",
    text(result.synthesis),
    "",
    "Provider confidence rationale:",
    "",
    text(result.confidence_rationale),
    "",
    "Provider positions:",
    "",
    list(positions, (position) => {
      const weight = Number.isFinite(position?.weight) ? ` (${(position.weight * 100).toFixed(1)}%)` : "";
      return `**${text(position?.label, "Unnamed position")}**${weight}: ${text(position?.summary)}`;
    }),
    "",
    "Provider dissent:",
    "",
    text(result.dissent_notes),
    "",
    "Provider unresolved tensions:",
    "",
    list(tensions),
  ];
  if (voice?.error) lines.push("", `Provider error: ${text(String(voice.error))}`);
  return lines.join("\n");
}

function caseSection(result, reviewCase, index) {
  const response = result?.response ?? {};
  const synthesis = response.synthesis ?? {};
  const confidence = response.soft_layer?.confidence ?? {};
  const evidence = Array.isArray(result?.evidence) ? result.evidence : [];
  const positions = Array.isArray(synthesis.positions) ? synthesis.positions : [];
  const voices = Array.isArray(response.voices) ? response.voices : [];
  const judge = response.judge ?? {};
  const killTest = response.kill_test ?? {};
  const tensions = Array.isArray(synthesis.unresolved_tensions) ? synthesis.unresolved_tensions : [];
  const reasons = Array.isArray(confidence.reasons) ? confidence.reasons : [];
  const flags = Array.isArray(result?.weakness_flags) ? result.weakness_flags : [];

  return [
    `## ${index + 1}. ${text(result?.question, "Untitled case")}`,
    "",
    `- Case ID: \`${text(reviewCase?.case_id, "missing")}\``,
    `- System-adjusted band: **${text(reviewCase?.system_adjusted_band, "missing")}**`,
    `- Method: \`${text(reviewCase?.system_method, "missing")}\``,
    `- Grounding: ${text(response.grounding?.verification_status, "unknown")} (${response.grounding?.citation_accuracy ?? "n/a"} citation accuracy)`,
    `- Weakness flags: ${flags.length === 0 ? "none" : flags.join(", ")}`,
    "",
    "### Retrieved evidence",
    "",
    list(evidence, (item) => `**${citation(item)} (${text(item?.translation_code, "unknown translation")}; ${text(item?.source, "unknown route")})** — ${text(item?.text)}`),
    "",
    "### Provider analyses",
    "",
    voices.length > 0 ? voices.map(providerSection).join("\n\n") : "No provider analyses recorded.",
    "",
    "### Final synthesis",
    "",
    text(synthesis.synthesis),
    "",
    "Final positions:",
    "",
    list(positions, (position) => {
      const weight = Number.isFinite(position?.weight) ? ` (${(position.weight * 100).toFixed(1)}%)` : "";
      return `**${text(position?.label, "Unnamed position")}**${weight}: ${text(position?.summary)} Why not higher: ${text(position?.why_not_higher)}`;
    }),
    "",
    "Dissent notes:",
    "",
    text(synthesis.dissent_notes),
    "",
    "Unresolved tensions:",
    "",
    list(tensions),
    "",
    "Final confidence rationale:",
    "",
    text(synthesis.confidence_rationale),
    "",
    "### Independent challenge checks",
    "",
    `- Cross-family judge verdict: **${text(judge.verdict, "unavailable")}**; balance preserved: ${judge.balance_preserved ?? "unknown"}`,
    `- Judge notes: ${text(judge.notes)}`,
    `- Judge overreach findings: ${Array.isArray(judge.overreach) && judge.overreach.length > 0 ? judge.overreach.join("; ") : "none"}`,
    `- Kill test: target **${text(killTest.target_label, "unavailable")}**; survives: ${killTest.survives ?? "unknown"}; severity: ${text(killTest.severity, "unknown")}`,
    `- Strongest counter: ${text(killTest.strongest_counter)}`,
    `- Vulnerable claim: ${text(killTest.vulnerable_claim)}`,
    "",
    "System adjustment reasons:",
    "",
    list(reasons),
    "",
    "### Human decision to record in council-confidence-review.json",
    "",
    "- `human_band`: contested / low / moderate / high",
    "- `confidence_humility_score`: 0 / 1 / 2",
    "- `blocking_issue`: true / false",
    "- `reviewer_notes`: explain the label, material omissions, and any required correction",
  ].join("\n");
}

function createPacket(payload, review, fixtureRelative, fixtureSha256) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const reviewCases = Array.isArray(review?.cases) ? review.cases : [];
  if (results.length !== reviewCases.length) {
    throw new Error(`Review has ${reviewCases.length} cases but fixture has ${results.length}.`);
  }
  if (review?.source_fixture?.sha256 !== fixtureSha256) {
    throw new Error("Review source SHA-256 does not match the fixture.");
  }
  for (const [index, result] of results.entries()) {
    const reviewCase = reviewCases[index];
    const expectedId = String(result?.slug ?? result?.case_id ?? `case-${String(index + 1).padStart(3, "0")}`);
    const adjusted = result?.response?.soft_layer?.confidence?.adjusted ?? result?.response?.soft_layer?.confidence?.calibrated ?? null;
    if (reviewCase?.case_id !== expectedId || reviewCase?.question !== (result?.question ?? "")) {
      throw new Error(`Review case ${index + 1} does not match the fixture identity or question.`);
    }
    if (reviewCase?.system_adjusted_band !== adjusted) {
      throw new Error(`Review case ${index + 1} does not match the fixture's adjusted band.`);
    }
  }

  const sections = results.map((result, index) => caseSection(result, reviewCases[index], index));
  return [
    "# Council confidence-adjustment human review packet",
    "",
    "This is a readable projection of the identity-bound real-provider fixture. The reviewer records decisions in `release/council-confidence-review.json`; this packet is evidence, not the signed decision.",
    "",
    `- Source fixture: \`${fixtureRelative.replaceAll("\\", "/")}\``,
    `- Source SHA-256: \`${fixtureSha256}\``,
    `- Cases: ${results.length}`,
    `- Evaluation: \`${text(review?.evaluation_name)}\``,
    "",
    "## Reviewer rubric",
    "",
    "The band evaluates whether the system's confidence treatment is appropriately cautious and evidence-responsive. It does not grade denominational correctness or estimate the probability of theological truth.",
    "",
    "- **contested:** defensible readings or material challenges prevent a stable confidence priority.",
    "- **low:** the answer has substantial evidence, coverage, or reasoning weaknesses that materially limit reliance.",
    "- **moderate:** the answer is substantially grounded and useful but retains meaningful disclosed limitations.",
    "- **high:** direct evidence and challenge checks strongly support the answer, with no material unresolved weakness.",
    "",
    "Humility score:",
    "",
    "- **0:** important dissent, limitations, or change conditions are hidden or materially understated.",
    "- **1:** major limitations are visible, but the treatment is incomplete or uneven.",
    "- **2:** dissent, limitations, vulnerable claims, and change conditions are clear and proportionate.",
    "",
    "Set `blocking_issue` to true for unsafe, materially ungrounded, or seriously misleading output. Review the retrieved evidence, both provider analyses, final synthesis, judge findings, and kill test before assigning a label.",
    "",
    ...sections,
    "",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const reviewPath = resolve(appRoot, args.get("review") ?? "release/council-confidence-review.json");
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  const fixturePath = resolve(appRoot, args.get("fixture") ?? review?.source_fixture?.path ?? "");
  const outputPath = resolve(appRoot, args.get("out") ?? "release/council-confidence-review-packet.md");
  const fixtureBytes = readFileSync(fixturePath);
  const fixtureSha256 = sha256(fixtureBytes);
  const payload = JSON.parse(fixtureBytes.toString("utf8"));
  const packet = createPacket(payload, review, relative(appRoot, fixturePath), fixtureSha256);

  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, packet, "utf8");
  renameSync(temporaryPath, outputPath);
  console.log(`Created confidence review packet for ${payload.results.length} case(s): ${outputPath}`);
}

main();
