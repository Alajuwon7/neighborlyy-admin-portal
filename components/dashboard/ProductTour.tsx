"use client";

import {
  Joyride,
  STATUS,
  ACTIONS,
  type Step,
  type EventData,
} from "react-joyride";
import { useClientValue } from "@/hooks/useClientValue";

interface ProductTourProps {
  run: boolean;
  onClose: () => void;
}

const sharedStepProps: Partial<Step> = {
  buttons: ["back", "skip", "primary"],
  showProgress: true,
  primaryColor: "#2FC4D3",
  backgroundColor: "#0F1923",
  textColor: "#E9EEF4",
  arrowColor: "#0F1923",
};

const steps: Step[] = [
  {
    ...sharedStepProps,
    target: '[data-tour="community-card"]',
    content:
      "This is your community. Click to manage residents, events, and more.",
    placement: "bottom",
  },
  {
    ...sharedStepProps,
    target: '[data-tour="summary-cards"]',
    content:
      "Monitor key metrics like residents, pending approvals, and events at a glance.",
    placement: "bottom",
  },
  {
    ...sharedStepProps,
    target: '[data-tour="activity-feed"]',
    content:
      "Recent activity across your communities will show up here as residents join and interact.",
    placement: "top",
  },
];

export function ProductTour({ run, onClose }: ProductTourProps) {
  // Joyride targets DOM nodes, so only render after hydration.
  const mounted = useClientValue(() => true, false);

  const handleEvent = (data: EventData) => {
    const { status, action } = data;

    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE
    ) {
      localStorage.setItem("nly-product-tour-completed", "true");
      onClose();
    }
  };

  if (!mounted) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      styles={{
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        },
        tooltip: {
          borderRadius: 16,
          padding: 20,
        },
        tooltipContainer: {
          textAlign: "left",
        },
        buttonPrimary: {
          backgroundColor: "#2FC4D3",
          color: "#0B0F1A",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
        },
        buttonBack: {
          color: "#8899AA",
          fontSize: 13,
        },
        buttonSkip: {
          color: "#8899AA",
          fontSize: 13,
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
}
