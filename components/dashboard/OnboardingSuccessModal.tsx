"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Copy, CalendarPlus, Megaphone, Share2, PartyPopper, Play } from "lucide-react";
import { toast } from "sonner";
import { celebrateOnboarding } from "@/lib/confetti";

interface OnboardingSuccessModalProps {
  communityName: string;
  communityCode: string;
  onShareCode: () => void;
  onStartTour: () => void;
}

const MODAL_DISMISSED_KEY = "nly-onboarding-modal-dismissed";

export function OnboardingSuccessModal({
  communityName,
  communityCode,
  onShareCode,
  onStartTour,
}: OnboardingSuccessModalProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadyDismissed =
      localStorage.getItem(MODAL_DISMISSED_KEY) === "true";
    if (!alreadyDismissed) {
      setVisible(true);
      // Fire confetti
      celebrateOnboarding();
    }
  }, []);

  const handleClose = (autoTour = true) => {
    localStorage.setItem(MODAL_DISMISSED_KEY, "true");
    setVisible(false);
    router.replace("/dashboard", { scroll: false });
    // Auto-start tour after modal dismisses
    if (autoTour && localStorage.getItem("nly-product-tour-completed") !== "true") {
      setTimeout(() => onStartTour(), 500);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(communityCode);
      toast.success("Community code copied!");
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const handleStartTour = () => {
    handleClose(false);
    onStartTour();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose(true);
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-4 sm:p-6 space-y-5 sm:space-y-6"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        {/* Celebration header */}
        <div className="text-center space-y-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.12)" }}
          >
            <PartyPopper size={28} style={{ color: "var(--nly-success)" }} />
          </div>
          <div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--nly-text-primary)" }}
            >
              Welcome to your dashboard!
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              {communityName} is live. Here&apos;s your community code to get
              started.
            </p>
          </div>
        </div>

        {/* Community code display */}
        <div
          className="rounded-xl p-4 text-center border"
          style={{
            backgroundColor: "var(--nly-input-bg)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p
            className="text-xs font-semibold mb-2"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            COMMUNITY CODE
          </p>
          <p
            className="text-2xl font-mono font-bold tracking-wider"
            style={{ color: "var(--nly-brand)" }}
          >
            {communityCode}
          </p>
          <button
            onClick={handleCopyCode}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--nly-brand)",
              color: "#fff",
            }}
          >
            <Copy size={12} />
            Copy Code
          </button>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            QUICK ACTIONS
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                handleClose();
                onShareCode();
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--nly-border)",
                backgroundColor: "var(--nly-input-bg)",
              }}
            >
              <Share2 size={18} style={{ color: "var(--nly-brand)" }} />
              <span
                className="text-xs font-medium text-center"
                style={{ color: "var(--nly-input-text)" }}
              >
                Share Code
              </span>
            </button>
            <button
              onClick={() => {
                handleClose();
                router.push("/dashboard/events");
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--nly-border)",
                backgroundColor: "var(--nly-input-bg)",
              }}
            >
              <CalendarPlus size={18} style={{ color: "var(--nly-accent)" }} />
              <span
                className="text-xs font-medium text-center"
                style={{ color: "var(--nly-input-text)" }}
              >
                Create Event
              </span>
            </button>
            <button
              onClick={() => {
                handleClose();
                router.push("/dashboard/feed");
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--nly-border)",
                backgroundColor: "var(--nly-input-bg)",
              }}
            >
              <Megaphone size={18} style={{ color: "var(--nly-warning)" }} />
              <span
                className="text-xs font-medium text-center"
                style={{ color: "var(--nly-input-text)" }}
              >
                Announce
              </span>
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={() => handleClose(true)}
            className="w-full h-11 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
          >
            Got it, let&apos;s go!
          </button>
          <button
            onClick={handleStartTour}
            className="w-full h-10 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-secondary)",
              backgroundColor: "transparent",
            }}
          >
            <Play size={14} />
            Take a Tour
          </button>
        </div>
      </div>
    </div>
  );
}
