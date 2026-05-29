import type { AppSettings } from "./bible";

export function settingsHasConfiguredAi(settings: AppSettings) {
  return [
    settings.anthropic_api_key,
    settings.openai_api_key,
    settings.google_api_key,
    settings.managed_gateway_url,
  ].some((value) => Boolean(value?.trim()));
}

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
