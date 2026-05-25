import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  addModuleEntry,
  backupUserSqlite,
  checkAppSetup,
  createModule,
  deleteModule,
  exportUserDataJson,
  importModuleJsonl,
  importUserDataJson,
  listModuleEntriesForTopic,
  listModules,
  listModuleTopics,
  listResourceSources,
  restoreUserSqlite,
  writeUserDataBackup,
  type AppSettings,
  type ModuleEntry,
  type ModuleSummary,
  type ModuleTopic,
  type ResourceSource,
  type SetupDiagnostics,
  type Translation,
  type UserDataImportStrategy,
} from "../../lib/bible";

interface Props {
  settings: AppSettings;
  translations: Translation[];
  onSave: (settings: AppSettings) => Promise<void>;
  onUserDataChanged?: () => void;
  onJumpToVerse?: (verseId: number, translationCode: string) => void;
}

const MODEL_OPTIONS = [
  { value: "sonnet", label: "Claude Sonnet" },
  { value: "opus", label: "Claude Opus" },
  { value: "haiku", label: "Claude Haiku" },
];

const APP_NAME = "Bible AI";
const APP_VERSION = "0.1.0";

const DEFERRED_DATA_SOURCES = [
  {
    name: "Douay-Rheims",
    status: "Phase 13",
    detail: "Public-domain source is available, but Vulgate versification needs explicit mapping before import.",
  },
  {
    name: "Septuagint / Apocrypha",
    status: "Phase 13",
    detail: "Treat as a dedicated corpus phase because book order, versification, and licensing need separate QA.",
  },
];

const SOURCE_ATTRIBUTIONS = [
  {
    name: "King James Version",
    license: "Public Domain",
    source: "thiagobodruk/bible",
    detail: "Bundled as KJV verse text.",
  },
  {
    name: "World English Bible",
    license: "Public Domain",
    source: "eBible.org ENGWEBP USFM",
    detail: "Bundled as the 66-book Protestant WEB edition.",
  },
  {
    name: "ASV, YLT, WLC, TR, DRC assessment cache",
    license: "Public Domain in ingest metadata",
    source: "scrollmapper/bible_databases",
    detail: "DRC remains assessment-only until alternate versification is implemented.",
  },
  {
    name: "Open Scriptures morphology and Strong's dictionaries",
    license: "CC-BY / CC-BY-SA in ingest metadata",
    source: "openscriptures/morphhb and openscriptures/strongs",
    detail: "Used for word-study metadata and original-language lookup.",
  },
  {
    name: "OpenBible cross-references",
    license: "CC-BY",
    source: "a.openbible.info cross-reference dataset",
    detail: "Used for cross-reference retrieval and reader context.",
  },
];

type SetupPath = "personal" | "local" | "gateway";

export function SettingsPanel({
  settings,
  translations,
  onSave,
  onUserDataChanged,
  onJumpToVerse,
}: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SetupDiagnostics | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticScope, setDiagnosticScope] = useState("setup");
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStrategy, setImportStrategy] =
    useState<UserDataImportStrategy>("skip_existing");
  const [sqliteRestorePath, setSqliteRestorePath] = useState("");
  const [moduleStatus, setModuleStatus] = useState<string | null>(null);
  const [moduleBusy, setModuleBusy] = useState(false);
  const [installedModules, setInstalledModules] = useState<ModuleSummary[]>([]);
  const [moduleTopics, setModuleTopics] = useState<ModuleTopic[]>([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [topicEntries, setTopicEntries] = useState<ModuleEntry[]>([]);
  const [resourceSources, setResourceSources] = useState<ResourceSource[]>([]);
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicStatus, setTopicStatus] = useState<string | null>(null);
  const [setupPath, setSetupPath] = useState<SetupPath>("personal");
  const moduleRefreshRequestId = useRef(0);

  useEffect(() => {
    setDraft(settings);
    setSaveError(null);
  }, [settings]);

  const refreshModules = async () => {
    const requestId = ++moduleRefreshRequestId.current;
    let modules: ModuleSummary[];
    let topics: ModuleTopic[];
    let sources: ResourceSource[];
    try {
      [modules, topics, sources] = await Promise.all([
        listModules(),
        listModuleTopics(),
        listResourceSources(),
      ]);
    } catch (e) {
      if (requestId === moduleRefreshRequestId.current) throw e;
      return;
    }
    if (requestId !== moduleRefreshRequestId.current) return;
    setInstalledModules(modules);
    setModuleTopics(topics);
    setResourceSources(sources);
    setTopicQuery((current) => current.trim() || topics[0]?.key_value || "");
  };

  useEffect(() => {
    let cancelled = false;
    refreshModules().catch(() => {
      if (!cancelled) setInstalledModules([]);
    });
    return () => {
      cancelled = true;
      moduleRefreshRequestId.current += 1;
    };
  }, []);

  const update = (key: keyof AppSettings, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setSaveError(null);
  };

  const submit = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await onSave(draft);
      setSaved(true);
      return true;
    } catch (e) {
      setSaveError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runChecks = async (scope = "setup") => {
    setChecking(true);
    setDiagnosticError(null);
    setDiagnosticScope(scope);
    try {
      setDiagnostics(await checkAppSetup(draft));
    } catch (e) {
      setDiagnosticError(String(e));
      setDiagnostics(null);
    } finally {
      setChecking(false);
    }
  };

  const saveAndRunChecks = async () => {
    const ok = await submit();
    if (ok) await runChecks("guided setup");
  };

  const copyBackup = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const exported = await exportUserDataJson();
      const json = JSON.stringify(exported, null, 2);
      await navigator.clipboard.writeText(json);
      setBackupStatus(`Copied ${json.length.toLocaleString()} characters`);
    } catch (e) {
      setBackupStatus(`Copy failed: ${String(e)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const saveBackup = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const path = await writeUserDataBackup();
      setBackupStatus(`Saved ${path}`);
    } catch (e) {
      setBackupStatus(`Save failed: ${String(e)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const importBackupJson = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const payload = JSON.parse(importText) as Record<string, unknown>;
      const report = await importUserDataJson(payload, importStrategy);
      setBackupStatus(
        `Imported ${report.imported}, replaced ${report.replaced}, skipped ${report.skipped}`,
      );
      onUserDataChanged?.();
    } catch (e) {
      setBackupStatus(`Import failed: ${String(e)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const saveSqliteBackup = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const path = await backupUserSqlite();
      setBackupStatus(`SQLite saved ${path}`);
    } catch (e) {
      setBackupStatus(`SQLite backup failed: ${String(e)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreSqliteBackup = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const safetyPath = await restoreUserSqlite(sqliteRestorePath);
      setBackupStatus(`Restored SQLite. Safety backup: ${safetyPath}`);
      onUserDataChanged?.();
    } catch (e) {
      setBackupStatus(`Restore failed: ${String(e)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const installSampleModule = async () => {
    setModuleBusy(true);
    setModuleStatus(null);
    try {
      const existing = await listModules();
      if (existing.some((m) => m.slug === "sample-study-notes")) {
        setModuleStatus("Sample module already installed");
        setInstalledModules(existing);
        return;
      }
      const moduleId = await createModule(
        "sample-study-notes",
        "Sample Study Notes",
        "commentary",
        "Local sample",
        "Internal",
        "1",
      );
      await addModuleEntry(
        moduleId,
        "verse",
        "1001001",
        "Creation frame",
        "Genesis 1:1 establishes God as the subject of creation before the text introduces form, light, and order.",
        { citation: "Genesis 1:1" },
      );
      await addModuleEntry(
        moduleId,
        "verse",
        "19023001",
        "Covenant care",
        "Psalm 23:1 uses shepherd imagery to describe provision, guidance, and covenant security.",
        { citation: "Psalm 23:1" },
      );
      await addModuleEntry(
        moduleId,
        "verse",
        "43001001",
        "Word and beginning",
        "John 1:1 deliberately echoes Genesis while identifying the Word as present with God and as God.",
        { citation: "John 1:1" },
      );
      setModuleStatus("Installed Sample Study Notes");
      await refreshModules();
    } catch (e) {
      setModuleStatus(`Install failed: ${String(e)}`);
    } finally {
      setModuleBusy(false);
    }
  };

  const installJsonlModule = async () => {
    setModuleBusy(true);
    setModuleStatus(null);
    try {
      const report = await importModuleJsonl(
        {
          slug: "sample-strongs-notes",
          title: "Sample Strong's Notes",
          kind: "lexicon",
          source: "Local JSONL sample",
          license: "Internal",
          version: "1",
        },
        [
          JSON.stringify({
            key_type: "strongs",
            key_value: "H7225",
            title: "Beginning",
            body: "The Hebrew term attached to Genesis 1:1 frames the verse as an opening point for the narrated creation account.",
            metadata: { strongs: "H7225" },
          }),
          JSON.stringify({
            key_type: "topic",
            key_value: "creation",
            title: "Creation",
            body: "Creation modules can attach entries to topics for browsing outside a single verse or Strong's code.",
            metadata: { citation: "Genesis 1:1", verse_id: 1001001 },
          }),
          JSON.stringify({
            key_type: "verse_range",
            key_value: "1001001-1001003",
            title: "Creation opening",
            body: "Genesis 1:1-3 frames creation, the unformed earth, and the first divine speech as a single opening movement.",
            metadata: { citation: "Genesis 1:1-3" },
          }),
        ].join("\n"),
      );
      setModuleStatus(`Imported Sample Strong's Notes (${report.entry_count} entries)`);
      await refreshModules();
    } catch (e) {
      setModuleStatus(`Import failed: ${String(e)}`);
    } finally {
      setModuleBusy(false);
    }
  };

  const uninstallModule = async (module: ModuleSummary) => {
    setModuleBusy(true);
    setModuleStatus(null);
    try {
      await deleteModule(module.id);
      setModuleStatus(`Removed ${module.title}`);
      await refreshModules();
      onUserDataChanged?.();
    } catch (e) {
      setModuleStatus(`Remove failed: ${String(e)}`);
    } finally {
      setModuleBusy(false);
    }
  };

  const browseTopic = async () => {
    const topic = topicQuery.trim();
    if (!topic) return;
    setTopicBusy(true);
    setTopicStatus(null);
    try {
      const entries = await listModuleEntriesForTopic(topic);
      setTopicEntries(entries);
      setTopicStatus(
        entries.length === 0
          ? `No entries for ${topic}`
          : `${entries.length} topic entr${entries.length === 1 ? "y" : "ies"}`,
      );
    } catch (e) {
      setTopicStatus(`Topic lookup failed: ${String(e)}`);
      setTopicEntries([]);
    } finally {
      setTopicBusy(false);
    }
  };

  const hasGoogleKey = hasSettingValue(draft.google_api_key);
  const hasOpenAiKey = hasSettingValue(draft.openai_api_key);
  const hasAnthropicKey = hasSettingValue(draft.anthropic_api_key);
  const hasPersonalKey = hasGoogleKey || hasOpenAiKey || hasAnthropicKey;
  const hasGateway = hasSettingValue(draft.managed_gateway_url);
  const hasOllama = hasSettingValue(draft.ollama_host);
  const personalProviderCount = [hasAnthropicKey, hasGoogleKey, hasOpenAiKey]
    .filter(Boolean)
    .length;
  const passingVoiceCount = diagnostics?.providers.filter((provider) => provider.available)
    .length ?? 0;
  const setupReady =
    setupPath === "personal"
      ? hasPersonalKey
      : setupPath === "gateway"
        ? hasGateway
        : diagnostics?.providers.some(
            (provider) => provider.name === "claude" && provider.available,
          ) === true;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Connect local AI, user-owned subscriptions, managed gateway access, and reader defaults for this machine.
        </p>
      </header>

      <section className="surface-panel rounded-lg p-4 space-y-4">
        <h2 className="text-sm tracking-wider text-neutral-400">Council</h2>
        <div
          className="soft-card p-4 space-y-4 border-amber-500/20"
          data-testid="provider-setup-guide"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-100">
                Guided AI setup
              </h3>
              <p className="text-sm text-neutral-500 mt-1">
                Pick how this install should run Council voices, then save and test
                before asking a question. Bible AI ships with no provider keys —
                anything you enter here stays local to this OS user.
              </p>
            </div>
            <span
              className={
                "text-xs px-2 py-1 rounded border " +
                (setupReady
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200")
              }
            >
              {setupReady ? "ready to test" : "needs setup"}
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-2" role="tablist" aria-label="AI setup path">
            <SetupPathButton
              active={setupPath === "personal"}
              label="Personal keys"
              detail={`${personalProviderCount || "No"} hosted provider${personalProviderCount === 1 ? "" : "s"} configured`}
              onClick={() => setSetupPath("personal")}
              testId="provider-setup-path-personal"
            />
            <SetupPathButton
              active={setupPath === "local"}
              label="Local/no hosted key"
              detail={hasOllama ? "Ollama helps retrieval" : "Claude Code login"}
              onClick={() => setSetupPath("local")}
              testId="provider-setup-path-local"
            />
            <SetupPathButton
              active={setupPath === "gateway"}
              label="Managed gateway"
              detail={hasGateway ? "Gateway URL set" : "Team/public routing"}
              onClick={() => setSetupPath("gateway")}
              testId="provider-setup-path-gateway"
            />
          </div>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="space-y-3">
              <SetupPathDetails path={setupPath} />
              <div className="grid sm:grid-cols-2 gap-2">
                <SetupCheckPill
                  label="Settings saved"
                  state={saved ? "ok" : saveError ? "warning" : "pending"}
                  detail={saved ? "Latest edits saved." : saveError ?? "Save after editing credentials."}
                />
                <SetupCheckPill
                  label="Tested providers"
                  state={diagnostics ? (passingVoiceCount > 0 ? "ok" : "warning") : "pending"}
                  detail={
                    diagnostics
                      ? `${passingVoiceCount} Council voice${passingVoiceCount === 1 ? "" : "s"} available.`
                      : "Run a provider test after saving."
                  }
                />
              </div>
            </div>
            <div className="soft-card px-3 py-3 space-y-3">
              <p className="text-xs tracking-wider text-neutral-500">
                Current setup
              </p>
              <div className="grid gap-2">
                <ProviderMiniStatus label="Anthropic" active={hasAnthropicKey} />
                <ProviderMiniStatus label="OpenAI" active={hasOpenAiKey} />
                <ProviderMiniStatus label="Gemini" active={hasGoogleKey} />
                <ProviderMiniStatus label="Gateway" active={hasGateway} />
                <ProviderMiniStatus label="Ollama" active={hasOllama} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  className="btn-primary px-3 py-1.5 text-sm"
                >
                  {saving ? "Saving..." : "Save setup"}
                </button>
                <button
                  type="button"
                  onClick={() => void saveAndRunChecks()}
                  disabled={saving || checking}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  {checking ? "Testing..." : "Save & test"}
                </button>
              </div>
              {saveError && <p className="text-xs text-red-300">{saveError}</p>}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Google API key">
            <input
              aria-label="Google API key"
              type="password"
              value={draft.google_api_key ?? ""}
              onChange={(e) => update("google_api_key", e.target.value)}
              className="settings-input"
              autoComplete="off"
            />
          </Field>
          <Field label="OpenAI API key">
            <input
              aria-label="OpenAI API key"
              type="password"
              value={draft.openai_api_key ?? ""}
              onChange={(e) => update("openai_api_key", e.target.value)}
              className="settings-input"
              autoComplete="off"
            />
          </Field>
          <Field label="Anthropic API key">
            <input
              aria-label="Anthropic API key"
              type="password"
              value={draft.anthropic_api_key ?? ""}
              onChange={(e) => update("anthropic_api_key", e.target.value)}
              className="settings-input"
              autoComplete="off"
            />
          </Field>
          <Field label="Managed gateway URL">
            <input
              aria-label="Managed gateway URL"
              value={draft.managed_gateway_url ?? ""}
              onChange={(e) => update("managed_gateway_url", e.target.value)}
              placeholder="https://gateway.example.com"
              className="settings-input"
              autoComplete="off"
            />
          </Field>
          <Field label="Managed gateway token">
            <input
              aria-label="Managed gateway token"
              type="password"
              value={draft.managed_gateway_token ?? ""}
              onChange={(e) => update("managed_gateway_token", e.target.value)}
              className="settings-input"
              autoComplete="off"
            />
          </Field>
          <Field label="Claude model">
            <select
              value={draft.claude_model ?? "sonnet"}
              onChange={(e) => update("claude_model", e.target.value)}
              className="settings-input"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anthropic API model">
            <input
              aria-label="Anthropic API model"
              value={draft.anthropic_model ?? ""}
              onChange={(e) => update("anthropic_model", e.target.value)}
              placeholder="claude-sonnet-4-6"
              className="settings-input"
            />
          </Field>
          <Field label="OpenAI model">
            <input
              aria-label="OpenAI model"
              value={draft.openai_model ?? ""}
              onChange={(e) => update("openai_model", e.target.value)}
              placeholder="gpt-5"
              className="settings-input"
            />
          </Field>
          <Field label="Gemini model">
            <input
              aria-label="Gemini model"
              value={draft.gemini_model ?? ""}
              onChange={(e) => update("gemini_model", e.target.value)}
              placeholder="gemini-2.5-flash"
              className="settings-input"
            />
          </Field>
          <Field label="Ollama host">
            <input
              value={draft.ollama_host ?? ""}
              onChange={(e) => update("ollama_host", e.target.value)}
              placeholder="http://localhost:11434"
              className="settings-input"
            />
          </Field>
          <Field label="Retrieval translation">
            <select
              value={draft.retrieval_translation ?? "KJV"}
              onChange={(e) => update("retrieval_translation", e.target.value)}
              className="settings-input"
            >
              {translations.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} · {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="surface-panel rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm tracking-wider text-neutral-400">
              Provider Status
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Test each user-owned provider before asking the Council. Keys are saved in the OS credential vault and excluded from JSON backups.
            </p>
          </div>
          {checking && (
            <span className="text-xs text-neutral-500">Testing {diagnosticScope}...</span>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <ProviderStatusCard
            label="Claude"
            configured
            status={diagnostics?.checks.claude.ok}
            detail={
              diagnostics
                ? diagnostics.checks.claude.ok
                  ? diagnostics.checks.claude.mode === "api"
                    ? "Claude voice verified via the Anthropic API key."
                    : "Claude voice verified via the Claude Code login."
                  : diagnostics.checks.claude.error ?? "Claude voice is not reachable."
                : hasSettingValue(draft.anthropic_api_key)
                  ? "Uses the user's Anthropic API subscription."
                  : "Uses the local Claude Code login if available."
            }
          />
          <ProviderStatusCard
            label="Anthropic API"
            configured={hasAnthropicKey}
            status={diagnostics?.checks.anthropic.ok}
            detail={
              diagnostics
                ? diagnostics.checks.anthropic.error ?? "Anthropic API key accepted."
                : hasAnthropicKey
                  ? "Anthropic API key saved in settings."
                  : "Optional: add an Anthropic API key instead of relying on Claude Code login."
            }
          />
          <ProviderStatusCard
            label="Gemini"
            configured={hasGoogleKey}
            status={diagnostics?.checks.google.ok}
            detail={
              diagnostics
                ? diagnostics.checks.google.error ?? "Google API key accepted."
                : hasGoogleKey
                  ? "Google API key saved in settings."
                  : "Add a Google API key to enable Gemini."
            }
          />
          <ProviderStatusCard
            label="OpenAI"
            configured={hasOpenAiKey}
            status={diagnostics?.checks.openai.ok}
            detail={
              diagnostics
                ? diagnostics.checks.openai.error ?? "OpenAI API key accepted."
                : hasOpenAiKey
                  ? "OpenAI API key saved in settings."
                  : "Add an OpenAI API key to enable OpenAI."
            }
          />
          <ProviderStatusCard
            label="Managed Gateway"
            configured={hasGateway}
            status={diagnostics?.checks.gateway.ok}
            detail={
              diagnostics
                ? diagnostics.checks.gateway.error ?? "Gateway health check accepted."
                : hasGateway
                  ? "Gateway URL is set; token is stored in the OS credential vault when provided."
                  : "Optional: use an app-specific gateway instead of direct provider keys."
            }
          />
          <ProviderStatusCard
            label="Ollama"
            configured={hasOllama}
            status={diagnostics?.checks.ollama.ok}
            detail={
              diagnostics
                ? diagnostics.checks.ollama.ok
                  ? `Reachable at ${diagnostics.checks.ollama.host}`
                  : diagnostics.checks.ollama.error
                : draft.ollama_host
                  ? `Will test ${draft.ollama_host}.`
                  : "Defaults to http://localhost:11434 for semantic retrieval."
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runChecks("all providers")}
            disabled={checking}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Test all providers
          </button>
          <button
            type="button"
            onClick={() => void runChecks("Anthropic")}
            disabled={checking || !hasAnthropicKey}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Test Anthropic
          </button>
          <button
            type="button"
            onClick={() => void runChecks("Google")}
            disabled={checking || !hasGoogleKey}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Test Google
          </button>
          <button
            type="button"
            onClick={() => void runChecks("OpenAI")}
            disabled={checking || !hasOpenAiKey}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Test OpenAI
          </button>
          <button
            type="button"
            onClick={() => void runChecks("Gateway")}
            disabled={checking || !hasGateway}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Test Gateway
          </button>
          <button
            type="button"
            onClick={() => void runChecks("Ollama")}
            disabled={checking}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Test Ollama
          </button>
        </div>
      </section>

      <section className="surface-panel rounded-lg p-4 space-y-4">
        <h2 className="text-sm tracking-wider text-neutral-400">User Data</h2>
        <p className="text-xs text-neutral-500">
          JSON backups include user-authored data and resource source metadata. Provider secrets and
          imported resource entry bodies are excluded.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveBackup}
            disabled={backupBusy}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {backupBusy ? "Working..." : "Save backup file"}
          </button>
          <button
            type="button"
            onClick={copyBackup}
            disabled={backupBusy}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Copy backup JSON
          </button>
          {backupStatus && (
            <span data-testid="backup-status" className="text-xs text-neutral-400">
              {backupStatus}
            </span>
          )}
        </div>
        <div className="grid gap-3 border-t border-neutral-800 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="JSON import conflict strategy"
              value={importStrategy}
              onChange={(e) => setImportStrategy(e.target.value as UserDataImportStrategy)}
              className="settings-input max-w-48 text-sm"
            >
              <option value="skip_existing">Skip existing</option>
              <option value="replace_existing">Replace existing</option>
              <option value="duplicate">Duplicate</option>
            </select>
            <button
              type="button"
              onClick={importBackupJson}
              disabled={backupBusy || importText.trim().length === 0}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              Import pasted JSON
            </button>
          </div>
          <textarea
            aria-label="Backup JSON"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste Bible AI backup JSON"
            rows={4}
            className="settings-input font-mono text-xs"
          />
        </div>
        <div className="grid gap-3 border-t border-neutral-800 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveSqliteBackup}
              disabled={backupBusy}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              Backup SQLite
            </button>
            <button
              type="button"
              onClick={restoreSqliteBackup}
              disabled={backupBusy || sqliteRestorePath.trim().length === 0}
              className="px-3 py-1.5 rounded border border-red-900/70 hover:border-red-700 disabled:text-neutral-600 disabled:border-neutral-800 text-sm text-red-100"
            >
              Restore SQLite
            </button>
          </div>
          <input
            aria-label="SQLite restore path"
            value={sqliteRestorePath}
            onChange={(e) => setSqliteRestorePath(e.target.value)}
            placeholder="Path to user.sqlite backup"
            className="settings-input font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-4">
          <button
            type="button"
            onClick={installSampleModule}
            disabled={moduleBusy}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {moduleBusy ? "Installing..." : "Install sample module"}
          </button>
          <button
            type="button"
            onClick={installJsonlModule}
            disabled={moduleBusy}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Import JSONL sample
          </button>
          {moduleStatus && <span className="text-xs text-neutral-400">{moduleStatus}</span>}
        </div>
        <div className="border-t border-neutral-800 pt-4 space-y-2">
          <h3 className="text-xs tracking-wider text-neutral-500">
            Installed Modules
          </h3>
          {installedModules.length === 0 ? (
            <p className="text-xs text-neutral-500">No modules installed.</p>
          ) : (
            <ul className="divide-y divide-neutral-900 border border-neutral-900 rounded">
              {installedModules.map((module) => (
                <li
                  key={module.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                  data-testid="installed-module"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200 truncate">{module.title}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {module.kind}
                      {module.version ? ` · v${module.version}` : ""}
                      {module.license ? ` · ${module.license}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => uninstallModule(module)}
                    disabled={moduleBusy}
                    aria-label={`Uninstall ${module.title}`}
                    data-testid={`uninstall-module-${module.slug}`}
                    className="px-2 py-1 rounded border border-red-900/70 hover:border-red-700 disabled:text-neutral-600 disabled:border-neutral-800 text-xs text-red-100"
                  >
                    Uninstall
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-neutral-800 pt-4 space-y-3">
          <h3 className="text-xs tracking-wider text-neutral-500">
            Topic Browser
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {moduleTopics.length > 0 ? (
              <select
                aria-label="Module topic"
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                className="settings-input text-xs max-w-xs"
              >
                {moduleTopics.map((topic) => (
                  <option key={topic.key_value} value={topic.key_value}>
                    {topic.title ?? topic.key_value} ({topic.entry_count})
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label="Module topic"
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                placeholder="Topic key"
                className="settings-input text-xs max-w-xs"
              />
            )}
            <button
              type="button"
              onClick={browseTopic}
              disabled={topicBusy || topicQuery.trim().length === 0}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              {topicBusy ? "Opening..." : "Open topic"}
            </button>
            {topicStatus && <span className="text-xs text-neutral-400">{topicStatus}</span>}
          </div>
          {topicEntries.length > 0 && (
            <ul className="space-y-3" data-testid="module-topic-results">
              {topicEntries.map((entry) => {
                const target = moduleEntryReaderTarget(entry);
                return (
                  <li
                    key={entry.id}
                    className="border border-neutral-900 rounded px-3 py-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-amber-300">{entry.module_title}</span>
                      {entry.title && (
                        <span className="text-xs text-neutral-500">{entry.title}</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-300 mt-1 leading-relaxed">{entry.body}</p>
                    {target && onJumpToVerse && (
                      <button
                        type="button"
                        onClick={() => onJumpToVerse(target.verseId, target.translationCode)}
                        className="mt-2 text-xs font-mono text-amber-300 hover:text-amber-200"
                      >
                        Open {target.label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section
        className="surface-panel rounded-lg p-4 space-y-4"
        data-testid="data-sources-screen"
      >
        <div>
          <h2 className="text-sm tracking-wider text-neutral-400">
            Data Sources
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Bundled corpora and deferred source decisions for audit and attribution.
          </p>
        </div>
        <ul className="divide-y divide-neutral-900 border border-neutral-900 rounded">
          {translations.map((translation) => (
            <li key={translation.code} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-neutral-200">
                  {translation.code} · {translation.name}
                </p>
                <div className="flex items-center gap-2">
                  <SourceStatusBadge status="bundled" />
                  <span className="text-xs text-neutral-500">{translation.kind}</span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {translation.language}
                {translation.year ? ` · ${translation.year}` : ""} ·{" "}
                {translation.license}
              </p>
            </li>
          ))}
        </ul>
        {resourceSources.length > 0 && (
          <div className="border-t border-neutral-800 pt-3">
            <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
              Open Resource Library
            </h3>
            <ul className="grid gap-2">
              {resourceSources.map((source) => {
                const metadata = resourceSourceMetadata(source);
                return (
                  <li key={source.id ?? source.slug} className="border border-neutral-900 rounded px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm text-neutral-200">{source.title}</p>
                      <div className="flex items-center gap-2">
                        <SourceStatusBadge status={resourceSourceStatus(source)} />
                        <span className="text-xs text-neutral-500">{source.license}</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {source.version ? `Version ${source.version}` : "No version recorded"}
                      {source.source_url ? ` · ${source.source_url}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">{source.attribution}</p>
                    {metadata.review && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Review: {metadata.review}
                      </p>
                    )}
                    {metadata.redistribution && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Redistribution: {metadata.redistribution}
                      </p>
                    )}
                    {metadata.shareAlike && (
                      <p className="text-xs text-amber-200 mt-1">
                        Share-alike: {metadata.shareAlike}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="border-t border-neutral-800 pt-3">
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
            Candidate Sources
          </h3>
          <ul className="grid gap-2">
            {DEFERRED_DATA_SOURCES.map((source) => (
              <li key={source.name} className="border border-neutral-900 rounded px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-neutral-200">{source.name}</p>
                  <div className="flex items-center gap-2">
                    <SourceStatusBadge status="deferred" />
                    <span className="text-xs text-amber-300">{source.status}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-1">{source.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="surface-panel rounded-lg p-4 space-y-4"
        data-testid="license-attribution-screen"
      >
        <div>
          <h2 className="text-sm tracking-wider text-neutral-400">
            License & Attribution
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Public-release disclosures for bundled corpus, study metadata, and privacy.
          </p>
        </div>
        <ul className="divide-y divide-neutral-900 border border-neutral-900 rounded">
          {SOURCE_ATTRIBUTIONS.map((source) => (
            <li key={source.name} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-neutral-200">{source.name}</p>
                <span className="text-xs text-neutral-500">{source.license}</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">{source.source}</p>
              <p className="text-xs text-neutral-500 mt-1">{source.detail}</p>
            </li>
          ))}
        </ul>
        <div className="grid md:grid-cols-2 gap-3 border-t border-neutral-800 pt-3">
          <InfoBlock
            label="Local data"
            value="Notes, workspaces, bookmarks, settings, backups, and Council history are stored on this machine."
          />
          <InfoBlock
            label="Provider calls"
            value="Council requests send the question and retrieved evidence only to providers the user configures."
          />
          <InfoBlock
            label="Exports"
            value="Export and source-drawer tests check that local Windows paths and provider key names are not exposed."
          />
          <InfoBlock
            label="Distribution decision"
            value="Default channel is personal use; public release requires manual clean-profile QA and multi-provider QA."
          />
        </div>
      </section>

      <section
        className="surface-panel rounded-lg p-4 space-y-4"
        data-testid="about-distribution-screen"
      >
        <div>
          <h2 className="text-sm tracking-wider text-neutral-400">
            About & Distribution
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Version, privacy posture, and release readiness notes.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <InfoBlock label="Version" value={`${APP_NAME} ${APP_VERSION}`} />
          <InfoBlock label="Release mode" value="Personal-use release candidate with public-release disclosures included" />
          <InfoBlock label="Privacy" value="User data, provider keys, and backups stay local unless a provider call is submitted." />
          <InfoBlock label="Public release gate" value="Complete clean-profile installer QA and multi-provider Council QA before publishing." />
        </div>
        <div className="border-t border-neutral-800 pt-3">
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
            Release Notes
          </h3>
          <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
            <li>Council transparency views explain ranking, disagreement, evidence, and provider failures.</li>
            <li>Workspaces export saved studies, Council answers, notes, and search results.</li>
            <li>Settings now exposes provider tests, data sources, backup/restore, and distribution status.</li>
          </ul>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="btn-primary px-3 py-1.5 text-sm"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => void runChecks("setup")}
          disabled={checking}
          className="btn-secondary px-3 py-1.5 text-sm"
        >
          {checking ? "Checking..." : "Test setup"}
        </button>
        {saved && <span className="text-xs text-emerald-300">Saved</span>}
        {saveError && <span className="text-xs text-red-300">{saveError}</span>}
      </div>

      {(diagnostics || diagnosticError) && (
        <section className="surface-panel rounded-lg p-4 space-y-3">
          <h2 className="text-sm tracking-wider text-neutral-400">Diagnostics</h2>
          {diagnosticError ? (
            <p className="text-sm text-red-300">{diagnosticError}</p>
          ) : diagnostics ? (
            <>
              <DiagnosticRow
                label="Sidecar"
                ok={diagnostics.sidecar.ok}
                detail={`Node ${diagnostics.sidecar.node} · ${diagnostics.sidecar.platform}/${diagnostics.sidecar.arch}`}
              />
              <DiagnosticRow
                label="Claude"
                ok={diagnostics.checks.claude.ok}
                detail={
                  diagnostics.checks.claude.error ??
                  (diagnostics.checks.claude.mode === "api"
                    ? "Reachable via the Anthropic API key"
                    : "Reachable via the Claude Code login")
                }
              />
              <DiagnosticRow
                label="Google"
                ok={diagnostics.checks.google.ok}
                detail={diagnostics.checks.google.error ?? "API key accepted"}
              />
              <DiagnosticRow
                label="OpenAI"
                ok={diagnostics.checks.openai.ok}
                detail={diagnostics.checks.openai.error ?? "API key accepted"}
              />
              <DiagnosticRow
                label="Anthropic"
                ok={diagnostics.checks.anthropic.ok}
                detail={diagnostics.checks.anthropic.error ?? "API key accepted"}
              />
              <DiagnosticRow
                label="Managed Gateway"
                ok={diagnostics.checks.gateway.ok}
                detail={diagnostics.checks.gateway.error ?? "Gateway health check accepted"}
              />
              <DiagnosticRow
                label="Ollama"
                ok={diagnostics.checks.ollama.ok}
                detail={
                  diagnostics.checks.ollama.ok
                    ? `Reachable at ${diagnostics.checks.ollama.host}`
                    : diagnostics.checks.ollama.error
                }
              />
              <div className="pt-2 border-t border-neutral-800">
                <p className="text-xs text-neutral-500 mb-2">Council voices</p>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.providers.map((p) => (
                    <span
                      key={p.name}
                      className={
                        "text-xs px-2 py-1 rounded border " +
                        (p.available
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-neutral-800 bg-neutral-900 text-neutral-500")
                      }
                    >
                      {p.display_name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}

function moduleEntryReaderTarget(entry: ModuleEntry) {
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

type DataSourceStatus = "bundled" | "user-imported" | "deferred";

function resourceSourceStatus(source: ResourceSource): DataSourceStatus {
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

function resourceSourceMetadata(source: ResourceSource) {
  const metadata = readJsonRecord(source.metadata_json);
  const nested = readRecord(metadata.metadata);
  const shareAlike =
    readString(metadata.share_alike_requirements) ??
    readString(metadata.shareAlikeRequirements) ??
    readString(nested.share_alike_requirements) ??
    readString(nested.shareAlikeRequirements);
  return {
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

function hasSettingValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function SetupPathButton({
  active,
  label,
  detail,
  onClick,
  testId,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={
        "text-left rounded-md border px-3 py-2 transition-colors " +
        (active
          ? "border-amber-500/45 bg-amber-500/12 text-amber-100"
          : "border-neutral-800 bg-neutral-950/35 text-neutral-300 hover:border-neutral-600")
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-neutral-500 mt-0.5">{detail}</span>
    </button>
  );
}

function SetupPathDetails({ path }: { path: SetupPath }) {
  const details =
    path === "personal"
      ? {
          title: "Use the user's own API subscriptions",
          body: "Best for hosted quality. Add one or more provider API keys, save, then test. A ChatGPT or Claude consumer subscription is separate from API billing.",
          steps: [
            "Create an API key in OpenAI, Anthropic, or Google AI Studio.",
            "Paste only the providers this user wants billed to their own account.",
            "Save and test, then check Council voice preview before submitting.",
          ],
        }
      : path === "gateway"
        ? {
            title: "Use a managed team gateway",
            body: "Best for public or team deployments. The gateway owns provider routing, policy, and billing so end users do not manage provider keys.",
            steps: [
              "Enter the gateway URL supplied by the app owner or team.",
              "Paste the optional gateway token if the gateway requires one.",
              "Save and test gateway health before running Council.",
            ],
          }
        : {
            title: "Use local or no hosted-key mode",
            body: "Best for offline reading or users who already have Claude Code configured locally. Ollama can support semantic retrieval, but Council voices still need Claude Code, a provider key, or a gateway.",
            steps: [
              "Use Claude Code login if available for Claude voice and synthesis.",
              "Set an Ollama host if local semantic retrieval should be tested.",
              "Run the setup test so skipped voices are visible before Council use.",
            ],
          };

  return (
    <div>
      <p className="text-sm font-medium text-neutral-100">{details.title}</p>
      <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{details.body}</p>
      <ol className="mt-3 grid gap-2">
        {details.steps.map((step, index) => (
          <li key={step} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm text-neutral-300">
            <span className="grid place-items-center h-6 w-6 rounded-full bg-neutral-900 text-xs text-amber-200 border border-neutral-800">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SetupCheckPill({
  label,
  state,
  detail,
}: {
  label: string;
  state: "ok" | "warning" | "pending";
  detail: string;
}) {
  const tone =
    state === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : state === "warning"
        ? "border-red-500/25 bg-red-500/10 text-red-200"
        : "border-neutral-800 bg-neutral-950/35 text-neutral-300";
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <p className="text-xs tracking-wider opacity-75">{label}</p>
      <p className="text-sm mt-0.5">{detail}</p>
    </div>
  );
}

function ProviderMiniStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-neutral-300">{label}</span>
      <span
        className={
          "text-[11px] px-2 py-0.5 rounded " +
          (active
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-neutral-900 text-neutral-500")
        }
      >
        {active ? "set" : "not set"}
      </span>
    </div>
  );
}

function SourceStatusBadge({ status }: { status: DataSourceStatus }) {
  const label =
    status === "bundled" ? "Bundled" : status === "deferred" ? "Deferred" : "User-imported";
  const tone =
    status === "bundled"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "deferred"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-sky-500/15 text-sky-300";
  return <span className={`text-[11px] px-2 py-0.5 rounded ${tone}`}>{label}</span>;
}

function ProviderStatusCard({
  label,
  configured,
  status,
  detail,
}: {
  label: string;
  configured: boolean;
  status?: boolean;
  detail?: string | null;
}) {
  const state =
    status === undefined ? (configured ? "configured" : "missing") : status ? "ok" : "check";
  return (
    <div className="soft-card px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-200">{label}</p>
        <span
          className={
            "text-[11px] px-2 py-0.5 rounded " +
            (state === "ok"
              ? "bg-emerald-500/15 text-emerald-300"
              : state === "configured"
                ? "bg-sky-500/15 text-sky-300"
                : state === "check"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-neutral-800 text-neutral-500")
          }
        >
          {state}
        </span>
      </div>
      {detail && <p className="text-xs text-neutral-500 mt-1">{detail}</p>}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-card px-3 py-2">
      <p className="text-xs tracking-wider text-neutral-500">{label}</p>
      <p className="text-sm text-neutral-300 mt-1">{value}</p>
    </div>
  );
}

function DiagnosticRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <p className="text-neutral-200">{label}</p>
        {detail && <p className="text-xs text-neutral-500 mt-0.5">{detail}</p>}
      </div>
      <span
        className={
          "text-xs px-2 py-0.5 rounded " +
          (ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/10 text-red-300")
        }
      >
        {ok ? "ok" : "check"}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
