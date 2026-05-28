import type { AppSettings } from "./bible";

export function settingsHasConfiguredAi(settings: AppSettings) {
  return [
    settings.anthropic_api_key,
    settings.openai_api_key,
    settings.google_api_key,
    settings.managed_gateway_url,
  ].some((value) => Boolean(value?.trim()));
}
