import { useRef, type ComponentProps } from "react";
import { useEscapeToClose } from "../../lib/useEscapeToClose";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { NavigationShortcuts } from "./NavigationShortcuts";

type NavigationShortcutsProps = ComponentProps<typeof NavigationShortcuts>;

type NavigationDrawerProps = NavigationShortcutsProps & {
  open: boolean;
  onClose: () => void;
};

/**
 * Right slide-in drawer that hosts the NavigationShortcuts
 * (bookmarks / recent / saved searches / workspaces) on demand. This is the
 * additive replacement for the persistent sidebar's NavigationShortcuts copy;
 * the sidebar copy remains until T7 removes it. Closes on backdrop click and
 * Escape. All NavigationShortcuts props are forwarded verbatim.
 */
export function NavigationDrawer({ open, onClose, ...shortcutsProps }: NavigationDrawerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true);
  useEscapeToClose(onClose, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        data-testid="nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation shortcuts"
        className="nav-drawer surface-panel absolute right-0 top-12 bottom-0 z-10 flex w-[300px] flex-col overflow-y-auto border-l border-neutral-800 p-4"
        style={{
          animation: "nav-drawer-slide-in var(--motion-expand) var(--ease-out) both",
        }}
      >
        <NavigationShortcuts {...shortcutsProps} />
      </div>
    </div>
  );
}
