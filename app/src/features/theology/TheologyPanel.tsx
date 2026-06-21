import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTheologyTopic,
  createTheologyLink,
  deleteTheologyLink,
  exportTheologyMarkdown,
  getGuidedStudySession,
  getTheologyConclusion,
  listGuidedStudySessionsForTopic,
  listTheologyLinks,
  listTheologyPositions,
  listTheologyTopics,
  updateTheologyTopic,
  upsertTheologyConclusion,
  upsertGuidedStudySession,
  upsertTheologyPosition,
  writeTheologyPdf,
  type GuidedStudySession,
  type TheologyConclusion,
  type TheologyLink,
  type TheologyPosition,
  type TheologyTopic,
} from "../../lib/bible";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";
import {
  DoctrineMap,
  ProgressMetric,
  TheologyEvidenceSection,
  TheologyTextarea,
} from "./TheologySections";
import {
  buildProgressSummary,
  buildStudyPrompts,
  buildTopicStats,
  groupTheologyEvidence,
  parseDoctrineRelation,
  readReviewCards,
  relationLabel,
  type DoctrineRelationPayload,
  type TopicStats,
} from "./theologyData";
import {
  GUIDED_TEMPLATES,
  buildGuidedReviewCards,
  buildGuidedStudyCouncilQuestion,
  guidedSessionPreview,
  guidedTemplateTitle,
  type GuidedTemplateSlug,
} from "./theologyGuided";

const CONFIDENCE_STEPS = [
  { value: 0, label: "Uncertain" },
  { value: 25, label: "Leaning" },
  { value: 50, label: "Moderate" },
  { value: 75, label: "Confident" },
  { value: 100, label: "Settled" },
] as const;

export function TheologyPanel({
  onAskCouncil,
  onOpenGuide,
  onOpenResources,
}: {
  onAskCouncil?: (question: string) => void;
  onOpenGuide?: () => void;
  onOpenResources?: () => void;
}) {
  const [topics, setTopics] = useState<TheologyTopic[]>([]);
  const [topicStats, setTopicStats] = useState<Record<number, TopicStats>>({});
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [conclusion, setConclusion] = useState<TheologyConclusion | null>(null);
  const [links, setLinks] = useState<TheologyLink[]>([]);
  const [positions, setPositions] = useState<TheologyPosition[]>([]);
  const [positionDraft, setPositionDraft] = useState<TheologyPosition | null>(null);
  const [manualLink, setManualLink] = useState<TheologyLink | null>(null);
  const [relationDraft, setRelationDraft] = useState<{
    relation: "depends_on" | "supports" | "tension";
    targetTopicId: number | null;
    note: string;
  }>({ relation: "depends_on", targetTopicId: null, note: "" });
  const [topicDraft, setTopicDraft] = useState<{
    title: string;
    summary: string;
    parentId: number | null;
  }>({ title: "", summary: "", parentId: null });
  const [editingTopic, setEditingTopic] = useState<TheologyTopic | null>(null);
  const [selectedGuidedTemplate, setSelectedGuidedTemplate] =
    useState<GuidedTemplateSlug>("doctrine-reflection");
  const [guided, setGuided] = useState<GuidedStudySession | null>(null);
  const [guidedSessions, setGuidedSessions] = useState<GuidedStudySession[]>([]);
  const [reviewCardIndex, setReviewCardIndex] = useState(0);
  const [reviewAnswerVisible, setReviewAnswerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exported, setExported] = useState(false);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topicStatsRequestId = useRef(0);

  useEffect(() => {
    refreshTopics()
      .finally(() => setLoading(false));
  }, []);

  const refreshTopics = async (preferredTopicId?: number | null) => {
    await listTheologyTopics()
      .then(async (rows) => {
        setTopics(rows);
        setSelectedTopicId((current) => preferredTopicId ?? current ?? rows[0]?.id ?? null);
        await refreshTopicStats(rows);
      })
      .catch((e) => setError(String(e)));
  };

  const refreshTopicStats = async (rows = topics) => {
    const requestId = ++topicStatsRequestId.current;
    const pairs = await Promise.all(
      rows.map(async (topic) => {
        const [topicConclusion, topicLinks] = await Promise.all([
          getTheologyConclusion(topic.id).catch(() => null),
          listTheologyLinks(topic.id).catch(() => []),
        ]);
        return [topic.id, buildTopicStats(topicConclusion, topicLinks)] as const;
      }),
    );
    if (requestId !== topicStatsRequestId.current) return;
    setTopicStats(Object.fromEntries(pairs));
  };

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );
  const selectedSubtopics = useMemo(
    () => topics.filter((topic) => topic.parent_id === selectedTopicId),
    [selectedTopicId, topics],
  );
  const doctrineRelations = useMemo(
    () =>
      links
        .map((link) => ({ link, payload: parseDoctrineRelation(link) }))
        .filter((item): item is { link: TheologyLink; payload: DoctrineRelationPayload } =>
          Boolean(item.payload),
        ),
    [links],
  );
  const evidenceGroups = useMemo(() => groupTheologyEvidence(links), [links]);
  const evidenceLinkCount = useMemo(
    () => evidenceGroups.reduce((sum, group) => sum + group.links.length, 0),
    [evidenceGroups],
  );
  const selectedStats = selectedTopic ? topicStats[selectedTopic.id] : null;
  const studyPrompts = useMemo(
    () =>
      selectedTopic
        ? buildStudyPrompts(
            selectedTopic,
            selectedStats,
            conclusion,
            positions,
            doctrineRelations,
            selectedSubtopics,
          )
        : [],
    [conclusion, doctrineRelations, links, positions, selectedStats, selectedSubtopics, selectedTopic],
  );
  const progress = useMemo(() => buildProgressSummary(topics, topicStats), [topicStats, topics]);
  const guidedTemplate =
    GUIDED_TEMPLATES.find((template) => template.slug === selectedGuidedTemplate) ??
    GUIDED_TEMPLATES[0];
  const reviewCards = useMemo(
    () => readReviewCards(guided?.review_cards_json),
    [guided?.review_cards_json],
  );
  const activeReviewCard = reviewCards[reviewCardIndex] ?? reviewCards[0] ?? null;

  useEffect(() => {
    setReviewCardIndex((current) =>
      reviewCards.length === 0 ? 0 : Math.min(current, reviewCards.length - 1),
    );
    setReviewAnswerVisible(false);
  }, [reviewCards.length]);

  useEffect(() => {
    setEditingTopic(selectedTopic);
  }, [selectedTopic]);

  useEffect(() => {
    if (!selectedTopicId) {
      setConclusion(null);
      setGuidedSessions([]);
      return;
    }
    let cancelled = false;
    getTheologyConclusion(selectedTopicId)
      .then((row) => {
        if (cancelled) return;
        setConclusion(
          row ?? {
            topic_id: selectedTopicId,
            conclusion: "",
            confidence: null,
            unresolved_questions: "",
            changed_over_time: "",
          },
        );
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    listTheologyLinks(selectedTopicId)
      .then((rows) => {
        if (!cancelled) setLinks(rows);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    listTheologyPositions(selectedTopicId)
      .then((rows) => {
        if (cancelled) return;
        setPositions(rows);
        setPositionDraft({
          topic_id: selectedTopicId,
          label: "",
          tradition_family: "",
          summary: "",
          strengths: "",
          weaknesses: "",
          sort_order: rows.length + 1,
        });
        setManualLink({
          topic_id: selectedTopicId,
          link_kind: "verse",
          target_id: null,
          title: "",
          payload_json: "{}",
        });
      })
      .catch(() => {
        if (!cancelled) setPositions([]);
      });
    listGuidedStudySessionsForTopic(selectedTopicId)
      .then((rows) => {
        if (!cancelled) setGuidedSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setGuidedSessions([]);
      });
    getGuidedStudySession(selectedTopicId, selectedGuidedTemplate)
      .then((row) => {
        if (cancelled) return;
        setGuided(
          row ?? {
            topic_id: selectedTopicId,
            template_slug: selectedGuidedTemplate,
            focus_question: "",
            before_response: "",
            after_response: "",
            critique: "",
            review_cards_json: "[]",
          },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setGuided({
            topic_id: selectedTopicId,
            template_slug: selectedGuidedTemplate,
            focus_question: "",
            before_response: "",
            after_response: "",
            critique: "",
            review_cards_json: "[]",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGuidedTemplate, selectedTopicId]);

  useEffect(() => {
    if (!selectedTopicId) {
      setRelationDraft((current) =>
        current.targetTopicId === null ? current : { ...current, targetTopicId: null },
      );
      return;
    }
    setRelationDraft((current) => {
      const currentTargetStillValid =
        current.targetTopicId !== null &&
        topics.some((topic) => topic.id === current.targetTopicId && topic.id !== selectedTopicId);
      if (currentTargetStillValid) return current;
      const nextTargetId = topics.find((topic) => topic.id !== selectedTopicId)?.id ?? null;
      return current.targetTopicId === nextTargetId
        ? current
        : { ...current, targetTopicId: nextTargetId };
    });
  }, [selectedTopicId, topics]);

  const updateConclusion = (patch: Partial<TheologyConclusion>) => {
    setConclusion((current) => (current ? { ...current, ...patch } : current));
  };

  const addStudyPromptToOpenQuestions = (question: string) => {
    setConclusion((current) => {
      if (!current) return current;
      const existing = current.unresolved_questions?.trim() ?? "";
      if (existing.includes(question)) return current;
      return {
        ...current,
        unresolved_questions: [existing, question].filter(Boolean).join("\n"),
      };
    });
  };

  const useStudyPromptInGuidedStudy = (question: string) => {
    setGuided((current) =>
      current
        ? {
            ...current,
            focus_question: question,
          }
        : current,
    );
  };

  const removeLink = async (id: number) => {
    await deleteTheologyLink(id);
    setLinks((current) => current.filter((link) => link.id !== id));
    await refreshTopicStats();
  };

  const saveManualLink = async () => {
    if (!manualLink || !manualLink.title?.trim() || saving) return;
    setSaving(true);
    try {
      const id = await createTheologyLink(manualLink);
      setLinks((current) => [{ ...manualLink, id }, ...current]);
      setManualLink({
        topic_id: manualLink.topic_id,
        link_kind: "verse",
        target_id: null,
        title: "",
        payload_json: "{}",
      });
      await refreshTopicStats();
    } finally {
      setSaving(false);
    }
  };

  const saveDoctrineRelation = async () => {
    if (!selectedTopicId || !relationDraft.targetTopicId || saving) return;
    const target = topics.find((topic) => topic.id === relationDraft.targetTopicId);
    if (!target) return;
    const title = `${relationLabel(relationDraft.relation)}: ${target.title}`;
    const link: TheologyLink = {
      topic_id: selectedTopicId,
      link_kind: "note",
      target_id: target.id,
      title,
      payload_json: JSON.stringify({
        type: "doctrine_relation",
        relation: relationDraft.relation,
        target_topic_id: target.id,
        target_topic_title: target.title,
        note: relationDraft.note.trim(),
      }),
    };
    setSaving(true);
    try {
      const id = await createTheologyLink(link);
      setLinks((current) => [{ ...link, id }, ...current]);
      setRelationDraft({ relation: relationDraft.relation, targetTopicId: target.id, note: "" });
      await refreshTopicStats();
    } finally {
      setSaving(false);
    }
  };

  const createTopic = async () => {
    const title = topicDraft.title.trim();
    if (!title) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createTheologyTopic(
        title,
        topicDraft.summary.trim() || null,
        topicDraft.parentId,
      );
      setTopicDraft({ title: "", summary: "", parentId: null });
      await refreshTopics(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveTopic = async () => {
    if (!editingTopic || !editingTopic.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateTheologyTopic(editingTopic);
      await refreshTopics(editingTopic.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const copyMarkdown = async () => {
    if (!selectedTopicId) return;
    const markdown = await exportTheologyMarkdown(selectedTopicId);
    await navigator.clipboard.writeText(markdown);
    setExported(true);
    window.setTimeout(() => setExported(false), 1500);
  };

  const copyFullMarkdown = async () => {
    const markdown = await exportTheologyMarkdown(null);
    await navigator.clipboard.writeText(markdown);
    setExported(true);
    window.setTimeout(() => setExported(false), 1500);
  };

  const copyTopicTreeMarkdown = async () => {
    if (!selectedTopicId) return;
    const markdown = await exportTheologyMarkdown(selectedTopicId, true);
    await navigator.clipboard.writeText(markdown);
    setExported(true);
    window.setTimeout(() => setExported(false), 1500);
  };

  const savePdf = async () => {
    if (!selectedTopicId || !selectedTopic) return;
    const markdown = await exportTheologyMarkdown(selectedTopicId);
    setSavedPdfPath(await writeTheologyPdf(selectedTopic.title, markdown));
  };

  const saveFullPdf = async () => {
    const markdown = await exportTheologyMarkdown(null);
    setSavedPdfPath(await writeTheologyPdf("My Theology", markdown));
  };

  const saveTopicTreePdf = async () => {
    if (!selectedTopicId || !selectedTopic) return;
    const markdown = await exportTheologyMarkdown(selectedTopicId, true);
    setSavedPdfPath(await writeTheologyPdf(`${selectedTopic.title} with subtopics`, markdown));
  };

  const updateGuided = (patch: Partial<GuidedStudySession>) => {
    setGuided((current) => (current ? { ...current, ...patch } : current));
  };

  const saveGuided = async (complete = false) => {
    if (!guided) return;
    const nextReviewCards = buildGuidedReviewCards(
      conclusion,
      guided,
      guidedTemplate,
      links,
      positions,
    );
    const next = {
      ...guided,
      review_cards_json: JSON.stringify(nextReviewCards),
      completed_at: complete ? new Date().toISOString() : guided.completed_at,
    };
    const id = await upsertGuidedStudySession(next);
    setGuided({ ...next, id });
    if (selectedTopicId) {
      setGuidedSessions(await listGuidedStudySessionsForTopic(selectedTopicId));
    }
  };

  const savePosition = async () => {
    if (!positionDraft || !positionDraft.label.trim() || saving) return;
    setSaving(true);
    try {
      const id = await upsertTheologyPosition(positionDraft);
      const saved = { ...positionDraft, id };
      setPositions((current) =>
        [...current.filter((position) => position.id !== id), saved].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label),
        ),
      );
      setPositionDraft({
        topic_id: positionDraft.topic_id,
        label: "",
        tradition_family: "",
        summary: "",
        strengths: "",
        weaknesses: "",
        sort_order: positions.length + 2,
      });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!conclusion) return;
    setSaving(true);
    setError(null);
    try {
      const id = await upsertTheologyConclusion(conclusion);
      setConclusion({ ...conclusion, id });
      await refreshTopicStats();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="editorial-page-header mb-6">
        <span className="section-kicker">Systematic theology</span>
        <h1 className="text-2xl font-semibold text-neutral-100">Theology</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Build a living systematic theology from Scripture, Council sessions, resources,
          workspaces, and your own conclusions.
        </p>
      </div>

      {error && (
        <div className="border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid xl:grid-cols-[18rem_1fr_16rem] lg:grid-cols-[18rem_1fr] gap-4">
        <aside className="space-y-3 border-r border-[var(--border-subtle)] pr-4">
          <span className="section-kicker">Topics</span>
          <div className="soft-card p-2 space-y-2" data-testid="create-theology-topic">
            <input
              value={topicDraft.title}
              onChange={(e) => setTopicDraft({ ...topicDraft, title: e.target.value })}
              placeholder="New topic"
              aria-label="New theology topic title"
              className="settings-input text-xs"
            />
            <textarea
              value={topicDraft.summary}
              onChange={(e) => setTopicDraft({ ...topicDraft, summary: e.target.value })}
              placeholder="Short summary"
              aria-label="New theology topic summary"
              rows={2}
              className="settings-input resize-y"
            />
            <select
              value={topicDraft.parentId ?? ""}
              onChange={(e) =>
                setTopicDraft({
                  ...topicDraft,
                  parentId: Number(e.target.value) || null,
                })
              }
              aria-label="New theology topic parent"
              className="settings-input text-xs"
            >
              <option value="">Top-level topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  Under {topic.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createTopic}
              disabled={!topicDraft.title.trim() || saving}
              className="btn-secondary px-2 py-1 text-xs w-full"
            >
              Create topic
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading topics...</p>
          ) : (
            <div className="space-y-1">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                  aria-label={`Select theology topic ${topic.title}`}
                  className={
                    "w-full text-left px-3 py-2 transition " +
                    (topic.id === selectedTopicId ? "topic-pill-active" : "topic-pill-idle")
                  }
                >
                  <span className="block text-sm font-medium">{topic.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1 text-[0.68rem] tracking-wider text-neutral-500">
                    <span>{topicStats[topic.id]?.status ?? "not started"}</span>
                    <span>{topicStats[topic.id]?.passageCount ?? 0} passages</span>
                    <span>{topicStats[topic.id]?.councilCount ?? 0} councils</span>
                  </span>
                  {topic.summary && (
                    <span className="block text-xs text-neutral-500 mt-0.5 line-clamp-2">
                      {topic.summary}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="surface-panel rounded-lg p-5 space-y-5">
          {selectedTopic && conclusion ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-100">
                    {selectedTopic.title}
                  </h2>
                  {selectedTopic.summary && (
                    <p className="text-sm text-neutral-500 mt-1">{selectedTopic.summary}</p>
                  )}
                  {selectedStats && (
                    <p className="text-xs text-neutral-500 mt-2">
                      {selectedStats.status} · {selectedStats.passageCount} passage
                      {selectedStats.passageCount === 1 ? "" : "s"} · {selectedStats.councilCount} Council session
                      {selectedStats.councilCount === 1 ? "" : "s"} · {selectedStats.openQuestionCount} open question
                      {selectedStats.openQuestionCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onAskCouncil && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskCouncil(
                          `Discuss the doctrine of ${selectedTopic.title}. Compare major biblical arguments, disputed interpretations, key passages, unresolved questions, and what evidence would change each position.`,
                        )
                      }
                      className="btn-secondary px-3 py-1.5 text-sm"
                    >
                      Ask Council
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="btn-primary px-3 py-1.5 text-sm"
                  >
                    {saving ? "Saving..." : "Save conclusion"}
                  </button>
                  <div className="action-strip">
                    <button
                      type="button"
                      onClick={copyMarkdown}
                      className="btn-ghost px-3 py-1.5 text-sm"
                    >
                      {exported ? "Copied" : "Copy Markdown"}
                    </button>
                    <button
                      type="button"
                      onClick={copyFullMarkdown}
                      className="btn-ghost px-3 py-1.5 text-sm"
                    >
                      Copy Full Theology
                    </button>
                    <button
                      type="button"
                      onClick={copyTopicTreeMarkdown}
                      className="btn-ghost px-3 py-1.5 text-sm"
                    >
                      Copy Topic + Subtopics
                    </button>
                    <button
                      type="button"
                      onClick={savePdf}
                      className="btn-ghost px-3 py-1.5 text-sm"
                    >
                      Save PDF
                    </button>
                    <button
                      type="button"
                      onClick={saveFullPdf}
                      className="btn-ghost px-3 py-1.5 text-sm"
                    >
                      Save Full PDF
                    </button>
                    <button
                      type="button"
                      onClick={saveTopicTreePdf}
                      className="btn-ghost px-3 py-1.5 text-sm"
                    >
                      Save Topic + Subtopics PDF
                    </button>
                  </div>
                </div>
              </div>
              {savedPdfPath && (
                <p className="text-xs text-neutral-500">Saved PDF: {savedPdfPath}</p>
              )}

              {editingTopic && (
                <div className="space-y-2" data-testid="edit-theology-topic">
                  <div className="editorial-rule" aria-hidden="true" />
                  <span className="section-kicker">Topic details</span>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="editorial-section-h2">Topic details</h3>
                    <button
                      type="button"
                      onClick={saveTopic}
                      disabled={!editingTopic.title.trim() || saving}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Save topic
                    </button>
                  </div>
                  <input
                    value={editingTopic.title}
                    onChange={(e) =>
                      setEditingTopic({ ...editingTopic, title: e.target.value })
                    }
                    aria-label="Edit theology topic title"
                    className="settings-input text-sm"
                  />
                  <textarea
                    value={editingTopic.summary ?? ""}
                    onChange={(e) =>
                      setEditingTopic({ ...editingTopic, summary: e.target.value })
                    }
                    aria-label="Edit theology topic summary"
                    rows={3}
                    className="settings-input resize-y"
                  />
                  <select
                    value={editingTopic.parent_id ?? ""}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        parent_id: Number(e.target.value) || null,
                      })
                    }
                    aria-label="Edit theology topic parent"
                    className="settings-input text-sm"
                  >
                    <option value="">Top-level topic</option>
                    {topics
                      .filter((topic) => topic.id !== editingTopic.id)
                      .map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          Under {topic.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <section className="space-y-3" data-testid="theology-study-prompts">
                <div className="editorial-rule" aria-hidden="true" />
                <span className="section-kicker">Study prompts</span>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="editorial-section-h2">Key study questions</h3>
                  <span className="text-xs text-neutral-600">
                    {studyPrompts.length} prompt{studyPrompts.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid gap-2">
                  {studyPrompts.map((prompt) => (
                    <div key={prompt.question} className="rounded border border-neutral-900 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-neutral-200">{prompt.question}</p>
                          <p className="text-xs text-neutral-500 mt-1">{prompt.rationale}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addStudyPromptToOpenQuestions(prompt.question)}
                          className="btn-secondary px-2 py-1 text-xs shrink-0"
                        >
                          Add to open questions
                        </button>
                        <button
                          type="button"
                          onClick={() => useStudyPromptInGuidedStudy(prompt.question)}
                          className="btn-secondary px-2 py-1 text-xs shrink-0"
                        >
                          Use in guided study
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="space-y-2" data-testid="theology-subtopics">
                <div className="editorial-rule" aria-hidden="true" />
                <span className="section-kicker">Doctrine structure</span>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="editorial-section-h2">Subtopics</h3>
                  <span className="text-xs text-neutral-600">{selectedSubtopics.length} linked</span>
                </div>
                {selectedSubtopics.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Create a topic and choose this one as its parent to track doctrine dependencies.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {selectedSubtopics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicId(topic.id)}
                        className="text-left border border-neutral-900 rounded px-3 py-2 hover:border-neutral-700"
                      >
                        <span className="block text-sm text-neutral-100">{topic.title}</span>
                        {topic.summary && (
                          <span className="block text-xs text-neutral-500 mt-1">{topic.summary}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3" data-testid="doctrine-relations">
                <div className="editorial-rule" aria-hidden="true" />
                <span className="section-kicker">Doctrine map</span>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="editorial-section-h2">
                    Doctrine links and tensions
                  </h3>
                  <span className="text-xs text-neutral-600">
                    {doctrineRelations.length} saved
                  </span>
                </div>
                {doctrineRelations.length > 0 && (
                  <div className="grid gap-2">
                    {doctrineRelations.map(({ link, payload }) => (
                      <div
                        key={link.id}
                        className="border border-neutral-900 rounded px-3 py-2 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm text-neutral-100">
                            {relationLabel(payload.relation)}: {payload.target_topic_title}
                          </p>
                          {payload.note && (
                            <p className="text-sm text-neutral-400 mt-1">{payload.note}</p>
                          )}
                        </div>
                        {link.id && (
                          <button
                            type="button"
                            onClick={() => removeLink(link.id!)}
                            className="btn-secondary px-2 py-1 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid md:grid-cols-[9rem_1fr] gap-2 border-t border-neutral-900 pt-3">
                  <select
                    value={relationDraft.relation}
                    onChange={(e) =>
                      setRelationDraft({
                        ...relationDraft,
                        relation: e.target.value as typeof relationDraft.relation,
                      })
                    }
                    aria-label="Doctrine relation type"
                    className="settings-input text-xs"
                  >
                    <option value="depends_on">Depends on</option>
                    <option value="supports">Supports</option>
                    <option value="tension">Tension with</option>
                  </select>
                  <select
                    value={relationDraft.targetTopicId ?? ""}
                    onChange={(e) =>
                      setRelationDraft({
                        ...relationDraft,
                        targetTopicId: Number(e.target.value) || null,
                      })
                    }
                    aria-label="Doctrine relation target"
                    className="settings-input text-xs"
                  >
                    <option value="">Choose related topic</option>
                    {topics
                      .filter((topic) => topic.id !== selectedTopicId)
                      .map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                  </select>
                  <textarea
                    value={relationDraft.note}
                    onChange={(e) =>
                      setRelationDraft({ ...relationDraft, note: e.target.value })
                    }
                    rows={3}
                    placeholder="Why are these doctrines connected, dependent, or in tension?"
                    aria-label="Doctrine relation note"
                    className="settings-input resize-y md:col-span-2"
                  />
                  <button
                    type="button"
                    onClick={saveDoctrineRelation}
                    disabled={!relationDraft.targetTopicId || saving}
                    className="btn-secondary px-2 py-1 text-xs md:col-span-2"
                  >
                    Save doctrine link
                  </button>
                </div>
              </div>

              {selectedTopic && (
                <DoctrineMap
                  topic={selectedTopic}
                  subtopics={selectedSubtopics}
                  relations={doctrineRelations}
                />
              )}

              <TheologyTextarea
                label="My current conclusion"
                value={conclusion.conclusion ?? ""}
                onChange={(value) => updateConclusion({ conclusion: value })}
                rows={7}
              />

              <div className="soft-card p-3 space-y-2">
                <span className="section-kicker">Confidence</span>
                <div className="flex gap-1" role="group" aria-label="Theology confidence">
                  {CONFIDENCE_STEPS.map(({ value, label }) => {
                    const current = conclusion.confidence ?? 50;
                    const nearest = CONFIDENCE_STEPS.reduce((a, b) =>
                      Math.abs(b.value - current) < Math.abs(a.value - current) ? b : a,
                    );
                    const active = nearest.value === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={`Theology confidence: ${label}`}
                        aria-pressed={active}
                        onClick={() => updateConclusion({ confidence: value })}
                        className={
                          "flex-1 rounded px-2 py-1.5 text-xs transition " +
                          (active
                            ? "bg-[var(--accent-bg)] text-amber-200 border border-[var(--accent-border)]"
                            : "btn-ghost")
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <TheologyTextarea
                  label="Unresolved questions"
                  value={conclusion.unresolved_questions ?? ""}
                  onChange={(value) => updateConclusion({ unresolved_questions: value })}
                />
                <TheologyTextarea
                  label="How this has changed over time"
                  value={conclusion.changed_over_time ?? ""}
                  onChange={(value) => updateConclusion({ changed_over_time: value })}
                />
              </div>

              <div className="space-y-3" data-testid="theology-positions">
                <div className="editorial-rule" aria-hidden="true" />
                <span className="section-kicker">Positions</span>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="editorial-section-h2">Major positions</h3>
                  <span className="text-xs text-neutral-600">{positions.length} saved</span>
                </div>
                {positions.length > 0 && (
                  <div className="grid gap-2">
                    {positions.map((position) => (
                      <div
                        key={position.id ?? position.label}
                        className="border border-neutral-900 rounded px-3 py-2"
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-sm font-semibold text-neutral-100">{position.label}</p>
                          {position.tradition_family && (
                            <span className="text-xs text-neutral-500">
                              {position.tradition_family}
                            </span>
                          )}
                        </div>
                        {position.summary && (
                          <p className="text-sm text-neutral-400 mt-1">{position.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {positionDraft && (
                  <div className="grid md:grid-cols-2 gap-2 border-t border-neutral-900 pt-3">
                    <input
                      value={positionDraft.label}
                      onChange={(e) =>
                        setPositionDraft({ ...positionDraft, label: e.target.value })
                      }
                      placeholder="Position label"
                      className="settings-input text-xs"
                      aria-label="Theology position label"
                    />
                    <input
                      value={positionDraft.tradition_family ?? ""}
                      onChange={(e) =>
                        setPositionDraft({ ...positionDraft, tradition_family: e.target.value })
                      }
                      placeholder="Tradition family"
                      className="settings-input text-xs"
                      aria-label="Theology position tradition"
                    />
                    <textarea
                      value={positionDraft.summary ?? ""}
                      onChange={(e) =>
                        setPositionDraft({ ...positionDraft, summary: e.target.value })
                      }
                      placeholder="Summary"
                      rows={3}
                      className="settings-input resize-y md:col-span-2"
                      aria-label="Theology position summary"
                    />
                    <button
                      type="button"
                      onClick={savePosition}
                      disabled={!positionDraft.label.trim() || saving}
                      className="btn-secondary px-2 py-1 text-xs md:col-span-2"
                    >
                      Save position
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="editorial-rule" aria-hidden="true" />
                <span className="section-kicker">Evidence</span>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="editorial-section-h2">Linked evidence</h3>
                  <span className="text-xs text-neutral-600">{evidenceLinkCount} links</span>
                </div>
                {evidenceLinkCount === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Add Council sessions to this topic from the Council result toolbar. Passage,
                    resource, and workspace link actions will appear in their own screens.
                  </p>
                ) : (
                  <div className="space-y-3" data-testid="theology-evidence-groups">
                    {evidenceGroups
                      .filter((group) => group.links.length > 0)
                      .map((group) => (
                        <TheologyEvidenceSection
                          key={group.key}
                          title={group.title}
                          links={group.links}
                          onRemove={removeLink}
                        />
                      ))}
                  </div>
                )}
                {manualLink && (
                  <div className="grid md:grid-cols-[10rem_1fr_8rem] gap-2 border-t border-neutral-900 pt-3">
                    <select
                      value={manualLink.link_kind}
                      onChange={(e) =>
                        setManualLink({
                          ...manualLink,
                          link_kind: e.target.value as TheologyLink["link_kind"],
                        })
                      }
                      className="settings-input text-xs"
                      aria-label="Manual theology link kind"
                    >
                      <option value="verse">Passage</option>
                      <option value="resource_entry">Resource</option>
                      <option value="workspace_item">Workspace</option>
                      <option value="argument_map">Argument map</option>
                    </select>
                    <input
                      value={manualLink.title ?? ""}
                      onChange={(e) => setManualLink({ ...manualLink, title: e.target.value })}
                      placeholder="Link title or citation"
                      className="settings-input text-xs"
                      aria-label="Manual theology link title"
                    />
                    <button
                      type="button"
                      onClick={saveManualLink}
                      disabled={!manualLink.title?.trim() || saving}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Add link
                    </button>
                  </div>
                )}
              </div>

              {guided && (
                <div className="space-y-3" data-testid="guided-study-runner">
                  <div className="editorial-rule" aria-hidden="true" />
                  <span className="section-kicker">Guided study</span>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="editorial-section-h2">Guided study</h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        {guidedTemplate.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveGuided(false)}
                        className="btn-secondary px-2 py-1 text-xs"
                      >
                        Save study
                      </button>
                      <button
                        type="button"
                        onClick={() => saveGuided(true)}
                        className="btn-primary px-2 py-1 text-xs"
                      >
                        Complete
                      </button>
                      <AddToWorkspaceMenu
                        kind="freeform"
                        title={`${guidedTemplate.title}: ${selectedTopic.title}`}
                        buttonLabel="Add to workspace"
                        payload={{
                          type: "guided_study",
                          template_slug: guided.template_slug,
                          template_title: guidedTemplate.title,
                          topic_id: selectedTopic.id,
                          topic_title: selectedTopic.title,
                          focus_question: guided.focus_question,
                          before_response: guided.before_response,
                          after_response: guided.after_response,
                          critique: guided.critique,
                          review_cards: reviewCards,
                          body: [
                            `${guidedTemplate.title}: ${selectedTopic.title}`,
                            "",
                            "Question",
                            guided.focus_question ?? "",
                            "",
                            guidedTemplate.beforeLabel,
                            guided.before_response ?? "",
                            "",
                            guidedTemplate.afterLabel,
                            guided.after_response ?? "",
                            "",
                            guidedTemplate.critiqueLabel,
                            guided.critique ?? "",
                          ].join("\n"),
                        }}
                      />
                      {onAskCouncil && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskCouncil(
                              buildGuidedStudyCouncilQuestion(
                                selectedTopic,
                                guidedTemplate.title,
                                guided.focus_question,
                              ),
                            )
                          }
                          disabled={!guided.focus_question?.trim()}
                          className="btn-secondary px-2 py-1 text-xs"
                        >
                          Ask Council
                        </button>
                      )}
                    </div>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs tracking-wider text-neutral-500">
                      Template
                    </span>
                    <select
                      value={selectedGuidedTemplate}
                      onChange={(e) =>
                        setSelectedGuidedTemplate(e.target.value as GuidedTemplateSlug)
                      }
                      className="settings-input"
                      aria-label="Guided study template"
                    >
                      {GUIDED_TEMPLATES.map((template) => (
                        <option key={template.slug} value={template.slug}>
                          {template.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TheologyTextarea
                    label="Guided study question"
                    value={guided.focus_question ?? ""}
                    onChange={(value) => updateGuided({ focus_question: value })}
                    rows={3}
                  />
                  <TheologyTextarea
                    label={guidedTemplate.beforeLabel}
                    value={guided.before_response ?? ""}
                    onChange={(value) => updateGuided({ before_response: value })}
                    rows={4}
                  />
                  <TheologyTextarea
                    label={guidedTemplate.afterLabel}
                    value={guided.after_response ?? ""}
                    onChange={(value) => updateGuided({ after_response: value })}
                    rows={4}
                  />
                  <TheologyTextarea
                    label={guidedTemplate.critiqueLabel}
                    value={guided.critique ?? ""}
                    onChange={(value) => updateGuided({ critique: value })}
                    rows={4}
                  />
                  <div className="border border-neutral-900 rounded px-3 py-2">
                    <h4 className="text-xs tracking-wider text-neutral-500">
                      Review cards
                    </h4>
                    <p className="text-sm text-neutral-400 mt-1">
                      {reviewCards.length} saved card
                      {reviewCards.length === 1 ? "" : "s"}. Completing this study regenerates
                      cards from your conclusion, linked passages, major positions, reflection,
                      and critique.
                    </p>
                    {reviewCards.length > 0 && (
                      <>
                        <ul className="mt-2 space-y-2" data-testid="guided-review-cards">
                          {reviewCards.map((card, index) => (
                            <li key={`${card.kind}-${index}`} className="rounded border border-neutral-900 px-2 py-1.5">
                              <p className="text-xs tracking-wider text-neutral-500">
                                {card.kind}
                              </p>
                              <p className="text-sm text-neutral-300">{card.prompt}</p>
                              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                {card.answer}
                              </p>
                            </li>
                          ))}
                        </ul>
                        {activeReviewCard && (
                          <div className="mt-3 rounded border border-neutral-900 px-3 py-2" data-testid="guided-review-drill">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs tracking-wider text-neutral-500">
                                  Study review
                                </p>
                                <p className="text-xs text-neutral-500">
                                  Study aid only; not a doctrine answer.
                                </p>
                              </div>
                              <span className="text-xs text-neutral-600">
                                {reviewCardIndex + 1}/{reviewCards.length}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-neutral-300">
                              {activeReviewCard.prompt}
                            </p>
                            {reviewAnswerVisible ? (
                              <p className="mt-2 text-sm text-neutral-100">
                                {activeReviewCard.answer}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm text-neutral-600">Answer hidden</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewCardIndex((current) => Math.max(0, current - 1));
                                  setReviewAnswerVisible(false);
                                }}
                                disabled={reviewCardIndex === 0}
                                className="btn-secondary px-2 py-1 text-xs"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                onClick={() => setReviewAnswerVisible((current) => !current)}
                                className="btn-secondary px-2 py-1 text-xs"
                              >
                                {reviewAnswerVisible ? "Hide answer" : "Show answer"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewCardIndex((current) =>
                                    Math.min(reviewCards.length - 1, current + 1),
                                  );
                                  setReviewAnswerVisible(false);
                                }}
                                disabled={reviewCardIndex >= reviewCards.length - 1}
                                className="btn-secondary px-2 py-1 text-xs"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {guidedSessions.length > 0 && (
                <section className="space-y-3" data-testid="guided-study-history">
                  <div className="editorial-rule" aria-hidden="true" />
                  <span className="section-kicker">Guided study</span>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="editorial-section-h2">
                      Guided study history
                    </h3>
                    <span className="text-xs text-neutral-600">
                      {guidedSessions.length} saved
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {guidedSessions.map((session) => {
                      const cardCount = readReviewCards(session.review_cards_json).length;
                      const preview = guidedSessionPreview(session);
                      return (
                        <button
                          key={session.id ?? session.template_slug}
                          type="button"
                          onClick={() =>
                            setSelectedGuidedTemplate(session.template_slug as GuidedTemplateSlug)
                          }
                          className={
                            "w-full text-left rounded border px-3 py-2 " +
                            (session.template_slug === selectedGuidedTemplate
                              ? "border-amber-500/40 bg-amber-500/10"
                              : "border-neutral-900 bg-neutral-950/20 hover:border-neutral-700")
                          }
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-neutral-100">
                              {guidedTemplateTitle(session.template_slug)}
                            </p>
                            <span className="text-xs text-neutral-500">
                              {session.completed_at ? "Completed" : "Draft"} · {cardCount} card
                              {cardCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          {preview && (
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                              {preview}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="soft-card p-4 space-y-3" data-testid="theology-empty-state">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  Choose a topic or create one.
                </h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Use the topic form on the left, open the guide, or import resources before
                  building a doctrine topic.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="btn-secondary px-3 py-1.5 text-sm"
                  >
                    Open guide
                  </button>
                )}
                {onOpenResources && (
                  <button
                    type="button"
                    onClick={onOpenResources}
                    className="btn-secondary px-3 py-1.5 text-sm"
                  >
                    Import resources
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4 pl-4 border-l border-[var(--border-subtle)] lg:col-span-2 xl:col-span-1" data-testid="theology-progress">
          <div>
            <span className="section-kicker">My Theology</span>
            <p className="text-sm text-neutral-300 mt-2">
              {progress.started}/{progress.total} topics started
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <ProgressMetric label="Drafted" value={progress.drafted} />
            <ProgressMetric label="Settled" value={progress.settled} />
            <ProgressMetric label="Passages" value={progress.passages} />
            <ProgressMetric label="Resources" value={progress.resources} />
            <ProgressMetric label="Councils" value={progress.councils} />
            <ProgressMetric label="Open Qs" value={progress.openQuestions} />
          </div>
          <div className="border-t border-neutral-900 pt-3">
            <h3 className="text-xs tracking-wider text-neutral-500">Needs attention</h3>
            <ul className="mt-2 space-y-1 text-sm text-neutral-400">
              {topics
                .filter((topic) => (topicStats[topic.id]?.openQuestionCount ?? 0) > 0)
                .slice(0, 4)
                .map((topic) => (
                  <li key={topic.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{topic.title}</span>
                    <span className="text-xs text-neutral-600">
                      {topicStats[topic.id]?.openQuestionCount ?? 0}
                    </span>
                  </li>
                ))}
              {topics.every((topic) => (topicStats[topic.id]?.openQuestionCount ?? 0) === 0) && (
                <li>No open questions recorded yet.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
