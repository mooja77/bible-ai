import { claude } from "./claude.mjs";
import { gateway } from "./gateway.mjs";
import { openai } from "./openai.mjs";
import { gemini } from "./gemini.mjs";

export const ALL_PROVIDERS = [claude, gateway, gemini, openai];

export { callClaudeSynthesis } from "./claude.mjs";

/** Filter providers by env. Each provider's isAvailable(env) returns true
 *  when it has the key / auth it needs. */
export function availableProviders(env = process.env) {
  return ALL_PROVIDERS.filter((p) => {
    try {
      return p.isAvailable(env);
    } catch {
      return false;
    }
  });
}

/** Return a descriptor for every provider (available or not) so the UI can
 *  render "no key for OpenAI" rows too. */
export function providerManifest(env = process.env, model = undefined) {
  return ALL_PROVIDERS.map((p) => ({
    name: p.name,
    display_name: p.displayName?.({ env, model }) ?? p.display_name,
    available: (() => {
      try {
        return p.isAvailable(env);
      } catch {
        return false;
      }
    })(),
  }));
}
