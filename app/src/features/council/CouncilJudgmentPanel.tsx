import { useEffect, useMemo, useState } from "react";
import {
  getCouncilJudgment,
  upsertCouncilJudgment,
  type CouncilJudgment,
  type CouncilResponse,
  type PositionJudgment,
  type PositionUserRating,
} from "../../lib/bible";
import { ErrorState } from "../../components/StateViews";
import { formatPercent } from "./councilTransparency";

interface FollowUpQuestion {
  question: string;
  source: string;
}

export function readPayloadJudgment(response: CouncilResponse): CouncilJudgment | null {
  const candidate = (response as unknown as { judgment?: CouncilJudgment }).judgment;
  return candidate && typeof candidate === "object" ? candidate : null;
}

export function createEmptyJudgment(sessionId: number, response: CouncilResponse): CouncilJudgment {
  return {
    council_session_id: sessionId,
    before_judgment: "",
    after_judgment: "",
    personal_conclusion: "",
    confidence: null,
    changed_mind_note: "",
    open_questions: "",
    position_judgments: response.synthesis.positions.map((position) => ({
      position_label: position.label,
      user_rating: "unclear",
      user_weight: position.weight,
      persuasive_evidence: "",
      weak_points: "",
      notes: "",
    })),
  };
}

function normalizeJudgment(
  sessionId: number,
  response: CouncilResponse,
  loaded: CouncilJudgment | null,
): CouncilJudgment {
  const base = loaded ?? createEmptyJudgment(sessionId, response);
  const byLabel = new Map(
    (base.position_judgments ?? []).map((position) => [position.position_label, position]),
  );
  return {
    ...base,
    council_session_id: sessionId,
    position_judgments: response.synthesis.positions.map((position) => ({
      position_label: position.label,
      user_rating: byLabel.get(position.label)?.user_rating ?? "unclear",
      user_weight: byLabel.get(position.label)?.user_weight ?? position.weight,
      persuasive_evidence: byLabel.get(position.label)?.persuasive_evidence ?? "",
      weak_points: byLabel.get(position.label)?.weak_points ?? "",
      notes: byLabel.get(position.label)?.notes ?? "",
    })),
  };
}

export function CouncilJudgmentPanel({
  sessionId,
  response,
  judgment,
  onJudgmentChange,
  onAskFollowUp,
}: {
  sessionId: number | null;
  response: CouncilResponse;
  judgment: CouncilJudgment | null;
  onJudgmentChange: (judgment: CouncilJudgment | null) => void;
  onAskFollowUp: (question: string) => void;
}) {
  const [draft, setDraft] = useState<CouncilJudgment | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setSaveState("idle");
    getCouncilJudgment(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        const next = normalizeJudgment(sessionId, response, loaded ?? judgment);
        setDraft(next);
        onJudgmentChange(next);
      })
      .catch(() => {
        if (cancelled) return;
        const next = normalizeJudgment(sessionId, response, judgment);
        setDraft(next);
        onJudgmentChange(next);
      });
    return () => {
      cancelled = true;
    };
  }, [onJudgmentChange, response, sessionId]);

  const updateField = (field: keyof CouncilJudgment, value: string | number | null) => {
    setSaveState("idle");
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      onJudgmentChange(next);
      return next;
    });
  };

  const updatePosition = (
    positionLabel: string,
    field: keyof PositionJudgment,
    value: string | number | null,
  ) => {
    setSaveState("idle");
    setDraft((current) => {
      if (!current) return current;
      const next = {
        ...current,
        position_judgments: current.position_judgments.map((position) =>
          position.position_label === positionLabel ? { ...position, [field]: value } : position,
        ),
      };
      onJudgmentChange(next);
      return next;
    });
  };

  const markNeedsStudy = () => {
    setSaveState("idle");
    setDraft((current) => {
      if (!current) return current;
      const next: CouncilJudgment = {
        ...current,
        confidence:
          typeof current.confidence === "number" ? Math.min(current.confidence, 40) : 40,
        open_questions:
          current.open_questions?.trim() ||
          "Needs further study before I treat this Council result as settled.",
        position_judgments: current.position_judgments.map((position) => ({
          ...position,
          user_rating: "needs_study",
          notes:
            position.notes?.trim() ||
            "Needs further study before I judge this position.",
        })),
      };
      onJudgmentChange(next);
      return next;
    });
  };

  const addOpenQuestion = (question: string) => {
    setSaveState("idle");
    setDraft((current) => {
      if (!current) return current;
      const existing = current.open_questions?.trim() ?? "";
      if (existing.includes(question)) return current;
      const next = {
        ...current,
        open_questions: [existing, question].filter(Boolean).join("\n"),
      };
      onJudgmentChange(next);
      return next;
    });
  };

  const followUpQuestions = useMemo(
    () => buildCouncilFollowUpQuestions(response),
    [response],
  );

  const onSave = async () => {
    if (!draft) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const id = await upsertCouncilJudgment(draft);
      const saved = { ...draft, id };
      setDraft(saved);
      onJudgmentChange(saved);
      setSaveState("saved");
    } catch (e) {
      setSaveError(String(e));
      setSaveState("error");
    }
  };

  if (!sessionId || !draft) {
    return (
      <section className="surface-panel rounded-lg p-4" data-testid="council-judgment-panel">
        <h2 className="text-lg font-semibold text-neutral-100">My Judgment</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Save or reopen this Council session from history to attach your own evaluation.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-panel rounded-lg p-4 space-y-4" data-testid="council-judgment-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">My Judgment</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Record what you thought, what changed, and which arguments you find persuasive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={markNeedsStudy}
            disabled={saveState === "saving"}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Mark needs study
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === "saving"}
            className="btn-primary px-3 py-1.5 text-sm"
          >
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save judgment"}
          </button>
        </div>
      </div>

      {saveError && <ErrorState message={saveError} title={null} />}

      <div className="grid md:grid-cols-2 gap-3">
        <LabeledTextarea
          label="Before reviewing the Council"
          value={draft.before_judgment ?? ""}
          onChange={(value) => updateField("before_judgment", value)}
        />
        <LabeledTextarea
          label="After reviewing the Council"
          value={draft.after_judgment ?? ""}
          onChange={(value) => updateField("after_judgment", value)}
        />
        <LabeledTextarea
          label="Personal conclusion"
          value={draft.personal_conclusion ?? ""}
          onChange={(value) => updateField("personal_conclusion", value)}
        />
        <LabeledTextarea
          label="What changed in my thinking"
          value={draft.changed_mind_note ?? ""}
          onChange={(value) => updateField("changed_mind_note", value)}
        />
      </div>

      <div className="soft-card p-3 space-y-2">
        <label className="text-xs tracking-wider text-neutral-500" htmlFor="judgment-confidence">
          Personal confidence
        </label>
        <div className="flex items-center gap-3">
          <input
            id="judgment-confidence"
            type="range"
            min={0}
            max={100}
            value={draft.confidence ?? 50}
            onChange={(e) => updateField("confidence", Number(e.target.value))}
            className="w-full"
            aria-label="Personal confidence"
          />
          <span className="w-14 text-right text-sm text-neutral-300">
            {draft.confidence ?? 50}%
          </span>
        </div>
      </div>

      <LabeledTextarea
        label="Open questions for further study"
        value={draft.open_questions ?? ""}
        onChange={(value) => updateField("open_questions", value)}
      />

      {followUpQuestions.length > 0 && (
        <section className="soft-card p-3 space-y-3" data-testid="council-follow-up-questions">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">
              AI-suggested follow-up questions
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              These come from visible Council uncertainty. Add only the questions you want to
              carry into your own open questions.
            </p>
          </div>
          <div className="grid gap-2">
            {followUpQuestions.map((item) => (
              <div key={item.question} className="rounded border border-neutral-900 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-neutral-200">{item.question}</p>
                    <p className="text-xs text-neutral-500 mt-1">{item.source}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAskFollowUp(item.question)}
                      data-testid="ask-follow-up"
                      className="btn-primary px-2 py-1 text-xs"
                    >
                      Ask
                    </button>
                    <button
                      type="button"
                      onClick={() => addOpenQuestion(item.question)}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Add question
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-200">Evaluate each position</h3>
        <div className="grid gap-3">
          {draft.position_judgments.map((position) => (
            <div key={position.position_label} className="soft-card p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-100">
                    {position.position_label}
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Council weight: {formatPercent(position.user_weight ?? 0)}
                  </p>
                </div>
                <select
                  value={position.user_rating}
                  onChange={(e) =>
                    updatePosition(
                      position.position_label,
                      "user_rating",
                      e.target.value as PositionUserRating,
                    )
                  }
                  className="settings-input text-xs max-w-52"
                  aria-label={`User rating for ${position.position_label}`}
                >
                  <option value="persuasive">Persuasive</option>
                  <option value="weak">Weak</option>
                  <option value="unclear">Unclear</option>
                  <option value="needs_study">Needs more study</option>
                  <option value="disagree">I disagree</option>
                </select>
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                <LabeledTextarea
                  label="Persuasive evidence"
                  value={position.persuasive_evidence ?? ""}
                  onChange={(value) =>
                    updatePosition(position.position_label, "persuasive_evidence", value)
                  }
                  rows={3}
                />
                <LabeledTextarea
                  label="Weak points"
                  value={position.weak_points ?? ""}
                  onChange={(value) => updatePosition(position.position_label, "weak_points", value)}
                  rows={3}
                />
                <LabeledTextarea
                  label="My notes"
                  value={position.notes ?? ""}
                  onChange={(value) => updatePosition(position.position_label, "notes", value)}
                  rows={3}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildCouncilFollowUpQuestions(response: CouncilResponse): FollowUpQuestion[] {
  const questions: FollowUpQuestion[] = [];
  const add = (question: string, source: string) => {
    if (questions.some((item) => item.question === question)) return;
    questions.push({ question, source });
  };

  for (const tension of response.synthesis.unresolved_tensions ?? []) {
    const trimmed = tension.trim();
    if (!trimmed) continue;
    add(
      `How should I resolve this tension: ${trimmed}`,
      "Suggested from the Council's unresolved tensions.",
    );
  }

  for (const position of response.synthesis.positions) {
    if (position.what_would_change_this?.trim()) {
      add(
        `What evidence would change the ${position.label} position?`,
        position.what_would_change_this.trim(),
      );
    }
    if (position.weakest_link?.trim()) {
      add(
        `Does the weakest link in ${position.label} undermine that position?`,
        position.weakest_link.trim(),
      );
    }
  }

  if (questions.length === 0 && response.synthesis.dissent_notes?.trim()) {
    add(
      "Which dissenting concern needs further study before I settle my judgment?",
      response.synthesis.dissent_notes.trim(),
    );
  }

  return questions.slice(0, 5);
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 4,
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
        className="settings-input resize-y"
      />
    </label>
  );
}
