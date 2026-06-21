interface Props {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onClear?: () => void;
  onJump: () => void;
}

/**
 * Slim horizontal jump-to-reference bar for the reader's main content area.
 * Mirrors the sidebar jump control (which remains until T7); the sidebar copy
 * precedes <main> in the DOM, so WebdriverIO `$()` keeps hitting the sidebar.
 */
export function JumpBar({ value, onChange, error, onClear, onJump }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onClear?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onJump();
          }}
          placeholder="Jump to… e.g. John 3:16"
          className="settings-input text-sm flex-1"
          aria-label="Jump to reference"
        />
        <button
          type="button"
          onClick={onJump}
          className="btn-secondary px-4 text-sm"
        >
          Go
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
