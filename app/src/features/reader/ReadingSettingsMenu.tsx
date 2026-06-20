import type { ReaderLayout, ReaderDensity } from "./types";

interface Props {
  fontScale: number;
  onFontScaleChange: (next: number) => void;
  readerLayout: ReaderLayout;
  onReaderLayoutChange: (next: ReaderLayout) => void;
  readerDensity: ReaderDensity;
  onReaderDensityChange: (next: ReaderDensity) => void;
  syncScroll: boolean;
  onSyncScrollChange: (next: boolean) => void;
}

/**
 * Reading-settings popover content (the "Aa" menu): reader font-size, layout,
 * density, and sync-scroll. Extracted verbatim from ReaderTopControls — same
 * aria-labels and behavior. Designed to be placed inside a <Popover> by
 * ReaderBar.
 */
export function ReadingSettingsMenu({
  fontScale,
  onFontScaleChange,
  readerLayout,
  onReaderLayoutChange,
  readerDensity,
  onReaderDensityChange,
  syncScroll,
  onSyncScrollChange,
}: Props) {
  return (
    <div
      data-testid="reading-settings-popover"
      className="flex w-60 flex-col gap-3 text-xs text-neutral-400"
    >
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Reading text size"
      >
        <span className="mr-1">Reading text</span>
        <button
          type="button"
          onClick={() => onFontScaleChange(fontScale - 0.1)}
          className="meta-pill px-2 hover:text-neutral-100 disabled:opacity-40"
          aria-label="Decrease reader font size"
          title="Decrease reading text size"
        >
          A−
        </button>
        <span className="w-10 text-center font-mono tabular-nums select-none">
          {Math.round(fontScale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onFontScaleChange(fontScale + 0.1)}
          className="meta-pill px-2 hover:text-neutral-100 disabled:opacity-40"
          aria-label="Increase reader font size"
          title="Increase reading text size"
        >
          A+
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span>Layout</span>
        <select
          value={readerLayout}
          onChange={(e) => onReaderLayoutChange(e.target.value as ReaderLayout)}
          className="settings-input text-xs"
          aria-label="Reader layout"
        >
          <option value="columns">Columns</option>
          <option value="interleaved">Interleaved</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span>Density</span>
        <select
          value={readerDensity}
          onChange={(e) => onReaderDensityChange(e.target.value as ReaderDensity)}
          className="settings-input text-xs"
          aria-label="Reader density"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={syncScroll}
          onChange={(e) => onSyncScrollChange(e.target.checked)}
          className="accent-indigo-500"
          aria-label="Sync reader scrolling"
        />
        Sync scroll
      </label>
    </div>
  );
}
