import { spawnSync } from "node:child_process";

export function readGitCommit(repoRoot) {
  const result = runGit(repoRoot, ["rev-parse", "HEAD"]);
  return String(result.stdout ?? "").trim();
}

export function trackedWorktreeClean(repoRoot) {
  return (
    gitDiffQuiet(repoRoot, ["diff", "--quiet", "--ignore-submodules=none", "--"]) &&
    gitDiffQuiet(repoRoot, ["diff", "--cached", "--quiet", "--ignore-submodules=none", "--"])
  );
}

function gitDiffQuiet(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw gitError(args, result);
}

function runGit(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw gitError(args, result);
  return result;
}

function gitError(args, result) {
  const detail = String(result.stderr || result.error?.message || `exit ${result.status}`).trim();
  return new Error(`git ${args.join(" ")} failed: ${detail}`);
}
