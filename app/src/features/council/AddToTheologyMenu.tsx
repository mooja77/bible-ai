import { useState } from "react";
import { createTheologyLink, listTheologyTopics, type CouncilResponse, type TheologyTopic } from "../../lib/bible";

export function AddToTheologyMenu({
  sessionId,
  question,
  response,
}: {
  sessionId: number | null;
  question: string;
  response: CouncilResponse;
}) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<TheologyTopic[]>([]);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const onOpen = async () => {
    setOpen((current) => !current);
    if (topics.length === 0) {
      const rows = await listTheologyTopics();
      setTopics(rows);
      setTopicId(rows[0]?.id ?? null);
    }
  };

  const onSave = async () => {
    if (!sessionId || !topicId) return;
    setStatus("saving");
    try {
      await createTheologyLink({
        topic_id: topicId,
        link_kind: "council_session",
        target_id: sessionId,
        title: `Council: ${question.slice(0, 90)}`,
        payload_json: JSON.stringify({
          question,
          summary: response.synthesis.synthesis,
          confidence: response.synthesis.confidence,
          leading_position: response.synthesis.positions[0]?.label ?? null,
        }),
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <span className="relative inline-block ml-2">
      <button
        type="button"
        onClick={onOpen}
        disabled={!sessionId}
        className="btn-secondary px-2 py-0.5 text-xs"
      >
        Add to Theology
      </button>
      {open && (
        <span className="absolute right-0 z-20 mt-2 w-72 surface-panel rounded-lg border border-neutral-800 p-3 shadow-xl">
          <label className="block space-y-1">
            <span className="text-xs tracking-wider text-neutral-500">Topic</span>
            <select
              value={topicId ?? ""}
              onChange={(e) => setTopicId(Number(e.target.value) || null)}
              className="settings-input text-xs"
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
            onClick={onSave}
            disabled={!topicId || status === "saving"}
            className="btn-primary w-full mt-2 px-2 py-1 text-xs"
          >
            {status === "saving" ? "Adding..." : status === "saved" ? "Added" : "Attach session"}
          </button>
          {status === "error" && (
            <p className="text-xs text-red-300 mt-2">Could not attach this session.</p>
          )}
        </span>
      )}
    </span>
  );
}
