import type { Translation } from "../../lib/bible";

interface TriggerProps {
  onClick: () => void;
  translations: Translation[];
  activeTranslations: string[];
  open: boolean;
}

/**
 * Trigger button for the translation switcher popover. Shows the primary
 * translation code (activeTranslations[0]) plus a compare indicator ("+N")
 * when more than one translation is active, and a chevron.
 */
export function TranslationSwitcherButton({
  onClick,
  translations,
  activeTranslations,
  open,
}: TriggerProps) {
  const primaryCode = activeTranslations[0] ?? "—";
  const primary = translations.find((t) => t.code === primaryCode);
  const extra = activeTranslations.length - 1;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="translation-switcher-trigger"
      title={primary?.name ?? "Select translation"}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`Switch translation — ${primaryCode}${extra > 0 ? ` +${extra} more` : ""}`}
      className="btn-secondary flex items-center gap-2 px-3 py-1 text-sm"
    >
      <span className="font-mono text-xs">{primaryCode}</span>
      {extra > 0 && (
        <span className="meta-pill px-1.5 text-xs text-neutral-300">+{extra}</span>
      )}
      <span aria-hidden="true" className="text-neutral-500">
        ▾
      </span>
    </button>
  );
}

interface PopoverProps {
  translations: Translation[];
  activeTranslations: string[];
  onToggleTranslation: (code: string) => void;
}

/**
 * Popover content for the translation switcher. Renders the translation
 * checkbox list reusing the same markup/testids as TranslationPicker — each
 * option keeps `data-testid="translation-{code}"`. When more than one
 * translation is active, shows a small Compare note.
 *
 * Layout control intentionally omitted here — it lives in ReadingSettingsMenu
 * to avoid duplicating the "Reader layout" select.
 */
export function TranslationSwitcherPopover({
  translations,
  activeTranslations,
  onToggleTranslation,
}: PopoverProps) {
  const compare = activeTranslations.length > 1;
  return (
    <div data-testid="translation-switcher-popover" className="w-64">
      <h3 className="text-xs tracking-wider text-neutral-500 mb-2">Translations</h3>
      <ul className="space-y-1">
        {translations.map((t) => {
          const checked = activeTranslations.includes(t.code);
          return (
            <li key={t.code}>
              <label className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleTranslation(t.code)}
                  data-testid={`translation-${t.code}`}
                  className="accent-indigo-500"
                />
                <span className="font-mono text-xs text-neutral-400 w-10">{t.code}</span>
                <span className="text-neutral-200 truncate">{t.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {compare && (
        <p className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-xs text-neutral-500">
          {activeTranslations.length} translations active. Use the Compare button
          to view them side by side; pick the column or interleaved layout in
          Reading settings.
        </p>
      )}
    </div>
  );
}
