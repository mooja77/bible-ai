import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  addStudyItem,
  createTheologyLink,
  createStudyWorkspace,
  deleteStudyItem,
  deleteStudyWorkspace,
  explainPassage,
  getStudyWorkspace,
  listJudgmentsForWorkspace,
  listStudyWorkspaces,
  listTheologyTopics,
  reorderStudyItems,
  updateStudyItem,
  updateStudyWorkspace,
  writeWorkspaceHtml,
  writeWorkspaceMarkdown,
  writeWorkspaceMarkdownToPath,
  writeWorkspacePdf,
  type CouncilResponse,
  type StudyItem,
  type StudyWorkspace,
  type StudyWorkspaceSummary,
  type TheologyTopic,
} from "../../lib/bible";
import { renderWorkspaceHtml } from "./workspaceHtml";
import { renderWorkspaceMarkdown } from "./workspaceMarkdown";
import { ErrorState } from "../../components/StateViews";
import {
  isCouncilResponse,
  isObjectRecord,
  mergeWorkspaceJudgments,
  nonNegativeIntegerPayloadValue,
  payloadString,
  positiveIntegerPayloadValue,
  stripSnippetMarkup,
  studyItemMatches,
  workspaceSummaryMatches,
} from "./workspaceData";

interface Props {
  onJumpToVerse: (verseId: number, translationCode: string) => void;
  selectedWorkspaceId?: number | null;
  onChanged?: () => void;
  onAskCouncil?: (citation: string) => void;
  onRunSearch?: (query: string) => void;
  onOpenCouncilResult?: (question: string, response: CouncilResponse) => void;
}

function defaultMarkdownFilename(title: string) {
  const safeTitle =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 _-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "workspace";

  return `bible-ai-workspace-${safeTitle}.md`;
}

export function WorkspacesPanel({
  onJumpToVerse,
  selectedWorkspaceId,
  onChanged,
  onAskCouncil,
  onRunSearch,
  onOpenCouncilResult,
}: Props) {
  const [workspaces, setWorkspaces] = useState<StudyWorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<StudyWorkspace | null>(null);
  const [title, setTitle] = useState("");
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [theologyTopics, setTheologyTopics] = useState<TheologyTopic[]>([]);
  const workspaceListRequestId = useRef(0);
  const selectedIdRef = useRef<number | null>(null);

  const refreshList = useCallback(async () => {
    const requestId = ++workspaceListRequestId.current;
    const rows = await listStudyWorkspaces();
    if (requestId !== workspaceListRequestId.current) return;
    setWorkspaces(rows);
    setSelectedId((current) =>
      current && rows.some((workspace) => workspace.id === current)
        ? current
        : rows[0]?.id ?? null,
    );
  }, []);

  const loadWorkspace = useCallback(async (workspaceId: number) => {
    const [nextWorkspace, judgments] = await Promise.all([
      getStudyWorkspace(workspaceId),
      listJudgmentsForWorkspace(workspaceId),
    ]);
    return mergeWorkspaceJudgments(nextWorkspace, judgments);
  }, []);

  useEffect(() => {
    refreshList().catch((e) => setError(String(e)));
  }, [refreshList]);

  useEffect(() => {
    let cancelled = false;
    listTheologyTopics()
      .then((topics) => {
        if (!cancelled) setTheologyTopics(topics);
      })
      .catch(() => {
        if (!cancelled) setTheologyTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) setSelectedId(selectedWorkspaceId);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    setWorkspace(null);
    loadWorkspace(selectedId)
      .then((nextWorkspace) => {
        if (!cancelled) setWorkspace(nextWorkspace);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace, selectedId]);

  useEffect(() => {
    setDetailTitle(workspace?.title ?? "");
    setDetailDescription(workspace?.description ?? "");
    setDetailsSaved(false);
    setSavedPath(null);
    setNoteTitle("");
    setNoteBody("");
    setNoteSaved(false);
  }, [workspace?.id, workspace?.title, workspace?.description]);

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const id = await createStudyWorkspace(trimmed);
      setTitle("");
      await refreshList();
      setSelectedId(id);
      onChanged?.();
    } catch (e) {
      setError(String(e));
    }
  };

  const markdown = useMemo(
    () => (workspace ? renderWorkspaceMarkdown(workspace) : ""),
    [workspace],
  );
  const html = useMemo(
    () => (workspace ? renderWorkspaceHtml(workspace.title, markdown) : ""),
    [markdown, workspace],
  );

  const filteredWorkspaces = useMemo(() => {
    const query = workspaceQuery.trim().toLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((workspace) => workspaceSummaryMatches(workspace, query));
  }, [workspaceQuery, workspaces]);

  const visibleItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!workspace || !query) return workspace?.items ?? [];
    return workspace.items.filter((item) => studyItemMatches(item, query));
  }, [itemQuery, workspace]);

  const copyMarkdown = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const saveMarkdown = async () => {
    if (!workspace || !markdown) return;
    try {
      setSavedPath(await writeWorkspaceMarkdown(workspace.title, markdown));
    } catch (e) {
      setError(String(e));
    }
  };

  const saveMarkdownAs = async () => {
    if (!workspace || !markdown) return;
    try {
      const path = await saveDialog({
        defaultPath: defaultMarkdownFilename(workspace.title),
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      setSavedPath(await writeWorkspaceMarkdownToPath(path, markdown));
    } catch (e) {
      setError(String(e));
    }
  };

  const saveHtml = async () => {
    if (!workspace || !html) return;
    try {
      setSavedPath(await writeWorkspaceHtml(workspace.title, html));
    } catch (e) {
      setError(String(e));
    }
  };

  const savePdf = async () => {
    if (!workspace || !markdown) return;
    try {
      setSavedPath(await writeWorkspacePdf(workspace.title, markdown));
    } catch (e) {
      setError(String(e));
    }
  };

  const refreshWorkspace = async (workspaceId: number) => {
    const next = await loadWorkspace(workspaceId);
    if (selectedIdRef.current === workspaceId) setWorkspace(next);
    await refreshList();
    onChanged?.();
  };

  const saveWorkspaceDetails = async () => {
    if (!workspace) return;
    const trimmed = detailTitle.trim();
    if (!trimmed) {
      setError("workspace title is required");
      return;
    }
    await updateStudyWorkspace(
      workspace.id,
      trimmed,
      detailDescription.trim() || null,
      false,
    );
    await refreshWorkspace(workspace.id);
    setDetailsSaved(true);
    window.setTimeout(() => setDetailsSaved(false), 1500);
  };

  const archiveWorkspace = async () => {
    if (!workspace) return;
    const trimmed = detailTitle.trim() || workspace.title;
    await updateStudyWorkspace(
      workspace.id,
      trimmed,
      detailDescription.trim() || null,
      true,
    );
    setWorkspace(null);
    setSelectedId(null);
    await refreshList();
    onChanged?.();
  };

  const addWorkspaceNote = async () => {
    if (!workspace) return;
    const body = noteBody.trim();
    if (!body) return;
    const title = noteTitle.trim() || "Study note";
    await addStudyItem(workspace.id, "note", title, {
      title,
      body,
      created_from: "workspace",
    });
    setNoteTitle("");
    setNoteBody("");
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 1500);
    await refreshWorkspace(workspace.id);
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    if (!workspace) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= workspace.items.length) return;
    const itemIds = workspace.items.map((item) => item.id);
    [itemIds[index], itemIds[nextIndex]] = [itemIds[nextIndex], itemIds[index]];
    await reorderStudyItems(workspace.id, itemIds);
    await refreshWorkspace(workspace.id);
  };

  return (
    <div className="h-full flex">
      <aside className="app-sidebar w-80 border-r border-neutral-800 p-4 overflow-y-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold text-neutral-100">Workspaces</h1>
          <p className="text-sm text-neutral-500 mt-1">Saved passages, searches, and Council work.</p>
        </header>

        <div className="flex gap-2 mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
            placeholder="New workspace"
            className="settings-input text-xs"
          />
          <button
            type="button"
            onClick={create}
            className="btn-secondary px-3 text-sm"
          >
            New
          </button>
        </div>

        <input
          value={workspaceQuery}
          onChange={(e) => setWorkspaceQuery(e.target.value)}
          placeholder="Filter workspaces"
          className="settings-input text-xs mb-3"
          aria-label="Filter workspaces"
        />

        {error && <ErrorState message={error} title={null} className="mb-3" />}

        {filteredWorkspaces.length === 0 ? (
          <p className="text-xs text-neutral-500">
            {workspaces.length === 0 ? "No workspaces yet." : "No workspaces match that filter."}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredWorkspaces.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setSelectedId(w.id)}
                className={
                  "w-full text-left rounded px-3 py-2 text-sm " +
                  (selectedId === w.id
                    ? "bg-neutral-800 text-neutral-100"
                    : "hover:bg-neutral-900 text-neutral-300")
                }
              >
                <span className="block truncate">{w.title}</span>
                <span className="text-xs text-neutral-500">
                  {w.item_count} item{w.item_count === 1 ? "" : "s"}
                </span>
              </button>
            </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        {!workspace ? (
          <div className="h-full grid place-items-center">
            <div className="soft-card max-w-sm px-5 py-4 text-center">
              <p className="text-sm font-semibold text-neutral-100">No workspace selected</p>
              <p className="text-sm text-neutral-500 mt-1">
                Create a workspace or select one from the list to review saved study material.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <header className="border-b border-neutral-800 pb-4 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <h2 className="text-2xl font-semibold text-neutral-100">{workspace.title}</h2>
                <div className="grid gap-2 max-w-xl">
                  <input
                    aria-label="Workspace title"
                    value={detailTitle}
                    onChange={(e) => {
                      setDetailTitle(e.target.value);
                      setDetailsSaved(false);
                    }}
                    className="settings-input text-sm"
                  />
                  <textarea
                    aria-label="Workspace description"
                    value={detailDescription}
                    onChange={(e) => {
                      setDetailDescription(e.target.value);
                      setDetailsSaved(false);
                    }}
                    placeholder="Description"
                    rows={2}
                    className="settings-input text-sm resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveWorkspaceDetails}
                      className="btn-secondary px-3 py-1.5 text-sm"
                    >
                      Save Details
                    </button>
                    {detailsSaved && (
                      <span className="text-xs text-emerald-300">Details saved</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={copyMarkdown}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  {copied ? "Copied" : "Copy Markdown"}
                </button>
                <button
                  type="button"
                  onClick={saveMarkdown}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Save Markdown
                </button>
                <button
                  type="button"
                  onClick={saveMarkdownAs}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Save As...
                </button>
                <button
                  type="button"
                  onClick={saveHtml}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Save HTML
                </button>
                <button
                  type="button"
                  onClick={savePdf}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen((x) => !x)}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  {previewOpen ? "Hide Preview" : "Preview Markdown"}
                </button>
                <button
                  type="button"
                  data-testid="delete-workspace"
                  onClick={async () => {
                    await deleteStudyWorkspace(workspace.id);
                    setWorkspace(null);
                    setSelectedId(null);
                    await refreshList();
                    onChanged?.();
                  }}
                  className="btn-danger px-3 py-1.5 text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={archiveWorkspace}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Archive
                </button>
              </div>
            </header>
            {savedPath && (
              <p className="text-xs text-neutral-500" data-testid="workspace-save-status">
                Saved export {savedPath}
              </p>
            )}

            <section className="soft-card p-4">
              <h3 className="text-sm tracking-wider text-neutral-400 mb-3">
                Workspace Note
              </h3>
              <div className="grid gap-2">
                <input
                  aria-label="Workspace note title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title"
                  className="settings-input text-sm"
                />
                <textarea
                  aria-label="Workspace note body"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Write a note for this workspace..."
                  rows={4}
                  className="settings-input text-sm resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addWorkspaceNote}
                    disabled={!noteBody.trim()}
                    className="btn-secondary px-3 py-1.5 text-sm"
                  >
                    Add Note
                  </button>
                  {noteSaved && <span className="text-xs text-emerald-300">Note added</span>}
                </div>
              </div>
            </section>

            {workspace.items.length === 0 ? (
              <p className="text-neutral-500">Add verses, search hits, or Council answers from elsewhere in the app.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <input
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    placeholder="Filter items by title, note, citation, or Council text"
                    className="settings-input text-sm max-w-xl"
                    aria-label="Filter workspace items"
                  />
                  <span className="text-xs text-neutral-500">
                    {visibleItems.length}/{workspace.items.length} item
                    {workspace.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {previewOpen && (
                  <section className="surface-panel rounded-lg p-4">
                    <h3 className="text-sm tracking-wider text-neutral-400 mb-3">
                      Markdown Preview
                    </h3>
                    <pre
                      data-testid="markdown-preview"
                      className="max-h-96 overflow-auto whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed"
                    >
                      {markdown}
                    </pre>
                  </section>
                )}
                {visibleItems.length === 0 ? (
                  <p className="soft-card px-4 py-3 text-sm text-neutral-500">No workspace items match that filter.</p>
                ) : (
                  <ul className="space-y-3">
                    {visibleItems.map((item) => {
                      const index = workspace.items.findIndex((candidate) => candidate.id === item.id);
                      return (
                        <WorkspaceItem
                          key={item.id}
                          item={item}
                          onJumpToVerse={onJumpToVerse}
                          canMoveUp={index > 0}
                          canMoveDown={index >= 0 && index < workspace.items.length - 1}
                          onMoveUp={() => moveItem(index, -1)}
                          onMoveDown={() => moveItem(index, 1)}
                          onDelete={async () => {
                            await deleteStudyItem(item.id);
                            await refreshWorkspace(workspace.id);
                          }}
                          onUpdateTitle={async (nextTitle) => {
                            await updateStudyItem(item.id, nextTitle || null);
                            await refreshWorkspace(workspace.id);
                          }}
                          onUpdatePayload={async (nextPayload) => {
                            await updateStudyItem(item.id, item.title, nextPayload);
                            await refreshWorkspace(workspace.id);
                          }}
                          onAskCouncil={onAskCouncil}
                          onExplainItem={async () => {
                            const payload = item.payload;
                            const startVerseId = positiveIntegerPayloadValue(
                              payload.verse_id ?? payload.start_verse_id ?? 0,
                            );
                            if (!startVerseId) return;
                            const requestedEndVerseId = positiveIntegerPayloadValue(payload.end_verse_id);
                            const endVerseId =
                              requestedEndVerseId && requestedEndVerseId >= startVerseId
                                ? requestedEndVerseId
                                : startVerseId;
                            const translationCode = payloadString(payload.translation_code) ?? "KJV";
                            const citation = payloadString(payload.citation) ?? item.title ?? "Passage";
                            const explanation = await explainPassage(
                              translationCode,
                              startVerseId,
                              endVerseId,
                            );
                            await addStudyItem(workspace.id, "explanation", `Explanation: ${citation}`, {
                              ...explanation,
                              verse_id: positiveIntegerPayloadValue(payload.verse_id) ?? startVerseId,
                              start_verse_id: startVerseId,
                              end_verse_id: endVerseId,
                              citation,
                              translation_code: translationCode,
                            });
                            await refreshWorkspace(workspace.id);
                          }}
                          onRunSearch={onRunSearch}
                          onOpenCouncilResult={onOpenCouncilResult}
                          theologyTopics={theologyTopics}
                          workspaceId={workspace.id}
                          workspaceTitle={workspace.title}
                        />
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function WorkspaceItem({
  item,
  onJumpToVerse,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdateTitle,
  onUpdatePayload,
  onAskCouncil,
  onExplainItem,
  onRunSearch,
  onOpenCouncilResult,
  theologyTopics,
  workspaceId,
  workspaceTitle,
}: {
  item: StudyItem;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onDelete: () => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onUpdatePayload: (payload: Record<string, unknown>) => Promise<void>;
  onAskCouncil?: (citation: string) => void;
  onExplainItem?: () => Promise<void>;
  onRunSearch?: (query: string) => void;
  onOpenCouncilResult?: (question: string, response: CouncilResponse) => void;
  theologyTopics: TheologyTopic[];
  workspaceId: number;
  workspaceTitle: string;
}) {
  const payload = item.payload;
  const citation = payloadString(payload.citation) ?? item.title ?? item.kind;
  const translation = payloadString(payload.translation_code) ?? "KJV";
  const verseId = positiveIntegerPayloadValue(payload.verse_id ?? payload.start_verse_id);
  const searchQuery = payloadString(payload.query);
  const searchResultCount = nonNegativeIntegerPayloadValue(payload.result_count) ?? 0;
  const displayTitle = item.title ?? citation;
  const [draftTitle, setDraftTitle] = useState(displayTitle);
  const [titleSaved, setTitleSaved] = useState(false);
  const [copiedItem, setCopiedItem] = useState(false);
  const [explainingItem, setExplainingItem] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [theologyTopicId, setTheologyTopicId] = useState<number | null>(
    theologyTopics[0]?.id ?? null,
  );
  const [theologyLinkStatus, setTheologyLinkStatus] = useState("");

  useEffect(() => {
    setDraftTitle(displayTitle);
    setTitleSaved(false);
  }, [displayTitle]);

  useEffect(() => {
    setNoteDraft(String(payload.body ?? payload.text ?? ""));
    setNoteSaved(false);
  }, [payload.body, payload.text]);

  useEffect(() => {
    setTheologyTopicId((current) =>
      current && theologyTopics.some((topic) => topic.id === current)
        ? current
        : theologyTopics[0]?.id ?? null,
    );
  }, [theologyTopics]);

  const saveTitle = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === displayTitle) return;
    await onUpdateTitle(trimmed);
    setTitleSaved(true);
    window.setTimeout(() => setTitleSaved(false), 1500);
  };

  const saveNotePayload = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    await onUpdatePayload({ ...payload, title: displayTitle, body: trimmed });
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 1500);
  };

  const linkWorkspaceItemToTheology = async () => {
    if (!theologyTopicId) return;
    setTheologyLinkStatus("Linking...");
    try {
      await createTheologyLink({
        topic_id: theologyTopicId,
        link_kind: "workspace_item",
        target_id: item.id,
        title: displayTitle,
        payload_json: JSON.stringify({
          source: "workspace",
          workspace_id: workspaceId,
          workspace_title: workspaceTitle,
          item_id: item.id,
          item_kind: item.kind,
          title: displayTitle,
          citation,
          payload,
        }),
      });
      const topic = theologyTopics.find((topic) => topic.id === theologyTopicId);
      setTheologyLinkStatus(`Linked to ${topic?.title ?? "Theology"}.`);
    } catch (e) {
      setTheologyLinkStatus(String(e));
    }
  };

  return (
    <li className="soft-card soft-card-hover p-4" data-testid="workspace-item">
      <header className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wider text-neutral-500">{item.kind}</p>
          <h3 className="text-base font-semibold text-neutral-100">{displayTitle}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              aria-label={`Workspace item title: ${displayTitle}`}
              value={draftTitle}
              onChange={(e) => {
                setDraftTitle(e.target.value);
                setTitleSaved(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void saveTitle();
                }
              }}
              className="settings-input max-w-sm text-xs"
            />
            <button
              type="button"
              onClick={saveTitle}
              disabled={!draftTitle.trim() || draftTitle.trim() === displayTitle}
              className="btn-secondary px-2 py-1 text-xs"
            >
              Save title
            </button>
            {titleSaved && <span className="text-xs text-emerald-300">Item saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${item.title ?? item.kind} up`}
            data-testid="workspace-item-move-up"
            className="text-xs text-neutral-500 hover:text-neutral-200 disabled:text-neutral-700"
          >
            Up
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${item.title ?? item.kind} down`}
            data-testid="workspace-item-move-down"
            className="text-xs text-neutral-500 hover:text-neutral-200 disabled:text-neutral-700"
          >
            Down
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-neutral-500 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      </header>

      {(item.kind === "verse" || item.kind === "verse_range" || item.kind === "search_hit") && (
        <>
          {verseId && (
            <button
              type="button"
              onClick={() => onJumpToVerse(verseId, translation)}
              className="text-xs font-mono text-amber-300 hover:text-amber-200"
            >
              {citation} ({translation})
            </button>
          )}
          <p
            className="mt-2 text-sm text-neutral-200 leading-relaxed"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {stripSnippetMarkup(String(payload.text ?? payload.snippet ?? ""))}
          </p>
          {(item.kind === "verse" || item.kind === "verse_range") && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {onAskCouncil && (
                <button
                  type="button"
                  onClick={() => onAskCouncil(citation)}
                  className="text-xs text-amber-300 hover:text-amber-200"
                >
                  Ask Council
                </button>
              )}
              {onExplainItem && (
                <button
                  type="button"
                  aria-label={`Explain ${citation}`}
                  onClick={async () => {
                    setExplainingItem(true);
                    try {
                      await onExplainItem();
                    } finally {
                      setExplainingItem(false);
                    }
                  }}
                  disabled={explainingItem}
                  className="text-xs text-amber-300 hover:text-amber-200 disabled:text-neutral-600"
                >
                  {explainingItem ? "Explaining..." : "Explain"}
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    [
                      `${citation} (${translation})`,
                      "",
                      stripSnippetMarkup(String(payload.text ?? payload.snippet ?? "")),
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  );
                  setCopiedItem(true);
                  window.setTimeout(() => setCopiedItem(false), 1500);
                }}
                className="text-xs text-neutral-500 hover:text-neutral-200"
              >
                {copiedItem ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          {item.kind === "search_hit" && onRunSearch && searchQuery && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onRunSearch(searchQuery)}
                className="text-xs text-amber-300 hover:text-amber-200"
              >
                Rerun Search
              </button>
            </div>
          )}
        </>
      )}

      {(item.kind === "council_result" || item.kind === "council_session") && (
        <div className="text-sm text-neutral-300 space-y-2">
          <p className="text-neutral-400">{String(payload.question ?? "")}</p>
          <p>{String(payload.summary ?? payload.synthesis ?? "Council result saved.")}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onOpenCouncilResult && isCouncilResponse(payload.response) && (
              <button
                type="button"
                onClick={() =>
                  onOpenCouncilResult(
                    String(payload.question ?? displayTitle),
                    payload.response as CouncilResponse,
                  )
                }
                className="text-xs text-amber-300 hover:text-amber-200"
              >
                View in Council
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  [
                    displayTitle,
                    "",
                    `Question: ${String(payload.question ?? "")}`,
                    "",
                    String(payload.summary ?? payload.synthesis ?? "Council result saved."),
                  ]
                    .filter(Boolean)
                    .join("\n"),
                );
                setCopiedItem(true);
                window.setTimeout(() => setCopiedItem(false), 1500);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-200"
            >
              {copiedItem ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {(item.kind === "note" || item.kind === "freeform") && (
        <div className="text-sm text-neutral-300 space-y-2">
          <textarea
            aria-label={`Workspace note body: ${displayTitle}`}
            value={noteDraft}
            onChange={(e) => {
              setNoteDraft(e.target.value);
              setNoteSaved(false);
            }}
            rows={4}
            className="settings-input text-sm resize-y"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveNotePayload}
              disabled={!noteDraft.trim() || noteDraft.trim() === String(payload.body ?? payload.text ?? "").trim()}
              className="text-xs text-amber-300 hover:text-amber-200 disabled:text-neutral-600"
            >
              Save note
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`${displayTitle}\n\n${noteDraft.trim()}`);
                setCopiedItem(true);
                window.setTimeout(() => setCopiedItem(false), 1500);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-200"
            >
              {copiedItem ? "Copied" : "Copy"}
            </button>
            {noteSaved && <span className="text-xs text-emerald-300">Note saved</span>}
          </div>
        </div>
      )}

      {item.kind === "search" && (
        <div className="text-sm text-neutral-300 space-y-2">
          <p>
            Query: <span className="text-amber-200">{searchQuery ?? citation}</span>
          </p>
          <p className="text-xs text-neutral-500">
            {searchResultCount} result
            {searchResultCount === 1 ? "" : "s"} when saved
          </p>
          {onRunSearch && searchQuery && (
            <button
              type="button"
              onClick={() => onRunSearch(searchQuery)}
              className="text-xs text-amber-300 hover:text-amber-200"
            >
              Rerun Search
            </button>
          )}
          <SearchResultList payload={payload} onJumpToVerse={onJumpToVerse} />
        </div>
      )}

      {item.kind === "explanation" && (
        <div className="text-sm text-neutral-300 space-y-2">
          <p className="text-neutral-100">{String(payload.summary ?? "Explanation saved.")}</p>
          {Boolean(payload.context) && (
            <p className="text-xs text-neutral-500">{String(payload.context)}</p>
          )}
          {Array.isArray(payload.cautions) && payload.cautions.length > 0 && (
            <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
              {payload.cautions.map((caution, index) => (
                <li key={index}>{String(caution)}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {verseId && (
              <button
                type="button"
                onClick={() => onJumpToVerse(verseId, translation)}
                className="text-xs font-mono text-amber-300 hover:text-amber-200"
              >
                Open {citation} ({translation})
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  [
                    displayTitle,
                    "",
                    String(payload.summary ?? ""),
                    String(payload.context ?? ""),
                  ]
                    .filter(Boolean)
                    .join("\n"),
                );
                setCopiedItem(true);
                window.setTimeout(() => setCopiedItem(false), 1500);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-200"
            >
              {copiedItem ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {item.kind === "module_entry" && (
        <div className="text-sm text-neutral-300 space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-amber-300">
              {String(payload.module_title ?? "Module")}
            </span>
            {Boolean(payload.title) && (
              <span className="text-neutral-500">{String(payload.title)}</span>
            )}
            {Array.isArray(payload.strongs_codes) && payload.strongs_codes.length > 0 && (
              <span className="font-mono text-xs text-neutral-500">
                {payload.strongs_codes.map(String).join(", ")}
              </span>
            )}
          </div>
          <p className="text-neutral-200 leading-relaxed">{String(payload.body ?? "")}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {verseId && (
              <button
                type="button"
                onClick={() => onJumpToVerse(verseId, translation)}
                className="text-xs font-mono text-amber-300 hover:text-amber-200"
              >
                Open {citation} ({translation})
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  [
                    String(payload.module_title ?? "Module"),
                    String(payload.title ?? ""),
                    "",
                    String(payload.body ?? ""),
                  ]
                    .filter(Boolean)
                    .join("\n"),
                );
                setCopiedItem(true);
                window.setTimeout(() => setCopiedItem(false), 1500);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-200"
            >
              {copiedItem ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {theologyTopics.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-900 pt-3">
          <select
            value={theologyTopicId ?? ""}
            onChange={(e) => {
              setTheologyTopicId(Number(e.target.value) || null);
              setTheologyLinkStatus("");
            }}
            className="settings-input text-xs w-40"
            aria-label={`Workspace item theology topic: ${displayTitle}`}
          >
            {theologyTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={linkWorkspaceItemToTheology}
            disabled={!theologyTopicId}
            className="btn-secondary px-2 py-1 text-xs"
            data-testid="link-workspace-item-to-theology"
          >
            Link to Theology
          </button>
          {theologyLinkStatus && (
            <span className="text-xs text-neutral-400" data-testid="workspace-theology-status">
              {theologyLinkStatus}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function SearchResultList({
  payload,
  onJumpToVerse,
}: {
  payload: Record<string, unknown>;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const raw = payload.selected_results ?? payload.top_results;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return (
    <ul className="space-y-2 border-t border-neutral-800 pt-2">
      {raw.slice(0, 10).map((entry, index) => {
        if (!isObjectRecord(entry)) return null;
        const result = entry;
        const verseId = positiveIntegerPayloadValue(result.verse_id);
        const translation = payloadString(result.translation_code) ?? "KJV";
        const citation = payloadString(result.citation) ?? `Result ${index + 1}`;
        const snippet = payloadString(result.snippet) ?? payloadString(result.text) ?? "";
        return (
          <li key={`${translation}-${verseId ?? "no-verse"}-${index}`} className="text-sm">
            {verseId ? (
              <button
                type="button"
                onClick={() => onJumpToVerse(verseId, translation)}
                className="text-xs font-mono text-amber-300 hover:text-amber-200"
              >
                {citation} ({translation})
              </button>
            ) : (
              <span className="text-xs font-mono text-neutral-400">{citation}</span>
            )}
            <p
              className="mt-1 text-neutral-300"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {stripSnippetMarkup(snippet)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
