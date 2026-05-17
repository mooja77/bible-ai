import { useEffect, useState } from "react";
import {
  createTheologyLink,
  listResourceCollections,
  listResourceSources,
  listTheologyTopics,
  searchResources,
  type ResourceCollection,
  type ResourceEntry,
  type ResourceSource,
  type TheologyTopic,
} from "../../lib/bible";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";

interface ResourcesPanelProps {
  onOpenDataSources?: () => void;
  onAskCouncil?: (question: string) => void;
}

const RESOURCE_IMPORT_DOC = "docs/open-resource-ingestion-plan.md";

export function ResourcesPanel({ onOpenDataSources, onAskCouncil }: ResourcesPanelProps) {
  const [sources, setSources] = useState<ResourceSource[]>([]);
  const [collections, setCollections] = useState<ResourceCollection[]>([]);
  const [topics, setTopics] = useState<TheologyTopic[]>([]);
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [collectionKind, setCollectionKind] = useState<string | null>(null);
  const [license, setLicense] = useState<string | null>(null);
  const [topicFilterId, setTopicFilterId] = useState<number | null>(null);
  const [entries, setEntries] = useState<ResourceEntry[]>([]);
  const [selected, setSelected] = useState<ResourceEntry | null>(null);
  const [linkTopicId, setLinkTopicId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listResourceSources(), listTheologyTopics(), listResourceCollections(null)])
      .then(([nextSources, nextTopics, nextCollections]) => {
        setSources(nextSources);
        setTopics(nextTopics);
        setCollections(nextCollections);
        setLinkTopicId(nextTopics[0]?.id ?? null);
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listResourceCollections(sourceId)
      .then((nextCollections) => {
        if (cancelled) return;
        setCollections(nextCollections);
        setCollectionKind((current) =>
          current && nextCollections.some((collection) => collection.kind === current)
            ? current
            : null,
        );
      })
      .catch((e) => {
        if (!cancelled) setStatus(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  useEffect(() => {
    let cancelled = false;
    searchResources(query, sourceId, collectionKind, license, topicFilterId, 30)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setSelected((current) =>
          current && rows.some((row) => row.id === current.id) ? current : rows[0] ?? null,
        );
      })
      .catch((e) => {
        if (!cancelled) setStatus(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [collectionKind, license, query, sourceId, topicFilterId]);

  const licenseOptions = Array.from(
    new Set(
      sources
        .filter((source) => !sourceId || source.id === sourceId)
        .map((source) => source.license)
        .filter(Boolean),
    ),
  ).sort();
  const kindOptions = Array.from(
    new Set(collections.map((collection) => collection.kind).filter(Boolean)),
  ).sort();
  const hasActiveSearchOrFilters =
    query.trim().length > 0 ||
    sourceId !== null ||
    collectionKind !== null ||
    license !== null ||
    topicFilterId !== null;

  const clearFilters = () => {
    setQuery("");
    setSourceId(null);
    setCollectionKind(null);
    setLicense(null);
    setTopicFilterId(null);
  };

  const showImportDocsPath = async () => {
    try {
      await navigator.clipboard.writeText(RESOURCE_IMPORT_DOC);
      setStatus(`Resource import docs path copied: ${RESOURCE_IMPORT_DOC}`);
    } catch {
      setStatus(`Resource import docs: ${RESOURCE_IMPORT_DOC}`);
    }
  };

  const selectedPayload = selected ? readResourcePayload(selected.payload_json) : {};
  const relatedScriptureRefs = resourceScriptureRefs(selectedPayload);
  const selectedCitation = selected ? resourceCitation(selected) : null;
  const selectedShareAlikeRequirements = resourceShareAlikeRequirements(
    selected?.share_alike_requirements,
    selectedPayload,
  );

  const attachToTheology = async () => {
    if (!selected?.id || !linkTopicId) return;
    await createTheologyLink({
      topic_id: linkTopicId,
      link_kind: "resource_entry",
      target_id: selected.id,
      title: selected.title ?? selected.ref_value ?? "Resource entry",
      payload_json: JSON.stringify({
        source: selected.source_title,
        collection: selected.collection_title,
        collection_kind: selected.collection_kind,
        license: selected.license,
        attribution: selected.attribution,
        share_alike_requirements: selectedShareAlikeRequirements,
        citation: selectedCitation,
        related_scripture_refs: relatedScriptureRefs,
      }),
    });
    setStatus("Resource linked to Theology.");
  };

  const askCouncilAboutResource = () => {
    if (!selected || !onAskCouncil) return;
    onAskCouncil(buildCouncilResourceQuestion(selected, selectedCitation, relatedScriptureRefs));
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <header className="surface-panel rounded-lg px-5 py-4">
        <h1 className="text-2xl font-semibold text-neutral-100">Resources</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Search open and public-domain study resources with visible source, license, and attribution.
        </p>
      </header>

      {status && (
        <div className="soft-card px-3 py-2 text-sm text-neutral-300" data-testid="resource-status">
          {status}
        </div>
      )}

      <section className="surface-panel rounded-lg p-4 space-y-3">
        <div className="grid md:grid-cols-[1fr_14rem_12rem_12rem_14rem] gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources, e.g. creed, church, creation"
            className="settings-input"
            aria-label="Search resources"
          />
          <select
            value={sourceId ?? ""}
            onChange={(e) => setSourceId(Number(e.target.value) || null)}
            className="settings-input"
            aria-label="Resource source filter"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id ?? ""}>
                {source.title}
              </option>
            ))}
          </select>
          <select
            value={collectionKind ?? ""}
            onChange={(e) => setCollectionKind(e.target.value || null)}
            className="settings-input"
            aria-label="Resource kind filter"
          >
            <option value="">All kinds</option>
            {kindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <select
            value={license ?? ""}
            onChange={(e) => setLicense(e.target.value || null)}
            className="settings-input"
            aria-label="Resource license filter"
          >
            <option value="">All licenses</option>
            {licenseOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={topicFilterId ?? ""}
            onChange={(e) => setTopicFilterId(Number(e.target.value) || null)}
            className="settings-input"
            aria-label="Resource theology topic filter"
          >
            <option value="">All topics</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid lg:grid-cols-[22rem_1fr] gap-4">
        <aside className="surface-panel rounded-lg p-3 space-y-2" data-testid="resource-results">
          <h2 className="text-xs tracking-wider text-neutral-500">Results</h2>
          {entries.length === 0 ? (
            <div className="space-y-3" data-testid="resource-empty-state">
              <p className="text-sm text-neutral-400">
                {sources.length === 0
                  ? "No resources imported yet."
                  : "No resources matched this search."}
              </p>
              <div className="flex flex-wrap gap-2">
                {hasActiveSearchOrFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    Clear filters
                  </button>
                )}
                {onOpenDataSources && (
                  <button
                    type="button"
                    onClick={onOpenDataSources}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    Open Data Sources
                  </button>
                )}
                <button
                  type="button"
                  onClick={showImportDocsPath}
                  className="btn-secondary px-2 py-1 text-xs"
                >
                  Import docs
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(entry)}
                    className={
                      "w-full text-left rounded border px-3 py-2 " +
                      (selected?.id === entry.id
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-neutral-900 bg-neutral-950/30 hover:border-neutral-700")
                    }
                  >
                    <span className="block text-sm text-neutral-100">
                      {entry.title ?? entry.ref_value ?? "Untitled"}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {entry.source_title} · {entry.collection_kind} · {entry.license}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="surface-panel rounded-lg p-5 space-y-4" data-testid="resource-detail">
          {selected ? (
            <>
              <div>
                <h2 className="text-xl font-semibold text-neutral-100">
                  {selected.title ?? selected.ref_value ?? "Resource entry"}
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  {selected.source_title} · {selected.collection_title} · {selected.collection_kind} · {selected.license}
                </p>
              </div>
              <div className="soft-card p-3" data-testid="resource-citation">
                <h3 className="text-xs tracking-wider text-neutral-500">Citation</h3>
                <p className="text-sm text-neutral-300 mt-1">{selectedCitation}</p>
                {relatedScriptureRefs.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs tracking-wider text-neutral-600">
                      Related Scripture
                    </h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {relatedScriptureRefs.map((ref) => (
                        <span
                          key={ref}
                          className="text-xs px-2 py-1 rounded bg-neutral-900 text-neutral-300"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
                {selected.body}
              </p>
              <div className="soft-card p-3">
                <h3 className="text-xs tracking-wider text-neutral-500">Attribution</h3>
                <p className="text-sm text-neutral-300 mt-1">{selected.attribution}</p>
                {selectedShareAlikeRequirements && (
                  <p className="text-xs text-amber-200 mt-2">
                    Share-alike: {selectedShareAlikeRequirements}
                  </p>
                )}
              </div>
              <div className="soft-card p-3 flex flex-wrap items-end gap-2">
                <label className="space-y-1">
                  <span className="block text-xs tracking-wider text-neutral-500">
                    Theology topic
                  </span>
                  <select
                    value={linkTopicId ?? ""}
                    onChange={(e) => setLinkTopicId(Number(e.target.value) || null)}
                    className="settings-input text-xs min-w-52"
                  >
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={attachToTheology}
                  disabled={!selected.id || !linkTopicId}
                  className="btn-primary px-3 py-1.5 text-sm"
                >
                  Link to Theology
                </button>
                <AddToWorkspaceMenu
                  kind="freeform"
                  title={`Resource: ${selected.title ?? selected.ref_value ?? "Entry"}`}
                  buttonLabel="Add to workspace"
                  payload={{
                    type: "resource_entry",
                    resource_entry_id: selected.id,
                    title: selected.title ?? selected.ref_value,
                    body: selected.body,
                    source_title: selected.source_title,
                    collection_title: selected.collection_title,
                    collection_kind: selected.collection_kind,
                    license: selected.license,
                    attribution: selected.attribution,
                    share_alike_requirements: selectedShareAlikeRequirements,
                    citation: selectedCitation,
                    related_scripture_refs: relatedScriptureRefs,
                  }}
                />
                {onAskCouncil && (
                  <button
                    type="button"
                    onClick={askCouncilAboutResource}
                    className="btn-secondary px-3 py-1.5 text-sm"
                  >
                    Ask Council
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Select a resource entry to inspect it.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function readResourcePayload(value: string | null | undefined): Record<string, unknown> {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resourceScriptureRefs(payload: Record<string, unknown>) {
  const value =
    payload.related_scripture_refs ?? payload.relatedScriptureRefs ?? payload.scripture_refs;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function resourceShareAlikeRequirements(
  sourceValue: string | null | undefined,
  payload: Record<string, unknown>,
) {
  const value =
    sourceValue ??
    payload.share_alike_requirements ??
    payload.shareAlikeRequirements ??
    asRecord(payload.metadata)?.share_alike_requirements;
  return typeof value === "string" && value.trim() && value.trim() !== "None."
    ? value.trim()
    : null;
}

function resourceCitation(entry: ResourceEntry) {
  const ref = entry.ref_value?.trim();
  const title = entry.title?.trim();
  const source = entry.source_title?.trim();
  const collection = entry.collection_title?.trim();
  const head = ref && title && ref !== title ? `${title}, ${ref}` : title || ref || "Resource entry";
  return [head, collection, source].filter(Boolean).join(" · ");
}

function buildCouncilResourceQuestion(
  entry: ResourceEntry,
  citation: string | null,
  relatedScriptureRefs: string[],
) {
  const title = entry.title?.trim() || entry.ref_value?.trim() || "this resource entry";
  const source = entry.source_title?.trim() || "an open resource";
  const excerpt = truncateForQuestion(entry.body ?? "", 900);
  const refs =
    relatedScriptureRefs.length > 0
      ? ` Related Scripture listed by the resource: ${relatedScriptureRefs.join(", ")}.`
      : "";
  const citationLine = citation ? ` Citation: ${citation}.` : "";
  return `Evaluate the theological claims in the resource excerpt "${title}" from ${source}.${citationLine}${refs} Explain which claims are well supported by Scripture, which need testing, what evidence could challenge them, and what questions I should answer before adopting the argument.\n\nExcerpt:\n${excerpt}`;
}

function truncateForQuestion(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}
