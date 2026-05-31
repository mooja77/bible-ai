import type { Translation } from "../../lib/bible";

interface Props {
  translations: Translation[];
  activeCodes: string[];
  onToggle: (code: string) => void;
}

export function TranslationPicker({ translations, activeCodes, onToggle }: Props) {
  return (
    <div>
      <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
        Translations
      </h3>
      <ul className="space-y-1">
        {translations.map((t) => {
          const checked = activeCodes.includes(t.code);
          return (
            <li key={t.code}>
              <label className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(t.code)}
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
    </div>
  );
}
