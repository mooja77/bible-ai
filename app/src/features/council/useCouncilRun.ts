import { useCallback, useRef, useState } from "react";
import type { CouncilProgressEvent } from "../../lib/bible";
import { initialRunState, reduceRunEvent, type CouncilRunState } from "./councilRun";

/**
 * Holds the live Council run state. `handleEvent` is passed to
 * askCouncil(onProgress); `reset` clears it before a new ask. Events are
 * applied in arrival order (the channel delivers a single monotonic stream).
 */
export function useCouncilRun(): {
  runState: CouncilRunState;
  reset: () => void;
  handleEvent: (event: CouncilProgressEvent) => void;
} {
  const [runState, setRunState] = useState<CouncilRunState>(initialRunState);
  const ref = useRef<CouncilRunState>(runState);

  const reset = useCallback(() => {
    const fresh = initialRunState();
    ref.current = fresh;
    setRunState(fresh);
  }, []);

  const handleEvent = useCallback((event: CouncilProgressEvent) => {
    const next = reduceRunEvent(ref.current, event);
    ref.current = next;
    setRunState(next);
  }, []);

  return { runState, reset, handleEvent };
}
