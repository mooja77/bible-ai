# User-Owned AI Provider Setup

Bible AI is designed to use the user's own AI accounts rather than a shared app-owned key.

## Supported Providers

| Provider | User Credential | Used For | Notes |
|---|---|---|---|
| Claude Code | Local Claude Code login | Claude voice and synthesis | Uses the user's local Claude Code subscription when available. |
| Anthropic API | Anthropic API key | Claude voice and synthesis | Preferred when the user wants API billing under their own Anthropic account. |
| OpenAI API | OpenAI API key | OpenAI Council voice | Requires OpenAI API access and billing. A ChatGPT subscription alone is not the same thing as API billing. |
| Gemini API | Google AI Studio API key | Gemini Council voice | Uses the user's Google/Gemini API quota and billing. |
| Managed Gateway | Gateway URL and optional token | Gateway Council voice | For team/public deployments where a backend owns provider routing, policy, and billing. |
| Ollama | Local Ollama host | Semantic retrieval embeddings | Does not require a hosted AI account. |

## In-App Flow

1. Open Settings.
2. Choose the setup mode:
   - No key: Claude Code login or Ollama.
   - Personal keys: Anthropic, OpenAI, or Gemini API credentials.
   - Managed gateway: a URL and optional gateway token supplied by the app owner/team.
3. Enter provider keys or managed gateway settings for the accounts the user wants to use.
4. Optionally override provider model IDs:
   - Anthropic API: `claude-sonnet-4-6`
   - OpenAI: `gpt-5`
   - Gemini: `gemini-2.5-flash`
5. Click the provider test buttons.
6. Open Council and confirm the “Voices before submit” cards show which providers will run.

## Storage And Exports

- Provider keys and managed gateway tokens are saved in the operating system credential vault for this machine.
- Provider keys and managed gateway tokens are not included in JSON backup exports.
- Older app builds stored provider keys in local SQLite settings. On the next settings load, the app migrates legacy SQLite provider keys into the OS credential vault, removes the SQLite secret rows, enables SQLite secure delete, and vacuums the profile database.
- Managed gateway URLs are normal settings and may appear in backups. Tokens remain secret.
- Council source drawers and release-readiness E2E tests check for local path and provider key-name leaks.
- Provider calls send the user's question and retrieved evidence to the configured provider or managed gateway.

## Release Gate

Before public distribution, complete the clean-profile and upgraded-profile credential-vault manual gates. Multi-provider real QA with Gemini and OpenAI passed on 2026-05-07.
