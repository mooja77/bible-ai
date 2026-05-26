import { useEffect, useRef } from "react";

/**
 * Calls `onClose` when the user presses Escape. For non-modal overlays/popups:
 * dismiss-on-Escape without trapping focus. The latest `onClose` is read via a
 * ref so the document listener is attached once (stable across re-renders) and
 * never goes stale — callers commonly pass an inline arrow whose identity
 * changes every render.
 */
export function useEscapeToClose(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
