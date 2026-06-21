import { useState } from "react";
import type { Book, Translation } from "../../lib/bible";
import type { ReaderLayout, ReaderDensity } from "./types";
import { Popover } from "../../components/Popover";
import {
  TranslationSwitcherButton,
  TranslationSwitcherPopover,
} from "./TranslationSwitcher";
import { ReadingSettingsMenu } from "./ReadingSettingsMenu";

interface Props {
  selectedBook: Book | null;
  selectedChapter: number | null;
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
  referenceInput: string;
  onReferenceInputChange: (next: string) => void;
  referenceError: string | null;
  onReferenceErrorClear: () => void;
  onJump: () => void;
}

/**
 * Slim editorial reader control row. Houses the reference label, the
 * translation switcher (popover), an always-visible slim jump input, and the
 * "Aa" reading-settings (popover). Composes the W1–W3 primitives.
 *
 * Open one popover at a time; opening one closes the other.
 */
export function ReaderBar({
  selectedBook,
  selectedChapter,
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
  referenceInput,
  onReferenceInputChange,
  referenceError,
  onReferenceErrorClear,
  onJump,
}: Props) {
  const [translationPopoverOpen, setTranslationPopoverOpen] = useState(false);
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);

  return (
    <div
      data-testid="reader-bar"
      className="flex items-center gap-3 px-6 py-2 border-b border-[var(--border-subtle)]"
    >
      {/* Left: reference label */}
      <span className="text-sm font-semibold text-neutral-100 whitespace-nowrap">
        {selectedBook?.name ?? "—"} {selectedChapter ?? ""}
      </span>

      {/* Translation switcher */}
      <span className="relative inline-flex">
        <TranslationSwitcherButton
          translations={translations}
          activeTranslations={activeTranslations}
          open={translationPopoverOpen}
          onClick={() => {
            setSettingsPopoverOpen(false);
            setTranslationPopoverOpen((v) => !v);
          }}
        />
        <Popover
          open={translationPopoverOpen}
          onClose={() => setTranslationPopoverOpen(false)}
          ariaLabel="Translations"
        >
          <TranslationSwitcherPopover
            translations={translations}
            activeTranslations={activeTranslations}
            onToggleTranslation={onToggleTranslation}
          />
        </Popover>
      </span>

      {/* Always-rendered slim jump input (never display:none) */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          value={referenceInput}
          onChange={(e) => {
            onReferenceInputChange(e.target.value);
            onReferenceErrorClear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onJump();
          }}
          placeholder="Jump to… e.g. John 3:16"
          className="settings-input min-w-0 flex-1 text-sm"
          aria-label="Jump to reference"
        />
        <button type="button" onClick={onJump} className="btn-secondary px-3 text-sm">
          Go
        </button>
        {referenceError && (
          <span className="text-xs text-red-300">{referenceError}</span>
        )}
      </div>

      {/* Right: reading settings */}
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label="Reading settings"
          aria-haspopup="dialog"
          aria-expanded={settingsPopoverOpen}
          onClick={() => {
            setTranslationPopoverOpen(false);
            setSettingsPopoverOpen((v) => !v);
          }}
          className="btn-secondary px-3 py-1 text-sm"
        >
          Aa
        </button>
        <Popover
          open={settingsPopoverOpen}
          onClose={() => setSettingsPopoverOpen(false)}
          ariaLabel="Reading settings"
          className="right-0 left-auto"
        >
          <ReadingSettingsMenu
            fontScale={fontScale}
            onFontScaleChange={onFontScaleChange}
            readerLayout={readerLayout}
            onReaderLayoutChange={onReaderLayoutChange}
            readerDensity={readerDensity}
            onReaderDensityChange={onReaderDensityChange}
            syncScroll={syncScroll}
            onSyncScrollChange={onSyncScrollChange}
          />
        </Popover>
      </span>
    </div>
  );
}
