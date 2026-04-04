"use client";

import { useState } from "react";
import { GettingStartedChecklist } from "./GettingStartedChecklist";
import { OnboardingSuccessModal } from "./OnboardingSuccessModal";
import { ShareCommunityCodeModal } from "./ShareCommunityCodeModal";
import { ProductTour } from "./ProductTour";

interface DashboardClientShellProps {
  showOnboardingModal: boolean;
  isNewUser: boolean;
  communityName: string;
  communityCode: string;
  communityCreatedAt: string;
  hasResidents: boolean;
  hasEvents: boolean;
  hasPendingUsers: boolean;
}

export function DashboardClientShell({
  showOnboardingModal,
  isNewUser,
  communityName,
  communityCode,
  communityCreatedAt,
  hasResidents,
  hasEvents,
  hasPendingUsers,
}: DashboardClientShellProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);

  return (
    <>
      {isNewUser && (
        <GettingStartedChecklist
          hasResidents={hasResidents}
          hasEvents={hasEvents}
          hasPendingUsers={hasPendingUsers}
          communityCreatedAt={communityCreatedAt}
          onShareCode={() => setShareModalOpen(true)}
        />
      )}

      {showOnboardingModal && (
        <OnboardingSuccessModal
          communityName={communityName}
          communityCode={communityCode}
          onShareCode={() => setShareModalOpen(true)}
          onStartTour={() => setTourRunning(true)}
        />
      )}

      <ShareCommunityCodeModal
        communityCode={communityCode}
        communityName={communityName}
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      <ProductTour
        run={tourRunning}
        onClose={() => setTourRunning(false)}
      />
    </>
  );
}
