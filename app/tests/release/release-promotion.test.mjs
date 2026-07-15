import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  macosPackageEvidenceNames,
  windowsPackageEvidenceNames,
} from "../../scripts/release-package-contract.mjs";

const appRoot = resolve(import.meta.dirname, "../..");
const node = process.execPath;

test("release package contracts include platform signing evidence", () => {
  assert.deepEqual(windowsPackageEvidenceNames, [
    "sbom-npm.cdx.json",
    "sbom-cargo.cdx.json",
    "windows-signing.json",
  ]);
  assert.deepEqual(macosPackageEvidenceNames, ["macos-signing.json"]);
});

test("version-bound release tags reject drift and mutable candidate names", () => {
  assert.equal(run("scripts/validate-release-tag.mjs", "--channel", "candidate", "--tag", "v0.1.0-rc.1").status, 0);
  assert.equal(run("scripts/validate-release-tag.mjs", "--channel", "public", "--tag", "v0.1.0").status, 0);
  assert.notEqual(run("scripts/validate-release-tag.mjs", "--channel", "candidate", "--tag", "v0.1.0-rc.0").status, 0);
  assert.notEqual(run("scripts/validate-release-tag.mjs", "--channel", "public", "--tag", "v0.1.1").status, 0);
});

test("promotion accepts exact unsigned Windows files only with explicit acknowledgement", () => {
  withFixture((root, commit) => {
    const accepted = run(
      "scripts/verify-release-promotion.mjs",
      "--assets",
      root,
      "--expected-commit",
      commit,
      "--require-macos",
      "false",
      "--allow-unsigned-windows",
      "true",
    );
    assert.equal(accepted.status, 0, accepted.stderr);

    const rejected = run(
      "scripts/verify-release-promotion.mjs",
      "--assets",
      root,
      "--expected-commit",
      commit,
      "--require-macos",
      "false",
      "--allow-unsigned-windows",
      "false",
    );
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /unsigned release was not acknowledged/);
  });
});

test("promotion rejects an installer changed after manifest generation", () => {
  withFixture((root, commit) => {
    writeFileSync(join(root, "Bible AI_0.1.0_x64-setup.exe"), "tampered", "utf8");
    const result = run(
      "scripts/verify-release-promotion.mjs",
      "--assets",
      root,
      "--expected-commit",
      commit,
      "--require-macos",
      "false",
      "--allow-unsigned-windows",
      "true",
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /byte mismatch|SHA-256 mismatch/);
  });
});

test("promotion rejects an unmanifested executable asset", () => {
  withFixture((root, commit) => {
    writeFileSync(join(root, "unexpected-helper.exe"), "unexpected", "utf8");
    const result = run(
      "scripts/verify-release-promotion.mjs",
      "--assets",
      root,
      "--expected-commit",
      commit,
      "--require-macos",
      "false",
      "--allow-unsigned-windows",
      "true",
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /installer asset set mismatch/);
  });
});

test("checksum generation covers release files but never hashes itself", () => {
  withFixture((root) => {
    const output = join(root, "SHA256SUMS.txt");
    const result = run(
      "scripts/create-release-checksums.mjs",
      "--assets",
      root,
      "--output",
      output,
      "--require-macos",
      "false",
    );
    assert.equal(result.status, 0, result.stderr);
    const checksums = readFileSync(output, "utf8");
    assert.match(checksums, /Bible AI_0\.1\.0_x64-setup\.exe/);
    assert.match(checksums, /Bible AI_0\.1\.0_x64_en-US\.msi/);
    assert.doesNotMatch(checksums, /SHA256SUMS\.txt/);
  });
});

test("macOS evidence templates bind the DMG hash and remain fail-closed", () => {
  const root = mkdtempSync(join(tmpdir(), "bible-ai-macos-evidence-test-"));
  try {
    const dmg = join(root, "Bible AI_0.1.0_aarch64.dmg");
    const output = join(root, "macos-manual-release-gates.json");
    const bytes = Buffer.from("test DMG bytes");
    writeFileSync(dmg, bytes);
    const created = run(
      "scripts/create-macos-manual-release-gates-template.mjs",
      "--dmg",
      dmg,
      "--output",
      output,
    );
    assert.equal(created.status, 0, created.stderr);
    const evidence = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(evidence.dmg_artifact.bytes, bytes.length);
    assert.equal(evidence.dmg_artifact.sha256, sha256(bytes));
    assert.equal(evidence.developer_id_signature_passed, false);
    assert.equal(evidence.clean_profile_install_passed, false);

    const verified = run("scripts/verify-macos-manual-release-gates.mjs", output);
    assert.notEqual(verified.status, 0);
    assert.match(verified.stderr, /must be true/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), "bible-ai-release-test-"));
  const commit = "a".repeat(40);
  try {
    const exeName = "Bible AI_0.1.0_x64-setup.exe";
    const msiName = "Bible AI_0.1.0_x64_en-US.msi";
    const exe = Buffer.from("exact NSIS bytes");
    const msi = Buffer.from("exact MSI bytes");
    const npmSbom = Buffer.from('{"bomFormat":"CycloneDX","components":[{"name":"npm"}]}');
    const cargoSbom = Buffer.from('{"bomFormat":"CycloneDX","components":[{"name":"cargo"}]}');
    writeFileSync(join(root, exeName), exe);
    writeFileSync(join(root, msiName), msi);
    writeFileSync(join(root, "sbom-npm.cdx.json"), npmSbom);
    writeFileSync(join(root, "sbom-cargo.cdx.json"), cargoSbom);
    writeFileSync(
      join(root, "release-manifest.json"),
      JSON.stringify({
        app: "Bible AI",
        package_name: "app",
        version: "0.1.0",
        release_root: "src-tauri/target/release",
        source_control: { git_commit: commit, tracked_worktree_clean: true },
        files: [
          { name: "nsis_installer", path: `bundle/nsis/${exeName}`, bytes: exe.length, sha256: sha256(exe) },
          { name: "msi_installer", path: `bundle/msi/${msiName}`, bytes: msi.length, sha256: sha256(msi) },
          { name: "sbom_npm", path: "../../../release/sbom-npm.cdx.json", bytes: npmSbom.length, sha256: sha256(npmSbom) },
          { name: "sbom_cargo", path: "../../../release/sbom-cargo.cdx.json", bytes: cargoSbom.length, sha256: sha256(cargoSbom) },
          { name: "windows_signing", path: "../../../release/windows-signing.json", bytes: 0, sha256: "" },
        ],
      }),
      "utf8",
    );
    const signing = Buffer.from(JSON.stringify({
        format_version: 1,
        artifacts: [
          { name: exeName, status: "NotSigned", signer_subject: null },
          { name: msiName, status: "NotSigned", signer_subject: null },
        ],
      }));
    writeFileSync(join(root, "windows-signing.json"), signing);
    const manifestPath = join(root, "release-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const signingEntry = manifest.files.find((entry) => entry.name === "windows_signing");
    signingEntry.bytes = signing.length;
    signingEntry.sha256 = sha256(signing);
    writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
    callback(root, commit);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function run(script, ...args) {
  return spawnSync(node, [script, ...args], { cwd: appRoot, encoding: "utf8" });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
