"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cancelSubscription } from "./actions";
import { createClient } from "@/lib/supabase/client";

interface CommunityRow {
  id: string;
  name: string;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_cancel_at: string | null;
}

interface BillingClientProps {
  deletionRequestId: string;
  initialCommunities: CommunityRow[];
}

const STALL_MS = 10 * 60 * 1000;

export function BillingClient({ deletionRequestId, initialCommunities }: BillingClientProps) {
  const router = useRouter();
  const [communities, setCommunities] = useState<CommunityRow[]>(initialCommunities);
  const [working, setWorking] = useState<string | null>(null);
  const [actionCount, setActionCount] = useState(0);
  const [showStallHelp, setShowStallHelp] = useState(false);

  // Subscribe to community + deletion_request updates.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`offboarding-billing:${deletionRequestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "communities" },
        (payload: { new: Partial<CommunityRow> & { id?: string } }) => {
          if (!payload.new?.id) return;
          setCommunities((prev) =>
            prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deletion_requests",
          filter: `id=eq.${deletionRequestId}`,
        },
        (payload: { new: { stripe_resolved_at?: string | null } }) => {
          if (payload.new?.stripe_resolved_at) {
            router.refresh();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deletionRequestId, router]);

  // Stall watcher: 10 minutes after last cancel action without resolution.
  useEffect(() => {
    if (actionCount === 0) return;
    const timer = setTimeout(() => setShowStallHelp(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [actionCount]);

  async function handleCancel(communityId: string) {
    setWorking(communityId);
    const result = await cancelSubscription(communityId);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cancellation scheduled.");
    setActionCount((n) => n + 1);
  }

  const allResolved = communities.every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );

  return (
    <div className="space-y-3">
      {communities.map((c) => {
        const status = c.stripe_subscription_status ?? "none";
        const scheduled = status === "cancel_scheduled" || (c.stripe_cancel_at && status !== "canceled");
        return (
          <div
            key={c.id}
            className="rounded-2xl border p-4 space-y-2"
            style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                  {c.name}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--nly-text-secondary)" }}>
                  Status: {humanizeStatus(status)}
                  {c.stripe_cancel_at && status !== "canceled" && (
                    <> · ends {new Date(c.stripe_cancel_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              {!c.stripe_subscription_id ? (
                <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                  No subscription
                </span>
              ) : status === "canceled" ? (
                <span className="text-xs" style={{ color: "var(--nly-success)" }}>
                  ✓ Canceled
                </span>
              ) : scheduled ? (
                <span className="text-xs" style={{ color: "var(--nly-text-secondary)" }}>
                  Scheduled
                </span>
              ) : (
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => handleCancel(c.id)}
                  className="h-9 rounded-lg text-sm font-medium border px-3 transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-2"
                  style={{ borderColor: "var(--nly-brand)", color: "var(--nly-brand)" }}
                >
                  {working === c.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Schedule cancellation"
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {showStallHelp && (
        <div
          className="rounded-2xl border p-4 text-sm space-y-2"
          style={{ borderColor: "var(--nly-warning)", color: "var(--nly-text-primary)" }}
        >
          <p>
            We&apos;re still waiting for Stripe to confirm your cancellations.
            Need help?
          </p>
          <a
            href={buildSupportMailto(communities)}
            className="text-xs underline"
            style={{ color: "var(--nly-brand)" }}
          >
            Contact support@miyora.com
          </a>
        </div>
      )}

      <button
        type="button"
        disabled={!allResolved}
        onClick={() => router.push("/dashboard/account/offboarding/disposition")}
        className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        Continue to community decisions →
      </button>
    </div>
  );
}

function humanizeStatus(s: string | null): string {
  switch (s) {
    case "active": return "Active";
    case "canceled": return "Canceled";
    case "cancel_scheduled": return "Cancellation scheduled";
    case "past_due": return "Past due";
    case "unpaid": return "Unpaid";
    case "trialing": return "Trial";
    case "none":
    case null: return "No subscription";
    default: return s;
  }
}

function buildSupportMailto(communities: CommunityRow[]): string {
  const subs = communities
    .filter((c) => c.stripe_subscription_id)
    .map((c) => `${c.name}: ${c.stripe_subscription_id}`)
    .join("\n");
  const subject = encodeURIComponent("Offboarding billing stuck");
  const body = encodeURIComponent(`Stripe subscriptions:\n${subs}`);
  return `mailto:support@miyora.com?subject=${subject}&body=${body}`;
}
