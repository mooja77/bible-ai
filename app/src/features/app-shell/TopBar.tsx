interface TopBarProps {
  title?: string;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  uiScale: number;
  canIncrease: boolean;
  canDecrease: boolean;
  onIncreaseUiScale: () => void;
  onDecreaseUiScale: () => void;
  onOpenPalette: () => void;
  tourDismissed: boolean;
  onOpenTour: () => void;
}

/**
 * Slim editorial top bar. Hosts the wordmark + contextual title on the left and
 * the relocated global controls (start-guide, theme toggle, ⌘K, ui-scale) on the
 * right. The testids/aria-labels here are e2e-asserted and were moved verbatim
 * from the former sidebar header.
 */
export function TopBar({
  title,
  theme,
  onThemeToggle,
  uiScale,
  canIncrease,
  canDecrease,
  onIncreaseUiScale,
  onDecreaseUiScale,
  onOpenPalette,
  tourDismissed,
  onOpenTour,
}: TopBarProps) {
  return (
    <div
      data-testid="top-bar"
      className="top-bar flex items-center justify-between gap-4 border-b border-neutral-800 px-4 py-2"
    >
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="text-sm font-semibold tracking-tight text-neutral-100">Bible AI</span>
        {title ? (
          <span className="truncate text-xs text-neutral-400">{title}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {!tourDismissed && (
          <button
            type="button"
            onClick={onOpenTour}
            className="meta-pill hover:border-neutral-500 hover:text-neutral-200"
          >
            Start guide
          </button>
        )}
        <button
          type="button"
          onClick={onThemeToggle}
          className="meta-pill hover:border-neutral-500 hover:text-neutral-200"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button
          type="button"
          onClick={onOpenPalette}
          className="meta-pill hover:border-neutral-500 hover:text-neutral-200"
          aria-label="Open command palette"
        >
          Ctrl K
        </button>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="App text size"
        >
          <button
            type="button"
            onClick={onDecreaseUiScale}
            disabled={!canDecrease}
            data-testid="ui-scale-dec"
            className="meta-pill px-2 hover:text-neutral-100 disabled:opacity-40"
            aria-label="Decrease app text size"
            title="Decrease app text size"
          >
            A−
          </button>
          <span
            data-testid="ui-scale-value"
            className="w-10 text-center font-mono tabular-nums select-none text-xs text-neutral-400"
            aria-hidden="true"
          >
            {uiScale}%
          </span>
          <button
            type="button"
            onClick={onIncreaseUiScale}
            disabled={!canIncrease}
            data-testid="ui-scale-inc"
            className="meta-pill px-2 hover:text-neutral-100 disabled:opacity-40"
            aria-label="Increase app text size"
            title="Increase app text size"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
}
