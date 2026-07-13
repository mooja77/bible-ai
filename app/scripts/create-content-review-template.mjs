import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "release/content-review.json");
const lock = JSON.parse(readFileSync(resolve("../data/corpus-lock.json"), "utf8"));
const template = {
  reviewer: "",
  reviewer_role: "",
  completed_at: "",
  target_territories: [],
  approved_for_public_distribution: false,
  sources: lock.artifacts.map((artifact) => ({
    source_id: artifact.id,
    license_confirmed: false,
    redistribution_confirmed: false,
    attribution_confirmed: false,
    notes: "",
  })),
  notes: [
    "Human rights review only; do not paste private legal correspondence here.",
    "Confirm trademark/naming constraints and export attribution as well as the base license.",
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
console.log(`Wrote content review template: ${outputPath}`);
