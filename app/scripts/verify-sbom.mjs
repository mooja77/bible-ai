import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const failures = [];
for (const file of ["sbom-npm.cdx.json", "sbom-cargo.cdx.json"]) {
  const path = resolve("release", file);
  if (!existsSync(path)) {
    failures.push(`missing ${path}`);
    continue;
  }
  const bom = JSON.parse(readFileSync(path, "utf8"));
  if (bom.bomFormat !== "CycloneDX") failures.push(`${file}: bomFormat must be CycloneDX`);
  if (!/^1\.[45]$/.test(String(bom.specVersion))) failures.push(`${file}: unsupported specVersion`);
  if (!Array.isArray(bom.components) || bom.components.length === 0) {
    failures.push(`${file}: components must not be empty`);
  }
  if (!bom.metadata?.timestamp || Number.isNaN(Date.parse(bom.metadata.timestamp))) {
    failures.push(`${file}: metadata.timestamp is invalid`);
  }
}

if (failures.length) {
  console.error("SBOM gate failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("SBOM gate passed.");
