import { useEffect, useState } from "react";
import type { Mode } from "../../lib/mode";

export type TourStep = {
  id: string;
  title: string;
  mode: Mode;
  eyebrow: string;
  body: string;
  tips: string[];
  actionLabel?: string;
};

const TOUR_AUTO_ADVANCE_MS = 6500;

export const TOUR_STEPS: TourStep[] = [
  {
    id: "reader",
    title: "Read, compare, and navigate Scripture",
    mode: "reader",
    eyebrow: "Reader",
    body: "The Reader is the home base. Choose books and chapters from the sidebar, toggle translations, adjust text size, and jump directly to references like John 3:16.",
    tips: [
      "Click a verse number to open actions for notes, highlights, bookmarks, explanation, and Council questions.",
      "Use the translation picker to compare English, Hebrew, Greek, and parallel layouts.",
      "Shift-click verse numbers to select a range for copying, notes, highlights, or workspace capture.",
    ],
    actionLabel: "Open Reader",
  },
  {
    id: "search",
    title: "Search and save what you find",
    mode: "reader",
    eyebrow: "Search",
    body: "The sidebar search works across the active translation, a chosen translation, or the full corpus. Filters help narrow results by testament or book.",
    tips: [
      "Press / anywhere outside an input to focus search.",
      "Use result checkboxes to collect several passages into a workspace at once.",
      "Save repeated searches so they appear in the sidebar shortcuts.",
    ],
  },
  {
    id: "council",
    title: "Ask the Council and inspect the reasoning",
    mode: "council",
    eyebrow: "Council",
    body: "Council is for disputed or interpretive questions. It retrieves evidence, runs the configured voices, and shows why one argument ranked higher than another.",
    tips: [
      "Check 'Voices before submit' to see which providers will run.",
      "Use retrieval controls to constrain evidence by strategy, translation, testament, book, and evidence limit.",
      "After an answer, review process metrics, position comparison, evidence tabs, confidence rationale, and raw source data.",
    ],
    actionLabel: "Open Council",
  },
  {
    id: "workspaces",
    title: "Build reusable studies in Workspaces",
    mode: "workspaces",
    eyebrow: "Workspaces",
    body: "Workspaces gather passages, search results, notes, explanations, and Council sessions into a study you can edit and export.",
    tips: [
      "Use Add buttons throughout the app to save material into a workspace.",
      "Filter workspace items once a study grows large.",
      "Export to Markdown, HTML, or PDF when you want to share or archive a study.",
    ],
    actionLabel: "Open Workspaces",
  },
  {
    id: "theology",
    title: "Build a living systematic theology",
    mode: "theology",
    eyebrow: "Theology",
    body: "Theology gathers your conclusions across doctrine topics so Council sessions, passages, resources, and workspaces can become a living study system.",
    tips: [
      "Start by choosing a doctrine topic and writing your current conclusion.",
      "Use confidence and unresolved questions to keep uncertainty visible.",
      "Later links from Council, Reader, Resources, and Workspaces will attach evidence to these topics.",
    ],
    actionLabel: "Open Theology",
  },
  {
    id: "resources",
    title: "Search attributable open resources",
    mode: "resources",
    eyebrow: "Resources",
    body: "Resources exposes public-domain and open-license study materials with license and attribution visible before you link or export them.",
    tips: [
      "Search resource text separately from Scripture so source provenance stays clear.",
      "Inspect license and attribution in the detail panel before using a source.",
      "Link resource entries to Theology topics when they support or challenge your conclusions.",
    ],
    actionLabel: "Open Resources",
  },
  {
    id: "settings",
    title: "Connect providers and review sources",
    mode: "settings",
    eyebrow: "Settings",
    body: "Settings covers AI setup, provider tests, data sources, backups, privacy notes, and release/distribution status.",
    tips: [
      "No-key Council mode uses a local Claude Code login; Ollama supports semantic retrieval when embeddings are available.",
      "Personal API keys are stored in the OS credential vault and excluded from backups.",
      "Managed Gateway mode supports team/public deployments without exposing provider keys to end users.",
    ],
    actionLabel: "Open Settings",
  },
];

export function GuidedTour({
  steps,
  currentIndex,
  onStepChange,
  onClose,
  onFinish,
  onAction,
}: {
  steps: TourStep[];
  currentIndex: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  onFinish: () => void;
  onAction: (mode: Mode) => void;
}) {
  const step = steps[currentIndex] ?? steps[0];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const changeStep = (index: number) => {
    setProgress(0);
    onStepChange(index);
  };

  const rewindTour = () => {
    setIsPlaying(true);
    changeStep(0);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && !isLast) changeStep(currentIndex + 1);
      if (event.key === "ArrowLeft" && !isFirst) changeStep(currentIndex - 1);
      if (event.key === "Home") rewindTour();
      if (event.key === " " && event.target === document.body) {
        event.preventDefault();
        setIsPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, isFirst, isLast, onClose]);

  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    if (isLast) {
      setIsPlaying(false);
      setProgress(100);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const nextProgress = Math.min(100, (elapsed / TOUR_AUTO_ADVANCE_MS) * 100);
      setProgress(nextProgress);
      if (elapsed >= TOUR_AUTO_ADVANCE_MS) {
        window.clearInterval(timer);
        changeStep(currentIndex + 1);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [currentIndex, isLast, isPlaying]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="New user guide"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="guided-tour"
    >
      <section className="surface-panel w-full max-w-2xl rounded-lg overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4">
          <div>
            <p className="text-xs tracking-wider text-amber-300">{step.eyebrow}</p>
            <h2 className="text-xl font-semibold text-neutral-100 mt-1">{step.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="meta-pill text-[11px]">
              {isPlaying ? "Auto-playing" : "Paused"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-2 py-1 text-sm"
              aria-label="Close guide"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-neutral-300 leading-relaxed">{step.body}</p>
          <ul className="grid gap-2">
            {step.tips.map((tip, index) => (
              <li key={tip} className="soft-card grid grid-cols-[1.75rem_1fr] gap-2 px-3 py-2">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-amber-500/15 text-xs text-amber-200">
                  {index + 1}
                </span>
                <span className="text-sm text-neutral-300 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            {steps.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  changeStep(index);
                }}
                className={
                  "h-2.5 rounded-full transition-all " +
                  (index === currentIndex
                    ? "w-8 bg-amber-400"
                    : "w-2.5 bg-neutral-700 hover:bg-neutral-500")
                }
                aria-label={`Go to guide step ${index + 1}: ${candidate.eyebrow}`}
              />
            ))}
            <span className="ml-auto text-xs text-neutral-500">
              {currentIndex + 1}/{steps.length}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-neutral-800"
            aria-label="Tour autoplay progress"
          >
            <div
              className="h-full rounded-full bg-amber-400 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={rewindTour}
              disabled={isFirst && progress === 0}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              Rewind
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                changeStep(currentIndex - 1);
              }}
              disabled={isFirst}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((value) => !value)}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {step.actionLabel && (
              <button
                type="button"
                onClick={() => onAction(step.mode)}
                className="btn-secondary px-3 py-1.5 text-sm"
                data-testid="tour-action"
              >
                {step.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onFinish}
              className="btn-ghost px-3 py-1.5 text-sm"
            >
              Do not show prompt
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onFinish}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Finish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  changeStep(currentIndex + 1);
                }}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Next
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
