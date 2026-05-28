import { useEffect, useState } from "react";
import { TOUR_STEPS } from "./GuidedTour";
import { safeLocalStorageGet, safeLocalStorageSet } from "../../lib/localStorage";
import type { Mode } from "../../lib/mode";

const TOUR_DISMISSED_KEY = "bible-ai-tour-dismissed-v1";
const PROVIDER_SETUP_DISMISSED_KEY = "bible-ai-provider-setup-dismissed-v1";

export function useGuidedTour({
  selectMode,
  providerSetupComplete,
}: {
  selectMode: (mode: Mode) => void;
  providerSetupComplete: boolean;
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourDismissed, setTourDismissed] = useState(true);
  const [providerSetupDismissed, setProviderSetupDismissed] = useState(true);

  useEffect(() => {
    const dismissed = safeLocalStorageGet(TOUR_DISMISSED_KEY) === "1";
    setTourDismissed(dismissed);
    setProviderSetupDismissed(safeLocalStorageGet(PROVIDER_SETUP_DISMISSED_KEY) === "1");
  }, []);

  const openTour = (stepIndex = 0) => {
    const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
    setTourStepIndex(stepIndex);
    setTourOpen(true);
    selectMode(step.mode);
  };

  const dismissTourPrompt = () => {
    safeLocalStorageSet(TOUR_DISMISSED_KEY, "1");
    setTourDismissed(true);
  };

  const dismissProviderSetupPrompt = () => {
    safeLocalStorageSet(PROVIDER_SETUP_DISMISSED_KEY, "1");
    setProviderSetupDismissed(true);
  };

  const closeTour = (dismiss = false) => {
    setTourOpen(false);
    if (dismiss) dismissTourPrompt();
  };

  const goToTourStep = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, nextIndex));
    const step = TOUR_STEPS[clamped];
    setTourStepIndex(clamped);
    selectMode(step.mode);
  };

  const showProviderSetupPrompt = !providerSetupComplete && !providerSetupDismissed;

  useEffect(() => {
    if (providerSetupComplete && !providerSetupDismissed) {
      dismissProviderSetupPrompt();
    }
  }, [providerSetupComplete, providerSetupDismissed]);

  return {
    tourOpen,
    tourStepIndex,
    tourDismissed,
    openTour,
    closeTour,
    goToTourStep,
    dismissTourPrompt,
    showProviderSetupPrompt,
    dismissProviderSetupPrompt,
  };
}
