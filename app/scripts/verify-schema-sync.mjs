import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rust = readFileSync(resolve("src-tauri/src/user_db.rs"), "utf8");
const schema = readFileSync(resolve("../data/schema.sql"), "utf8");
const importer = readFileSync(resolve("scripts/resources/import-resource-jsonl.mjs"), "utf8");

const version = Number(rust.match(/USER_SCHEMA_VERSION:\s*i64\s*=\s*(\d+)/)?.[1]);
const mirror = Number(schema.match(/mirrors USER_SCHEMA_VERSION=(\d+)/)?.[1]);
const emitted = Number(importer.match(/user_schema_version:\s*(\d+)/)?.[1]);
const failures = [];

if (!Number.isInteger(version)) failures.push("could not read USER_SCHEMA_VERSION from Rust");
if (mirror !== version) failures.push(`data/schema.sql says v${mirror}; runtime is v${version}`);
if (emitted !== version) failures.push(`resource importer emits v${emitted}; runtime is v${version}`);
for (const table of ["tags", "item_tags"]) {
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(schema)) {
    failures.push(`data/schema.sql is missing ${table}`);
  }
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(rust)) {
    failures.push(`runtime schema is missing ${table}`);
  }
}

if (failures.length) {
  console.error("Schema sync gate failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Schema sync gate passed (user schema v${version}).`);
