import type {
  GuidedStudySession,
  TheologyConclusion,
  TheologyLink,
  TheologyPosition,
  TheologyTopic,
} from "../../lib/bible";
import { reviewAnswerFromTheologyLink, uniqueReviewCards, type ReviewCard } from "./theologyData";

export const GUIDED_TEMPLATES = [
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

export type GuidedTemplateSlug = (typeof GUIDED_TEMPLATES)[number]["slug"];

export function buildGuidedReviewCards(
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

export function guidedTemplateTitle(slug: string) {
  return GUIDED_TEMPLATES.find((template) => template.slug === slug)?.title ?? "Guided study";
}

export function guidedSessionPreview(session: GuidedStudySession) {
  return [session.focus_question, session.before_response, session.after_response, session.critique]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" - ")
    .slice(0, 220);
}

export function buildGuidedStudyCouncilQuestion(
  topic: TheologyTopic,
  templateTitle: string,
  focusQuestion: string | null | undefined,
) {
  const question = focusQuestion?.trim();
  if (!question) return "";
  return `For my guided study "${templateTitle}" on ${topic.title}, help me test this question against Scripture: ${question}\n\nCompare the major biblical arguments, note disputed interpretations, identify what evidence would strengthen or weaken each answer, and leave unresolved questions visible for my own judgment.`;
}
