import { useEffect, useState } from "react";
import { safeLocalStorageGet, safeLocalStorageSet } from "./localStorage";

const UI_SCALE_STORAGE_KEY = "ui-scale";

/**
 * Allowed whole-app text-size steps (percent of the root font-size). 100 = the
 * default, so an untouched install renders exactly as before. The cap (140)
 * keeps layouts intact while still meaningfully helping low-vision users.
 */
export const UI_SCALE_STEPS = [100, 112, 125, 140] as const;

const DEFAULT_UI_SCALE = 100;

function readStoredScale(): number {
  const raw = Number(safeLocalStorageGet(UI_SCALE_STORAGE_KEY));
  return (UI_SCALE_STEPS as readonly number[]).includes(raw) ? raw : DEFAULT_UI_SCALE;
}

/**
 * Whole-app text scaling. Sets the document root font-size so every rem-based
 * Tailwind utility (and the app's rem spacing) grows together. The Reader's own
 * em-based `fontScale` multiplies on top, so the reading baseline lifts too.
 *
 * Mirrors `useTheme`: localStorage-persisted, applied via a root-element effect.
 */
export function useUiScale() {
  const [uiScale, setUiScaleState] = useState<number>(readStoredScale);

  useEffect(() => {
    document.documentElement.style.fontSize = uiScale === DEFAULT_UI_SCALE ? "" : `${uiScale}%`;
  }, [uiScale]);

  useEffect(() => {
    safeLocalStorageSet(UI_SCALE_STORAGE_KEY, String(uiScale));
  }, [uiScale]);

  const setUiScale = (next: number) => {
    if ((UI_SCALE_STEPS as readonly number[]).includes(next)) setUiScaleState(next);
  };

  const stepBy = (direction: 1 | -1) => {
    setUiScaleState((current) => {
      const index = UI_SCALE_STEPS.indexOf(current as (typeof UI_SCALE_STEPS)[number]);
      const safeIndex = index === -1 ? UI_SCALE_STEPS.indexOf(DEFAULT_UI_SCALE) : index;
      const nextIndex = Math.min(UI_SCALE_STEPS.length - 1, Math.max(0, safeIndex + direction));
      return UI_SCALE_STEPS[nextIndex];
    });
  };

  return {
    uiScale,
    setUiScale,
    increaseUiScale: () => stepBy(1),
    decreaseUiScale: () => stepBy(-1),
    canIncrease: uiScale !== UI_SCALE_STEPS[UI_SCALE_STEPS.length - 1],
    canDecrease: uiScale !== UI_SCALE_STEPS[0],
  };
}
