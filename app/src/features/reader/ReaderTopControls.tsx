import type { Translation } from "../../lib/bible";
import type { ReaderLayout, ReaderDensity } from "./types";
import { TranslationPicker } from "./TranslationPicker";

interface Props {
  translations: Translation[];
  activeTranslations: string[];
  onToggleTranslation: (code: string) => void;
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
 * Compact, editorial controls strip for the reading view: translation chips,
 * reading-text size, layout/density, and sync-scroll. Reuses the existing
 * sub-components/handlers (passed through as props) — no behavior change.
 *
 * Additive in T4: the sidebar copies remain until T7. The sidebar precedes
 * <main> in the DOM, so existing e2e specs keep hitting the sidebar copies.
 * Laid out as a single wrapping row so it never overflows at 140% UI scale.
 */
export function ReaderTopControls({
  translations,
  activeTranslations,
  onToggleTranslation,
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400">
      <TranslationPicker
        translations={translations}
        activeCodes={activeTranslations}
        onToggle={onToggleTranslation}
      />

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

      <select
        value={readerLayout}
        onChange={(e) => onReaderLayoutChange(e.target.value as ReaderLayout)}
        className="settings-input text-xs"
        aria-label="Reader layout"
      >
        <option value="columns">Columns</option>
        <option value="interleaved">Interleaved</option>
      </select>

      <select
        value={readerDensity}
        onChange={(e) => onReaderDensityChange(e.target.value as ReaderDensity)}
        className="settings-input text-xs"
        aria-label="Reader density"
      >
        <option value="comfortable">Comfortable</option>
        <option value="compact">Compact</option>
      </select>

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
