import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  addStudyItem,
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
  type StudyWorkspace,
  type StudyWorkspaceSummary,
  type TheologyTopic,
} from "../../lib/bible";
import { renderWorkspaceHtml } from "./workspaceHtml";
import { renderWorkspaceMarkdown } from "./workspaceMarkdown";
import { ErrorState } from "../../components/StateViews";
import { WorkspaceItem } from "./WorkspaceItem";
import {
  mergeWorkspaceJudgments,
  payloadString,
  positiveIntegerPayloadValue,
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
  const [addingNote, setAddingNote] = useState(false);
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
    if (!workspace || addingNote) return;
    const body = noteBody.trim();
    if (!body) return;
    const title = noteTitle.trim() || "Study note";
    setAddingNote(true);
    try {
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
    } finally {
      setAddingNote(false);
    }
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
                    disabled={!noteBody.trim() || addingNote}
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
