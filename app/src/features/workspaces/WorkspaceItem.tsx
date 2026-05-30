import { useEffect, useState } from "react";
import {
  createTheologyLink,
  type CouncilResponse,
  type StudyItem,
  type TheologyTopic,
} from "../../lib/bible";
import {
  isCouncilResponse,
  isObjectRecord,
  nonNegativeIntegerPayloadValue,
  payloadString,
  positiveIntegerPayloadValue,
  stripSnippetMarkup,
} from "./workspaceData";

export function WorkspaceItem({
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
