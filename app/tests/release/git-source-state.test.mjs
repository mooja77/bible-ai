import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readGitCommit, trackedWorktreeClean } from "../../scripts/git-source-state.mjs";

test("tracked source state compares content and ignores untracked release outputs", () => {
  const root = mkdtempSync(join(tmpdir(), "bible-ai-git-source-state-"));
  try {
    git(root, "init");
    git(root, "config", "user.email", "release-test@example.invalid");
    git(root, "config", "user.name", "Release Test");
    writeFileSync(join(root, "tracked.txt"), "committed\n", "utf8");
    git(root, "add", "tracked.txt");
    git(root, "commit", "-m", "fixture");

    assert.match(readGitCommit(root), /^[a-f0-9]{40}$/);
    assert.equal(trackedWorktreeClean(root), true);

    writeFileSync(join(root, "release-output.bin"), "ignored by the tracked-state check", "utf8");
    assert.equal(trackedWorktreeClean(root), true);

    writeFileSync(join(root, "tracked.txt"), "modified\n", "utf8");
    assert.equal(trackedWorktreeClean(root), false);

    git(root, "add", "tracked.txt");
    assert.equal(trackedWorktreeClean(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}
