import type { ReactNode } from "react";

/**
 * Compact icon mode-nav button for the TopBar strip. The visible content is the
 * icon; the text label is preserved in the DOM via an `sr-only` span so that
 * WebdriverIO's `$("button=Reader")` text selector (matches on textContent,
 * including visually-hidden text) keeps resolving after the WC1 reskin. The
 * label is also the button's `aria-label` for assistive tech.
 */
export function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={
        "flex items-center justify-center rounded-md p-2 transition-colors " +
        (active
          ? "bg-amber-500/15 text-amber-100 shadow-sm"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200")
      }
    >
      {icon ? <span className="flex-none opacity-90">{icon}</span> : null}
      <span className="sr-only">{label}</span>
    </button>
  );
}
