import type {
  TheologyConclusion,
  TheologyLink,
  TheologyPosition,
  TheologyTopic,
} from "../../lib/bible";

export type TopicStatus = "not started" | "studying" | "drafted" | "settled for now";
export type DoctrineRelationKind = "depends_on" | "supports" | "tension";

export interface DoctrineRelationPayload {
  type: "doctrine_relation";
  relation: DoctrineRelationKind;
  target_topic_id?: number | null;
  target_topic_title?: string | null;
  note?: string | null;
}

export interface TopicStats {
  status: TopicStatus;
  passageCount: number;
  councilCount: number;
  resourceCount: number;
  linkCount: number;
  openQuestionCount: number;
}

export interface ReviewCard {
  kind: string;
  prompt: string;
  answer: string;
}

export interface StudyPrompt {
  question: string;
  rationale: string;
}

export function buildTopicStats(
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

export function countOpenQuestions(value?: string | null) {
  return (value ?? "")
    .split(/\n|[?]/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function buildProgressSummary(topics: TheologyTopic[], stats: Record<number, TopicStats>) {
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

export function buildStudyPrompts(
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

export function uniqueReviewCards(cards: ReviewCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.kind}\n${card.prompt.trim()}\n${card.answer.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function reviewAnswerFromTheologyLink(link: TheologyLink) {
  const payload = readTheologyLinkPayload(link);
  const citation = String(payload.citation ?? link.title ?? "Linked passage");
  const translation = String(payload.translation_code ?? "").trim();
  const text = String(payload.text ?? "").trim();
  return [translation ? `${citation} (${translation})` : citation, text]
    .filter(Boolean)
    .join(" - ");
}

export function readReviewCards(value?: string | null): ReviewCard[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((card) => {
        const item = asTheologyPayloadRecord(card);
        if (!item) return null;
        const answer = readPayloadString(item.answer);
        if (!answer) return null;
        const kind = readPayloadString(item.kind) ?? "review";
        const prompt = readPayloadString(item.prompt) ?? "Review";
        return {
          kind,
          prompt,
          answer,
        };
      })
      .filter((card): card is ReviewCard => Boolean(card));
  } catch {
    return [];
  }
}

export function readTheologyLinkPayload(link: TheologyLink): Record<string, unknown> {
  if (!link.payload_json) return {};
  try {
    const parsed = JSON.parse(link.payload_json);
    return asTheologyPayloadRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

export function asTheologyPayloadRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readPayloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function groupTheologyEvidence(links: TheologyLink[]) {
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

export function theologyLinkKindLabel(link: TheologyLink) {
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

export function theologyLinkPreview(link: TheologyLink) {
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
    .map((value) => stripSnippetMarkup(value).trim())
    .join(" - ")
    .slice(0, 220);
}

export function stripSnippetMarkup(value: string) {
  return value.replace(/<\/?mark>/gi, "");
}

export function parseDoctrineRelation(link: TheologyLink): DoctrineRelationPayload | null {
  if (link.link_kind !== "note") return null;
  try {
    const payload = asTheologyPayloadRecord(JSON.parse(link.payload_json ?? "{}"));
    if (!payload) return null;
    if (payload.type !== "doctrine_relation") return null;
    const relation = readPayloadString(payload.relation);
    if (!relation || !["depends_on", "supports", "tension"].includes(relation)) {
      return null;
    }
    return {
      type: "doctrine_relation",
      relation: relation as DoctrineRelationKind,
      target_topic_id: readPositiveInteger(payload.target_topic_id),
      target_topic_title: readPayloadString(payload.target_topic_title),
      note: readPayloadString(payload.note),
    };
  } catch {
    return null;
  }
}

export function relationLabel(relation: DoctrineRelationKind) {
  switch (relation) {
    case "supports":
      return "Supports";
    case "tension":
      return "Tension with";
    default:
      return "Depends on";
  }
}
