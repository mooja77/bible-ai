import type { ReactNode } from "react";

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
      aria-current={active ? "page" : undefined}
      className={
        "w-full flex items-center gap-2.5 text-left text-sm px-3 py-2 rounded-md transition-colors " +
        (active
          ? "bg-amber-500/15 text-amber-100 font-medium shadow-sm"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200")
      }
    >
      {icon ? <span className="flex-none opacity-90">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}
