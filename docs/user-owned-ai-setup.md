# User-Owned AI Provider Setup

Bible AI is designed to use the user's own AI accounts rather than a shared app-owned key.

No OpenAI, Anthropic, Gemini, or managed-gateway credentials are bundled with the app, committed to the repository, or included in release packages. Development test keys must be removed before distribution. Each installed copy should be configured by the person or team using that machine.

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

## First-Run User Setup

For an end user on a fresh install:

1. Open `Settings`.
2. Choose one setup path:
   - Local/no hosted key: use Claude Code login if available, plus Ollama for local model support.
   - Hosted quality: paste the user's own OpenAI, Anthropic, or Gemini API key.
   - Team deployment: enter a managed gateway URL/token supplied by the team.
3. Save settings.
4. Use `Test all providers`.
5. Open `Council` and check the voice cards before submitting a question.

If no provider key, Claude Code login, gateway, or local model is configured, the app still supports offline reading/search/workspaces, but hosted Council voices will be skipped.

## Storage And Exports

- Provider keys and managed gateway tokens are saved in the operating system credential vault for this machine.
- Provider keys and managed gateway tokens are not included in JSON backup exports.
- Removing keys from Settings removes them from the OS credential vault for that OS user.
- Older app builds stored provider keys in local SQLite settings. On the next settings load, the app migrates legacy SQLite provider keys into the OS credential vault, removes the SQLite secret rows, enables SQLite secure delete, and vacuums the profile database.
- Managed gateway URLs are normal settings and may appear in backups. Tokens remain secret.
- Council source drawers and release-readiness E2E tests check for local path and provider key-name leaks.
- Provider calls send the user's question and retrieved evidence to the configured provider or managed gateway.

## Release Gate

Before public distribution, complete the clean-profile and upgraded-profile credential-vault manual gates. Multi-provider real QA with Gemini and OpenAI passed on 2026-05-07.
