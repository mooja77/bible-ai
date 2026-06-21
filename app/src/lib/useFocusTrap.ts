import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus management for an open overlay: captures the previously-focused
 * element, moves focus into the container if it isn't already there, traps Tab
 * within the container, and restores focus to the trigger on unmount/close.
 * Call unconditionally (before any early return) and pass `active` = is-open.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const restore =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Move focus into the dialog if it isn't already inside.
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const firstInside = container.querySelector<HTMLElement>(FOCUSABLE);
      (firstInside ?? container).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const el = containerRef.current;
      if (!el) return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !el.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !el.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restore?.focus?.();
    };
  }, [active, containerRef]);
}
