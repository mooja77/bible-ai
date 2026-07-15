import { useEffect, useRef } from "react";

/**
 * Calls `onClose` when the user presses Escape. The latest callback is read via
 * a ref so an inline callback changing identity cannot create a lost-key window
 * while an open overlay re-renders.
 */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
