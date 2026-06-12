"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import { getTrialStatus } from "@/lib/trial";
import { useClientValue } from "@/hooks/useClientValue";

// Dismissal lives in sessionStorage, so the banner stays hidden while the PM
// works but returns on a fresh session / next login (per product intent).
const DISMISS_KEY = "miyora_trial_banner_dismissed";

export function TrialBanner() {
  // Read the persisted dismissal hydration-safe (no setState-in-effect).
  const initiallyDismissed = useClientValue(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  }, false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (initiallyDismissed) return; // already dismissed this session — skip the fetch
    let active = true;
    getTrialStatus()
      .then((status) => {
        if (active && status) setDaysLeft(status.daysLeft);
      })
      .catch(() => {
        /* non-critical banner — stay silent on failure */
      });
    return () => {
      active = false;
    };
  }, [initiallyDismissed]);

  if (initiallyDismissed || daysLeft === null) return null;

  const message =
    daysLeft < 0
      ? "Your free trial has ended."
      : daysLeft === 0
        ? "Your free trial ends today."
        : daysLeft === 1
          ? "Your free trial ends tomorrow."
          : `Your free trial ends in ${daysLeft} days.`;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore storage failures */
    }
    // Hiding is just "no days to show" — one state instead of a second
    // dismissed flag that could desync from sessionStorage.
    setDaysLeft(null);
  };

  return (
    <div
      role="region"
      aria-label="Trial status"
      className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2.5 sm:px-6"
      style={{
        backgroundColor: "var(--nly-warning-bg)",
        borderColor: "var(--nly-border)",
      }}
    >
      <Clock
        size={16}
        className="shrink-0"
        style={{ color: "var(--nly-warning)" }}
        aria-hidden="true"
      />
      <p className="flex-1 text-xs sm:text-sm" style={{ color: "var(--nly-text-primary)" }}>
        <span className="font-semibold">{message}</span>{" "}
        <span style={{ color: "var(--nly-text-secondary)" }}>
          Upgrade to keep your community running.
        </span>
      </p>
      <Link
        href="/dashboard/billing"
        className="whitespace-nowrap text-xs font-semibold hover:underline sm:text-sm"
        style={{ color: "var(--nly-brand)" }}
      >
        Upgrade now →
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss trial reminder"
        className="shrink-0 rounded-md p-1 transition-opacity hover:opacity-70"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
