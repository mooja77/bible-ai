import { useEffect, useState } from "react";
import {
  addStudyItem,
  createStudyWorkspace,
  listStudyWorkspaces,
  type StudyItemKind,
  type StudyWorkspaceSummary,
} from "../../lib/bible";

interface Props {
  kind: StudyItemKind;
  title: string;
  payload: Record<string, unknown>;
  buttonLabel?: string;
  triggerTestId?: string;
  menuPlacement?: "bottom" | "top";
  onAdded?: (workspaceId: number) => void;
}

export function AddToWorkspaceMenu({
  kind,
  title,
  payload,
  buttonLabel = "Add to workspace",
  triggerTestId = "add-to-workspace-trigger",
  menuPlacement = "bottom",
  onAdded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<StudyWorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    listStudyWorkspaces()
      .then((rows) => {
        setWorkspaces(rows);
        setSelectedId(rows[0]?.id ?? "new");
      })
      .catch(() => setWorkspaces([]));
  }, [open]);

  const add = async () => {
    setBusy(true);
    setStatus(null);
    try {
      let workspaceId: number;
      if (selectedId === "new") {
        const name = newTitle.trim() || title;
        workspaceId = await createStudyWorkspace(name);
      } else {
        workspaceId = selectedId;
      }
      await addStudyItem(workspaceId, kind, title, payload);
      setStatus("Added");
      onAdded?.(workspaceId);
      window.setTimeout(() => setOpen(false), 700);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        data-testid={triggerTestId}
        className="btn-secondary px-2 py-1 text-xs"
      >
        {buttonLabel}
      </button>
      {open && (
        <div
          className={
            "surface-panel absolute z-30 right-0 w-72 rounded-lg p-3 space-y-3 " +
            (menuPlacement === "top" ? "bottom-full mb-2" : "mt-2")
          }
        >
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Workspace</span>
            <select
              value={selectedId}
              onChange={(e) =>
                setSelectedId(e.target.value === "new" ? "new" : Number(e.target.value))
              }
              data-testid="add-to-workspace-select"
              className="settings-input text-xs"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
              <option value="new">New workspace</option>
            </select>
          </label>

          {selectedId === "new" && (
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Workspace title"
              className="settings-input text-xs"
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={add}
              disabled={busy}
              data-testid="add-to-workspace-confirm"
              className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-100 text-xs disabled:text-neutral-600 disabled:border-neutral-800"
            >
              {busy ? "Adding..." : "Add"}
            </button>
            {status && <span className="text-xs text-neutral-400 truncate">{status}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
