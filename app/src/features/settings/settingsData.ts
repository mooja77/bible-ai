import type { ModuleEntry, ResourceSource } from "../../lib/bible";
import type { DataSourceStatus } from "./SettingsPrimitives";

export function moduleEntryReaderTarget(entry: ModuleEntry) {
  const metadata = entry.metadata ?? {};
  const verseId =
    readPositiveInteger(metadata.verse_id) ??
    readPositiveInteger(metadata.start_verse_id) ??
    (entry.key_type === "verse" ? readPositiveInteger(entry.key_value) : null) ??
    (entry.key_type === "verse_range" ? readPositiveInteger(entry.key_value.split("-")[0]) : null);
  if (!verseId) return null;
  return {
    verseId,
    translationCode: readString(metadata.translation_code) ?? "KJV",
    label: readString(metadata.citation) ?? entry.title ?? `verse ${verseId}`,
  };
}

function readPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readJsonRecord(value: string | null | undefined) {
  if (!value?.trim()) return {};
  try {
    return readRecord(JSON.parse(value));
  } catch {
    return {};
  }
}


export function resourceSourceStatus(source: ResourceSource): DataSourceStatus {
  const metadata = readJsonRecord(source.metadata_json);
  const nested = readRecord(metadata.metadata);
  const raw =
    readString(metadata.source_status) ??
    readString(nested.source_status) ??
    readString(metadata.source_type) ??
    readString(nested.source_type);
  const normalized = raw?.toLowerCase().replace(/_/g, "-");
  if (normalized === "bundled" || normalized === "built-in") return "bundled";
  if (normalized === "deferred") return "deferred";
  if (source.source_url?.toLowerCase().includes("built-in")) return "bundled";
  return "user-imported";
}

export function resourceSourceMetadata(source: ResourceSource) {
  const metadata = readJsonRecord(source.metadata_json);
  const nested = readRecord(metadata.metadata);
  const shareAlike =
    readString(metadata.share_alike_requirements) ??
    readString(metadata.shareAlikeRequirements) ??
    readString(nested.share_alike_requirements) ??
    readString(nested.shareAlikeRequirements);
  return {
    reviewStatus:
      readString(metadata.review_status) ?? readString(nested.review_status),
    review:
      readString(metadata.source_review) ??
      readString(metadata.review) ??
      readString(nested.source_review) ??
      readString(nested.review),
    redistribution:
      readString(metadata.redistribution) ??
      readString(metadata.redistribution_permission) ??
      readString(nested.redistribution) ??
      readString(nested.redistribution_permission),
    shareAlike: shareAlike && shareAlike !== "None." ? shareAlike : null,
  };
}
