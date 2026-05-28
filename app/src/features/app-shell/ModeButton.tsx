export function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full text-left text-sm px-3 py-2 rounded-md transition-colors " +
        (active
          ? "bg-amber-500/15 text-amber-100 font-medium shadow-sm"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200")
      }
    >
      {label}
    </button>
  );
}
