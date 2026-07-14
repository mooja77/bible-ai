import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "release/content-review.json");
const lock = JSON.parse(readFileSync(resolve("../data/corpus-lock.json"), "utf8"));
const template = {
  reviewer: "",
  reviewer_role: "",
  completed_at: "",
  decision_reference: "",
  target_territories: [],
  distribution_channels: [],
  release_scope: {
    model: "free_noncommercial",
    free_of_charge: true,
    paid_access: false,
    subscriptions: false,
    advertising: false,
    bundled_content_sales: false,
    scope_change_requires_new_review: true,
  },
  approved_for_public_distribution: false,
  sources: lock.artifacts.map((artifact) => ({
    source_id: artifact.id,
    locked_version: artifact.version,
    locked_checksum: artifact.sha256 ?? artifact.aggregate_sha256,
    evidence_refs: [artifact.source_url, "../../docs/reviews/content-rights-evidence-dossier.md"],
    lock_license_label: artifact.license,
    license_conclusion: "",
    redistribution_scope: "",
    attribution_text: artifact.attribution,
    obligations: [],
    license_confirmed: false,
    redistribution_confirmed: false,
    attribution_confirmed: false,
    notes: "",
  })),
  notes: [
    "Human rights review only; do not paste private legal correspondence here.",
    "Confirm trademark/naming constraints and export attribution as well as the base license.",
    "decision_reference should identify the signed review memo, ticket, or counsel docket without embedding privileged advice.",
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
console.log(`Wrote content review template: ${outputPath}`);
