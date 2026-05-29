import { useEffect, useRef, useState } from "react";
import {
  listArgumentAnnotations,
  upsertArgumentAnnotation,
  type ArgumentAnnotation,
  type ArgumentMap,
  type ArgumentMapNode,
  type CouncilPosition,
  type CouncilResponse,
} from "../../lib/bible";
import { formatPercent } from "./councilTransparency";

export function CouncilArgumentMaps({
  sessionId,
  response,
  onAnnotationsChange,
}: {
  sessionId: number | null;
  response: CouncilResponse;
  onAnnotationsChange?: (annotations: ArgumentAnnotation[]) => void;
}) {
  const [annotations, setAnnotations] = useState<Record<string, ArgumentAnnotation>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingNode, setSavingNode] = useState<string | null>(null);
  const activeSessionId = useRef(sessionId);

  useEffect(() => {
    activeSessionId.current = sessionId;
    setSavingNode(null);
    if (!sessionId) {
      setAnnotations({});
      setDrafts({});
      return;
    }
    let cancelled = false;
    listArgumentAnnotations(sessionId)
      .then((rows) => {
        if (cancelled) return;
        const nextAnnotations = Object.fromEntries(rows.map((row) => [row.node_id, row]));
        setAnnotations(nextAnnotations);
        setDrafts(Object.fromEntries(rows.map((row) => [row.node_id, row.annotation])));
        onAnnotationsChange?.(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setAnnotations({});
          setDrafts({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onAnnotationsChange, sessionId]);

  const saveAnnotation = async (nodeId: string) => {
    if (!sessionId) return;
    const savingSessionId = sessionId;
    const annotation = (drafts[nodeId] ?? "").trim();
    setSavingNode(nodeId);
    try {
      const id = await upsertArgumentAnnotation({
        id: annotations[nodeId]?.id ?? null,
        council_session_id: sessionId,
        node_id: nodeId,
        annotation,
      });
      if (activeSessionId.current !== savingSessionId) return;
      setAnnotations((current) => {
        const next = {
          ...current,
          [nodeId]: {
            id,
            council_session_id: sessionId,
            node_id: nodeId,
            annotation,
          },
        };
        onAnnotationsChange?.(Object.values(next));
        return next;
      });
    } finally {
      if (activeSessionId.current === savingSessionId) setSavingNode(null);
    }
  };

  const maps = response.synthesis.positions.map((position) => ({
    position,
    map: position.argument_map ?? buildFallbackArgumentMap(position),
  }));

  return (
    <section className="surface-panel rounded-lg p-4 space-y-4" data-testid="council-argument-maps">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Argument Maps</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Claims, supports, assumptions, challenges, weaknesses, and your notes on each node.
        </p>
      </div>
      <div className="grid gap-4">
        {maps.map(({ position, map }) => (
          <div key={position.label} className="soft-card p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">{position.label}</h3>
                <p className="text-xs text-neutral-500">
                  Weight {formatPercent(position.weight)} · {map.nodes.length} nodes
                </p>
              </div>
              <div className="text-xs text-neutral-500 max-w-xl space-y-1">
                <p>
                  <span className="text-neutral-400">Weakest link:</span>{" "}
                  {position.weakest_link || position.why_not_higher || "No explicit weakness provided."}
                </p>
                <p>
                  <span className="text-neutral-400">Would change if:</span>{" "}
                  {position.what_would_change_this ||
                    "A stronger contrary evidence pattern or clearer cited support emerged."}
                </p>
              </div>
            </div>
            {position.interpretive_moves?.length ? (
              <div className="flex flex-wrap gap-1">
                {position.interpretive_moves.map((move) => (
                  <span
                    key={move}
                    className="text-[11px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-400"
                  >
                    {move}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="grid lg:grid-cols-2 gap-3">
              {map.nodes.map((node) => (
                <ArgumentNodeCard
                  key={node.id}
                  node={node}
                  annotation={drafts[node.id] ?? annotations[node.id]?.annotation ?? ""}
                  disabled={!sessionId}
                  saving={savingNode === node.id}
                  onChange={(value) =>
                    setDrafts((current) => ({ ...current, [node.id]: value }))
                  }
                  onSave={() => saveAnnotation(node.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArgumentNodeCard({
  node,
  annotation,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  node: ArgumentMapNode;
  annotation: string;
  disabled: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="border border-neutral-900 rounded p-3 bg-neutral-950/40">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] tracking-wide px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
          {node.kind}
        </span>
        <h4 className="text-sm font-semibold text-neutral-100">{node.label}</h4>
      </div>
      <p className="text-sm text-neutral-400">{node.detail}</p>
      {node.verse_ids?.length ? (
        <p className="text-[11px] text-neutral-600 mt-1">
          Verse IDs: {node.verse_ids.join(", ")}
        </p>
      ) : null}
      <label className="block mt-3 space-y-1">
        <span className="text-xs tracking-wider text-neutral-500">My annotation</span>
        <textarea
          value={annotation}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          disabled={disabled}
          className="settings-input resize-y"
          aria-label={`Annotation for ${node.label}`}
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
        className="btn-secondary mt-2 px-2 py-1 text-xs"
      >
        {saving ? "Saving..." : "Save annotation"}
      </button>
    </div>
  );
}

function buildFallbackArgumentMap(position: CouncilPosition): ArgumentMap {
  const claimId = `${slugifyNodeId(position.label)}-claim`;
  const nodes: ArgumentMapNode[] = [
    {
      id: claimId,
      kind: "claim",
      label: `${position.label} claim`,
      detail: position.summary || "This position was preserved by the Council.",
      verse_ids: position.evidence.map((evidence) => evidence.verse_id),
    },
    ...position.evidence.slice(0, 3).map((evidence, index) => ({
      id: `${slugifyNodeId(position.label)}-support-${index + 1}`,
      kind: "support" as const,
      label: evidence.citation,
      detail: evidence.reasoning || evidence.quote,
      verse_ids: [evidence.verse_id],
    })),
  ];
  if (position.why_not_higher) {
    nodes.push({
      id: `${slugifyNodeId(position.label)}-weakness`,
      kind: "weakness",
      label: "Why not higher",
      detail: position.why_not_higher,
      verse_ids: position.challenging_evidence_ids ?? [],
    });
  }
  const edges = nodes
    .filter((node) => node.id !== claimId)
    .map((node) => ({
      from: node.id,
      to: claimId,
      label: node.kind === "weakness" || node.kind === "challenge" ? "limits" : "supports",
    }));
  return { nodes, edges };
}

function slugifyNodeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
