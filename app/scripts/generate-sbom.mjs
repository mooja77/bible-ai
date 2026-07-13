import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const releaseDir = resolve("release");
mkdirSync(releaseDir, { recursive: true });

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (!result.stdout?.trim()) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.error?.message || result.stderr || result.status}`,
    );
  }
  return JSON.parse(result.stdout);
}

function npmComponents(tree, scope, seen = new Map()) {
  for (const [name, dep] of Object.entries(tree.dependencies ?? {})) {
    if (!dep?.version) continue;
    const key = `${name}@${dep.version}`;
    if (!seen.has(key)) {
      seen.set(key, {
        type: "library",
        name,
        version: dep.version,
        "bom-ref": `pkg:npm/${encodeURIComponent(name)}@${dep.version}`,
        purl: `pkg:npm/${encodeURIComponent(name)}@${dep.version}`,
        licenses: dep.license ? [{ license: { name: String(dep.license) } }] : undefined,
        properties: [{ name: "bible-ai:node-workspace", value: scope }],
      });
    }
    npmComponents(dep, scope, seen);
  }
  return [...seen.values()];
}

function bom(name, components) {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: { type: "application", name: "Bible AI", version: "0.1.0" },
      tools: { components: [{ type: "application", name: "Bible AI SBOM generator" }] },
      properties: [{ name: "bible-ai:inventory", value: name }],
    },
    components,
  };
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const appTree = run(npmCommand, ["ls", "--json", "--all", "--long"], resolve("."));
const sidecarTree = run(
  npmCommand,
  ["ls", "--json", "--all", "--long"],
  resolve("sidecar"),
);
const npmSeen = new Map();
npmComponents(appTree, "app", npmSeen);
npmComponents(sidecarTree, "sidecar", npmSeen);
writeFileSync(
  resolve(releaseDir, "sbom-npm.cdx.json"),
  `${JSON.stringify(bom("npm", [...npmSeen.values()]), null, 2)}\n`,
);

const cargo = run(
  "cargo",
  ["metadata", "--format-version", "1", "--locked"],
  resolve("src-tauri"),
);
const cargoComponents = cargo.packages.map((pkg) => ({
  type: "library",
  name: pkg.name,
  version: pkg.version,
  "bom-ref": `pkg:cargo/${encodeURIComponent(pkg.name)}@${pkg.version}`,
  purl: `pkg:cargo/${encodeURIComponent(pkg.name)}@${pkg.version}`,
  licenses: pkg.license ? [{ expression: pkg.license }] : undefined,
}));
writeFileSync(
  resolve(releaseDir, "sbom-cargo.cdx.json"),
  `${JSON.stringify(bom("cargo", cargoComponents), null, 2)}\n`,
);

console.log(`Generated SBOMs: npm=${npmSeen.size}, cargo=${cargoComponents.length}`);
