import { useEffect, useMemo, useState } from "react";
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

type TopicStatus = "not started" | "studying" | "drafted" | "settled for now";
type DoctrineRelationKind = "depends_on" | "supports" | "tension";

interface DoctrineRelationPayload {
  type: "doctrine_relation";
  relation: DoctrineRelationKind;
  target_topic_id?: number | null;
  target_topic_title?: string | null;
  note?: string | null;
}

interface TopicStats {
  status: TopicStatus;
  passageCount: number;
  councilCount: number;
  resourceCount: number;
  linkCount: number;
  openQuestionCount: number;
}

interface ReviewCard {
  kind: string;
  prompt: string;
  answer: string;
}

interface StudyPrompt {
  question: string;
  rationale: string;
}

const GUIDED_TEMPLATES = [
  {
    slug: "doctrine-reflection",
    title: "Build a doctrine topic",
    description: "Collect evidence, write your conclusion, and preserve what changed.",
    beforeLabel: "Before AI: what do I currently think and why?",
    afterLabel: "After AI: what changed, and what did not?",
    critiqueLabel: "I disagree with or would correct the AI here",
  },
  {
    slug: "passage-study",
    title: "Study a passage",
    description: "Start with your own reading before linking passages, resources, or Council output.",
    beforeLabel: "Before AI: what do I see in the passage itself?",
    afterLabel: "After AI: which context, cross-reference, or term changed my reading?",
    critiqueLabel: "Where should the AI reading be qualified or corrected?",
  },
  {
    slug: "position-comparison",
    title: "Compare theological positions",
    description: "Name the question, compare arguments, and record your own judgment.",
    beforeLabel: "Before AI: which position seems strongest to me, and why?",
    afterLabel: "After AI: which argument ranked higher, and do I agree?",
    critiqueLabel: "What did the AI miss, overstate, or flatten between positions?",
  },
  {
    slug: "theology-review",
    title: "Review my theology",
    description: "Review saved conclusions and identify tensions, gaps, and next studies.",
    beforeLabel: "Before AI: what conclusion or tension should I review?",
    afterLabel: "After AI: what needs revision, more evidence, or pastoral/scholarly review?",
    critiqueLabel: "What should remain my own unresolved question?",
  },
] as const;

type GuidedTemplateSlug = (typeof GUIDED_TEMPLATES)[number]["slug"];

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
    const pairs = await Promise.all(
      rows.map(async (topic) => {
        const [topicConclusion, topicLinks] = await Promise.all([
          getTheologyConclusion(topic.id).catch(() => null),
          listTheologyLinks(topic.id).catch(() => []),
        ]);
        return [topic.id, buildTopicStats(topicConclusion, topicLinks)] as const;
      }),
    );
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
        setRelationDraft((current) => ({
          ...current,
          targetTopicId:
            topics.find((topic) => topic.id !== selectedTopicId)?.id ?? current.targetTopicId,
        }));
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
    if (!manualLink || !manualLink.title?.trim()) return;
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
  };

  const saveDoctrineRelation = async () => {
    if (!selectedTopicId || !relationDraft.targetTopicId) return;
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
    const id = await createTheologyLink(link);
    setLinks((current) => [{ ...link, id }, ...current]);
    setRelationDraft({ relation: relationDraft.relation, targetTopicId: target.id, note: "" });
    await refreshTopicStats();
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
    if (!positionDraft || !positionDraft.label.trim()) return;
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
      <header className="surface-panel rounded-lg px-5 py-4">
        <h1 className="text-2xl font-semibold text-neutral-100">Theology</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Build a living systematic theology from Scripture, Council sessions, resources,
          workspaces, and your own conclusions.
        </p>
      </header>

      {error && (
        <div className="border border-red-900/60 bg-red-950/40 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid xl:grid-cols-[18rem_1fr_16rem] lg:grid-cols-[18rem_1fr] gap-4">
        <aside className="surface-panel rounded-lg p-3 space-y-2">
          <h2 className="text-xs tracking-wider text-neutral-500">Doctrine Topics</h2>
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
                    "w-full text-left rounded px-3 py-2 border transition " +
                    (topic.id === selectedTopicId
                      ? "border-emerald-500/50 bg-emerald-500/10 text-neutral-100"
                      : "border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200")
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
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="btn-primary px-3 py-1.5 text-sm"
                >
                  {saving ? "Saving..." : "Save conclusion"}
                </button>
                <button
                  type="button"
                  onClick={copyMarkdown}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  {exported ? "Copied" : "Copy Markdown"}
                </button>
                <button
                  type="button"
                  onClick={copyFullMarkdown}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Copy Full Theology
                </button>
                <button
                  type="button"
                  onClick={copyTopicTreeMarkdown}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Copy Topic + Subtopics
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
                  onClick={saveFullPdf}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Save Full PDF
                </button>
                <button
                  type="button"
                  onClick={saveTopicTreePdf}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  Save Topic + Subtopics PDF
                </button>
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
              </div>
              {savedPdfPath && (
                <p className="text-xs text-neutral-500">Saved PDF: {savedPdfPath}</p>
              )}

              {editingTopic && (
                <div className="soft-card p-3 space-y-2" data-testid="edit-theology-topic">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-neutral-200">Topic details</h3>
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

              <section className="soft-card p-3 space-y-3" data-testid="theology-study-prompts">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-200">Key study questions</h3>
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

              <div className="soft-card p-3 space-y-2" data-testid="theology-subtopics">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-200">Subtopics</h3>
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

              <div className="soft-card p-3 space-y-3" data-testid="doctrine-relations">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-200">
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
                    disabled={!relationDraft.targetTopicId}
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
                <label
                  className="text-xs tracking-wider text-neutral-500"
                  htmlFor="theology-confidence"
                >
                  Confidence
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="theology-confidence"
                    type="range"
                    min={0}
                    max={100}
                    value={conclusion.confidence ?? 50}
                    onChange={(e) => updateConclusion({ confidence: Number(e.target.value) })}
                    className="w-full"
                  />
                  <span className="w-14 text-right text-sm text-neutral-300">
                    {conclusion.confidence ?? 50}%
                  </span>
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

              <div className="soft-card p-3 space-y-3" data-testid="theology-positions">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-200">Major positions</h3>
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
                      disabled={!positionDraft.label.trim()}
                      className="btn-secondary px-2 py-1 text-xs md:col-span-2"
                    >
                      Save position
                    </button>
                  </div>
                )}
              </div>

              <div className="soft-card p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-neutral-200">Linked evidence</h3>
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
                      disabled={!manualLink.title?.trim()}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Add link
                    </button>
                  </div>
                )}
              </div>

              {guided && (
                <div className="soft-card p-3 space-y-3" data-testid="guided-study-runner">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-200">Guided study</h3>
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
                <section className="soft-card p-3 space-y-3" data-testid="guided-study-history">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-neutral-200">
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

        <aside className="surface-panel rounded-lg p-4 space-y-4 lg:col-span-2 xl:col-span-1" data-testid="theology-progress">
          <div>
            <h2 className="text-xs tracking-wider text-neutral-500">My Theology</h2>
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

function buildTopicStats(
  conclusion: TheologyConclusion | null,
  links: TheologyLink[],
): TopicStats {
  const hasConclusion = Boolean(conclusion?.conclusion?.trim());
  const confidence = conclusion?.confidence ?? 0;
  const openQuestionCount = countOpenQuestions(conclusion?.unresolved_questions);
  const status: TopicStatus = !hasConclusion
    ? links.length > 0
      ? "studying"
      : "not started"
    : confidence >= 80 && openQuestionCount === 0
      ? "settled for now"
      : "drafted";
  return {
    status,
    passageCount: links.filter((link) => link.link_kind === "verse" || link.link_kind === "verse_range").length,
    councilCount: links.filter((link) => link.link_kind === "council_session").length,
    resourceCount: links.filter((link) => link.link_kind === "resource_entry").length,
    linkCount: links.length,
    openQuestionCount,
  };
}

function countOpenQuestions(value?: string | null) {
  return (value ?? "")
    .split(/\n|[?]/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function buildProgressSummary(topics: TheologyTopic[], stats: Record<number, TopicStats>) {
  const values = topics.map((topic) => stats[topic.id]).filter(Boolean);
  return {
    total: topics.length,
    started: values.filter((item) => item.status !== "not started").length,
    drafted: values.filter((item) => item.status === "drafted").length,
    settled: values.filter((item) => item.status === "settled for now").length,
    passages: values.reduce((sum, item) => sum + item.passageCount, 0),
    resources: values.reduce((sum, item) => sum + item.resourceCount, 0),
    councils: values.reduce((sum, item) => sum + item.councilCount, 0),
    openQuestions: values.reduce((sum, item) => sum + item.openQuestionCount, 0),
  };
}

function buildStudyPrompts(
  topic: TheologyTopic,
  stats: TopicStats | null | undefined,
  conclusion: TheologyConclusion | null,
  positions: TheologyPosition[],
  relations: Array<{ link: TheologyLink; payload: DoctrineRelationPayload }>,
  subtopics: TheologyTopic[],
): StudyPrompt[] {
  const prompts: StudyPrompt[] = [];
  const add = (question: string, rationale: string) => {
    if (prompts.some((prompt) => prompt.question === question)) return;
    prompts.push({ question, rationale });
  };

  add(
    `Which passages most directly support or challenge my current view of ${topic.title}?`,
    "Start from the text before accepting a synthesis.",
  );

  if ((stats?.resourceCount ?? 0) === 0) {
    add(
      `Which attributable resources should I consult before settling ${topic.title}?`,
      "No linked resources are recorded yet.",
    );
  }

  if (positions.length === 0) {
    add(
      `What are the main theological positions I need to compare for ${topic.title}?`,
      "Major positions make disagreement visible instead of implicit.",
    );
  } else if (positions.length === 1) {
    add(
      `What is the strongest alternative to ${positions[0].label}?`,
      "A single saved position can hide dissent or unresolved interpretive options.",
    );
  } else {
    add(
      `Which evidence would make one saved position stronger than the others?`,
      "Compare positions by evidence and assumptions, not only labels.",
    );
  }

  if (conclusion?.conclusion?.trim()) {
    add(
      `What evidence would change or weaken my current conclusion about ${topic.title}?`,
      "A living theology should preserve what could revise the user's judgment.",
    );
  }

  for (const { payload } of relations.slice(0, 2)) {
    add(
      `How does ${relationLabel(payload.relation).toLowerCase()} ${
        payload.target_topic_title ?? "this related topic"
      } affect my conclusion about ${topic.title}?`,
      "Doctrine links should shape interpretation, not just sit beside the topic.",
    );
  }

  if (subtopics.length > 0) {
    add(
      `Which subtopic under ${topic.title} needs its own conclusion next?`,
      "Subtopics help split large doctrines into studyable questions.",
    );
  }

  return prompts.slice(0, 5);
}

function buildGuidedReviewCards(
  conclusion: TheologyConclusion | null,
  guided: GuidedStudySession,
  guidedTemplate: (typeof GUIDED_TEMPLATES)[number],
  links: TheologyLink[],
  positions: TheologyPosition[],
): ReviewCard[] {
  const cards: Array<ReviewCard | null> = [
    guided.focus_question
      ? {
          kind: "question",
          prompt: "State the study question",
          answer: guided.focus_question,
        }
      : null,
    conclusion?.conclusion
      ? {
          kind: "conclusion",
          prompt: "Review my conclusion",
          answer: conclusion.conclusion,
        }
      : null,
    ...links
      .filter((link) => link.link_kind === "verse" || link.link_kind === "verse_range")
      .slice(0, 5)
      .map((link) => ({
        kind: "passage",
        prompt: "Review linked passage",
        answer: reviewAnswerFromTheologyLink(link),
      })),
    ...positions.slice(0, 5).map((position) => ({
      kind: "term",
      prompt: `Review major position: ${position.label}`,
      answer: [position.tradition_family, position.summary, position.strengths]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" - ") || position.label,
    })),
    guided.before_response
      ? {
          kind: "reflection",
          prompt: guidedTemplate.beforeLabel,
          answer: guided.before_response,
        }
      : null,
    guided.after_response
      ? {
          kind: "judgment",
          prompt: guidedTemplate.afterLabel,
          answer: guided.after_response,
        }
      : null,
    guided.critique
      ? {
          kind: "critique",
          prompt: guidedTemplate.critiqueLabel,
          answer: guided.critique,
        }
      : null,
  ];
  return uniqueReviewCards(cards.filter((card): card is ReviewCard => Boolean(card?.answer.trim())));
}

function uniqueReviewCards(cards: ReviewCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.kind}\n${card.prompt.trim()}\n${card.answer.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reviewAnswerFromTheologyLink(link: TheologyLink) {
  const payload = readTheologyLinkPayload(link);
  const citation = String(payload.citation ?? link.title ?? "Linked passage");
  const translation = String(payload.translation_code ?? "").trim();
  const text = String(payload.text ?? "").trim();
  return [translation ? `${citation} (${translation})` : citation, text]
    .filter(Boolean)
    .join(" - ");
}

function readReviewCards(value?: string | null): ReviewCard[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((card) => {
        if (!card || typeof card !== "object") return null;
        const item = card as Record<string, unknown>;
        const answer = String(item.answer ?? "").trim();
        if (!answer) return null;
        return {
          kind: String(item.kind ?? "review"),
          prompt: String(item.prompt ?? "Review"),
          answer,
        };
      })
      .filter((card): card is ReviewCard => Boolean(card));
  } catch {
    return [];
  }
}

function guidedTemplateTitle(slug: string) {
  return GUIDED_TEMPLATES.find((template) => template.slug === slug)?.title ?? "Guided study";
}

function guidedSessionPreview(session: GuidedStudySession) {
  return [session.focus_question, session.before_response, session.after_response, session.critique]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" - ")
    .slice(0, 220);
}

function buildGuidedStudyCouncilQuestion(
  topic: TheologyTopic,
  templateTitle: string,
  focusQuestion: string | null | undefined,
) {
  const question = focusQuestion?.trim();
  if (!question) return "";
  return `For my guided study "${templateTitle}" on ${topic.title}, help me test this question against Scripture: ${question}\n\nCompare the major biblical arguments, note disputed interpretations, identify what evidence would strengthen or weaken each answer, and leave unresolved questions visible for my own judgment.`;
}

function readTheologyLinkPayload(link: TheologyLink): Record<string, unknown> {
  if (!link.payload_json) return {};
  try {
    const parsed = JSON.parse(link.payload_json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function groupTheologyEvidence(links: TheologyLink[]) {
  return [
    {
      key: "passages",
      title: "Key passages",
      links: links.filter((link) => link.link_kind === "verse" || link.link_kind === "verse_range"),
    },
    {
      key: "resources",
      title: "Linked resources",
      links: links.filter((link) => link.link_kind === "resource_entry"),
    },
    {
      key: "councils",
      title: "Linked Council sessions",
      links: links.filter((link) => link.link_kind === "council_session"),
    },
    {
      key: "workspaces",
      title: "Workspace evidence",
      links: links.filter((link) => link.link_kind === "workspace_item"),
    },
    {
      key: "other",
      title: "Notes and argument maps",
      links: links.filter(
        (link) =>
          link.link_kind === "argument_map" ||
          (link.link_kind === "note" && !parseDoctrineRelation(link)),
      ),
    },
  ];
}

function DoctrineMap({
  topic,
  subtopics,
  relations,
}: {
  topic: TheologyTopic;
  subtopics: TheologyTopic[];
  relations: Array<{ link: TheologyLink; payload: DoctrineRelationPayload }>;
}) {
  const relationTone: Record<DoctrineRelationKind, string> = {
    depends_on: "border-sky-500/40 bg-sky-500/10 text-sky-200",
    supports: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    tension: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  };
  const relationLine: Record<DoctrineRelationKind, string> = {
    depends_on: "bg-sky-500/45",
    supports: "bg-emerald-500/45",
    tension: "bg-amber-500/55",
  };
  const hasMapItems = relations.length > 0 || subtopics.length > 0;

  return (
    <section className="soft-card p-3 space-y-3" data-testid="doctrine-map">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-200">Doctrine map</h3>
        <span className="text-xs text-neutral-600">
          {relations.length} relation{relations.length === 1 ? "" : "s"} · {subtopics.length} subtopic
          {subtopics.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] gap-3">
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-3">
          <p className="text-xs tracking-wider text-amber-300">Current topic</p>
          <p className="text-base font-semibold text-neutral-100 mt-1">{topic.title}</p>
          {topic.summary && (
            <p className="text-xs text-neutral-400 mt-2 line-clamp-3">{topic.summary}</p>
          )}
        </div>
        <div className="space-y-2">
          {!hasMapItems && (
            <p className="rounded border border-neutral-900 px-3 py-3 text-sm text-neutral-500">
              No doctrine links or subtopics mapped yet.
            </p>
          )}
          {relations.map(({ link, payload }) => (
            <div
              key={link.id ?? `${payload.relation}-${payload.target_topic_id}-${payload.target_topic_title}`}
              className="grid grid-cols-[2.5rem_1fr] items-stretch gap-2"
            >
              <div className="flex items-center justify-center">
                <span className={`h-px w-full ${relationLine[payload.relation]}`} />
              </div>
              <div className={`rounded border px-3 py-2 ${relationTone[payload.relation]}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {relationLabel(payload.relation)} {payload.target_topic_title ?? "related topic"}
                  </p>
                  <span className="text-[11px] tracking-wider opacity-80">
                    {payload.relation.replace(/_/g, " ")}
                  </span>
                </div>
                {payload.note && (
                  <p className="text-xs text-neutral-300 mt-1 line-clamp-2">{payload.note}</p>
                )}
              </div>
            </div>
          ))}
          {subtopics.map((subtopic) => (
            <div key={subtopic.id} className="grid grid-cols-[2.5rem_1fr] items-stretch gap-2">
              <div className="flex items-center justify-center">
                <span className="h-px w-full bg-neutral-600/50" />
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <p className="text-sm font-semibold text-neutral-200">Subtopic: {subtopic.title}</p>
                {subtopic.summary && (
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{subtopic.summary}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TheologyEvidenceSection({
  title,
  links,
  onRemove,
}: {
  title: string;
  links: TheologyLink[];
  onRemove: (id: number) => Promise<void>;
}) {
  return (
    <section className="border border-neutral-900 rounded px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs tracking-wider text-neutral-500">{title}</h4>
        <span className="text-xs text-neutral-600">{links.length}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {links.map((link) => (
          <li
            key={link.id ?? `${link.link_kind}-${link.title}`}
            className="rounded border border-neutral-900/80 px-3 py-2 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-neutral-200">{link.title ?? "Untitled link"}</p>
              <p className="text-xs text-neutral-500">
                {theologyLinkKindLabel(link)}
                {link.target_id ? ` #${link.target_id}` : ""}
              </p>
              {theologyLinkPreview(link) && (
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                  {theologyLinkPreview(link)}
                </p>
              )}
            </div>
            {link.id && (
              <button
                type="button"
                onClick={() => void onRemove(link.id!)}
                className="btn-secondary px-2 py-1 text-xs"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function theologyLinkKindLabel(link: TheologyLink) {
  switch (link.link_kind) {
    case "verse":
      return "Passage";
    case "verse_range":
      return "Passage range";
    case "resource_entry":
      return "Resource";
    case "council_session":
      return "Council";
    case "workspace_item":
      return "Workspace item";
    case "argument_map":
      return "Argument map";
    default:
      return "Note";
  }
}

function theologyLinkPreview(link: TheologyLink) {
  const payload = readTheologyLinkPayload(link);
  const values = [
    payload.citation,
    payload.text,
    payload.snippet,
    payload.body,
    payload.summary,
    payload.question,
    payload.source,
    payload.source_title,
    payload.workspace_title,
    payload.collection,
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.replace(/<[^>]*>/g, "").trim())
    .join(" - ")
    .slice(0, 220);
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="soft-card px-3 py-2">
      <p className="text-xs tracking-wider text-neutral-500">{label}</p>
      <p className="text-lg font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

function parseDoctrineRelation(link: TheologyLink): DoctrineRelationPayload | null {
  if (link.link_kind !== "note") return null;
  try {
    const payload = JSON.parse(link.payload_json ?? "{}") as Partial<DoctrineRelationPayload>;
    if (payload.type !== "doctrine_relation") return null;
    if (!payload.relation || !["depends_on", "supports", "tension"].includes(payload.relation)) {
      return null;
    }
    return {
      type: "doctrine_relation",
      relation: payload.relation as DoctrineRelationKind,
      target_topic_id: payload.target_topic_id,
      target_topic_title: payload.target_topic_title,
      note: payload.note,
    };
  } catch {
    return null;
  }
}

function relationLabel(relation: DoctrineRelationKind) {
  switch (relation) {
    case "supports":
      return "Supports";
    case "tension":
      return "Tension with";
    default:
      return "Depends on";
  }
}

function TheologyTextarea({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs tracking-wider text-neutral-500">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        aria-label={label}
        className="settings-input resize-y"
      />
    </label>
  );
}
