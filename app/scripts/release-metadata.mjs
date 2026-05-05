import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import packageJson from "../package.json" with { type: "json" };

export const appRoot = resolve(import.meta.dirname, "..");
export const releaseRoot = join(appRoot, "src-tauri", "target", "release");
export const tauriConfigPath = join(appRoot, "src-tauri", "tauri.conf.json");
export const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));

export const productName = tauriConfig.productName ?? packageJson.name;
export const packageName = packageJson.name;
export const version = tauriConfig.version ?? packageJson.version;

export const releaseArchiveName = `${productName}_${version}_release-package.zip`;
export const releaseArchivePath = join(releaseRoot, releaseArchiveName);
