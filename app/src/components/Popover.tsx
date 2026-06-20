import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  ariaLabel?: string;
}

/**
 * Anchored popover primitive. The caller is responsible for wrapping the
 * trigger button + this <Popover> in a `position: relative` element so the
 * absolutely-positioned panel anchors beneath the trigger.
 *
 * Closes on: a `mousedown` outside the panel, or Escape. The panel's own
 * `onMouseDown` stops propagation so clicks inside never reach the document
 * listener — critical for multi-toggle loops (e.g. toggling several
 * translation checkboxes without the popover self-closing).
 *
 * Focuses the panel (or its first focusable child) on open and restores focus
 * to the previously-focused element on close.
 */
export function Popover({
  open,
  onClose,
  children,
  className,
  labelledBy,
  ariaLabel,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Click-outside (mousedown) + Escape to close.
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // Focus management: focus the panel (or first focusable) on open; restore on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panel).focus();
    }

    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onMouseDown={(event) => event.stopPropagation()}
      className={
        "surface-panel absolute left-0 top-full z-50 mt-2 rounded-lg p-4 shadow-lg outline-none " +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}
