"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelDeletionRequest } from "@/app/(dashboard)/dashboard/account/actions";
import { createClient } from "@/lib/supabase/client";
import { completeOffboarding } from "./actions";

// Two-tap window for the destructive confirm. The second tap must land within
// this window or the button disarms — no accidental closures.
const ARM_WINDOW_MS = 4000;

interface FinalConfirmationProps {
  requestId: string;
}

export function FinalConfirmation({ requestId }: FinalConfirmationProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"confirm" | "complete">("confirm");
  const [armed, setArmed] = useState(false);
  const [working, setWorking] = useState<"close" | "cancel" | null>(null);

  async function handleClose() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), ARM_WINDOW_MS);
      return;
    }
    setWorking("close");
    const result = await completeOffboarding();
    if (!result.ok) {
      setWorking(null);
      setArmed(false);
      toast.error(result.error);
      return;
    }
    setWorking(null);
    // Screen 6 is a client-side state swap — NOT a navigation. Status is now
    // 'completed', so any route change would be redirected by the layout guard.
    // The browser session is still alive in memory until handleSignOut calls
    // auth.signOut(). The state swap sidesteps both problems.
    setPhase("complete");
  }

  async function handleCancel() {
    setWorking("cancel");
    const result = await cancelDeletionRequest(requestId);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Your account closure has been cancelled.");
    router.push("/dashboard/account");
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  if (phase === "complete") {
    return (
      <section
        className="rounded-2xl border p-6 space-y-4 text-center"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Your account has been closed
        </h2>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Thank you for using Neighborlyy.
        </p>
        <ul
          className="text-sm space-y-1 text-left inline-block"
          style={{ color: "var(--nly-text-secondary)" }}
        >
          <li>✓ Communities handed off</li>
          <li>✓ Billing cancelled</li>
          <li>✓ Your personal data has been wiped</li>
        </ul>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          A confirmation has been sent to your email. Your community data will be
          permanently deleted in 30 days.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full h-10 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--nly-brand)" }}
        >
          Close this window
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <button
        type="button"
        onClick={handleCancel}
        disabled={working !== null}
        className="flex-1 h-10 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{
          borderColor: "var(--nly-border)",
          color: "var(--nly-text-secondary)",
          backgroundColor: "transparent",
        }}
      >
        {working === "cancel" ? "Cancelling..." : "Cancel — I changed my mind"}
      </button>
      <button
        type="button"
        onClick={handleClose}
        disabled={working !== null}
        className="flex-1 h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--nly-error)" }}
      >
        {working === "close"
          ? "Closing..."
          : armed
            ? "Tap again to confirm"
            : "Close my account"}
      </button>
    </div>
  );
}
