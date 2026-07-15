import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appRoot } from "./release-metadata.mjs";
import { findMacosApp, findMacosDmg } from "./macos-release-utils.mjs";

if (process.platform !== "darwin") {
  console.error("macOS signing status must be generated on macOS.");
  process.exit(1);
}

const appBundle = findMacosApp();
const dmg = findMacosDmg();
if (!appBundle || !dmg) {
  console.error("macOS signing status requires the built app bundle and DMG.");
  process.exit(1);
}

const codesignValid = succeeds("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]);
const details = run("codesign", ["-dv", "--verbose=4", appBundle]);
const detailText = `${details.stdout}\n${details.stderr}`;
const signingIdentity = detailText.match(/^Authority=(.+)$/m)?.[1]?.trim() ?? "";
const teamId = detailText.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() ?? "";
const developerId = codesignValid && signingIdentity.startsWith("Developer ID Application:") && teamId !== "";

let gatekeeperValid = false;
let appStapleValid = false;
let dmgStapleValid = false;
if (developerId) {
  gatekeeperValid = succeeds("spctl", ["--assess", "--type", "execute", "--verbose=4", appBundle]);
  appStapleValid = succeeds("xcrun", ["stapler", "validate", appBundle]);
  dmgStapleValid = succeeds("xcrun", ["stapler", "validate", dmg]);
}

const status = {
  format_version: 1,
  signing_identity: signingIdentity || (codesignValid ? "ad-hoc" : "invalid"),
  team_id: teamId || null,
  codesign_valid: codesignValid,
  developer_id_signature_valid: developerId,
  notarization_valid: developerId && gatekeeperValid && appStapleValid && dmgStapleValid,
  staple_valid: appStapleValid && dmgStapleValid,
  gatekeeper_assessment_valid: gatekeeperValid,
};

const outputRoot = join(appRoot, "release");
mkdirSync(outputRoot, { recursive: true });
writeFileSync(join(outputRoot, "macos-signing.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8");

if (process.env.BIBLE_AI_REQUIRE_MACOS_PUBLIC_SIGNING === "true") {
  const failed = Object.entries(status)
    .filter(([key]) => key.endsWith("_valid"))
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failed.length > 0) {
    console.error(`Public macOS signing verification failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

console.log("macOS signing status:");
console.log(JSON.stringify(status, null, 2));

function succeeds(command, args) {
  return run(command, args).status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    return { status: null, stdout: "", stderr: result.error.message };
  }
  return result;
}
