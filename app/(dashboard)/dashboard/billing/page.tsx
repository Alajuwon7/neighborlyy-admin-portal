import { getAuthenticatedPM } from "@/lib/queries";
import { Header } from "@/components/dashboard/Header";
import { differenceInDays } from "date-fns";
import {
  CreditCard,
  ArrowUpRight,
  Clock,
  CheckCircle,
  ArrowDown,
  ArrowUp,
  XCircle,
  RotateCcw,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TIER_INFO: Record<string, { name: string; price: string; color: string }> = {
  starter: { name: "Starter", price: "$99/mo", color: "var(--nly-accent)" },
  professional: { name: "Professional", price: "$199/mo", color: "var(--nly-brand)" },
  enterprise: { name: "Enterprise", price: "$399/mo", color: "var(--nly-success)" },
  white_label: { name: "White Label", price: "Custom", color: "var(--nly-warning)" },
};

const EVENT_ICONS: Record<string, typeof CheckCircle> = {
  created: CheckCircle,
  upgraded: ArrowUp,
  downgraded: ArrowDown,
  cancelled: XCircle,
  reactivated: RotateCcw,
};

export default async function BillingPage() {
  const { supabase, pm } = await getAuthenticatedPM();

  // Fetch communities with billing info
  let commQuery = supabase
    .from("communities")
    .select(
      "id, name, status, subscription_tier, trial_ends_at, stripe_customer_id, stripe_subscription_id"
    );
  if (pm.organization_id) {
    commQuery = commQuery.eq("organization_id", pm.organization_id);
  } else {
    commQuery = commQuery.eq("property_manager_id", pm.id);
  }
  const { data: communitiesRaw } = await commQuery;

  const communities =
    (communitiesRaw as {
      id: string;
      name: string;
      status: string;
      subscription_tier: string | null;
      trial_ends_at: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }[]) ?? [];

  const communityIds = communities.map((c) => c.id);

  // Fetch subscription history
  const { data: historyRaw } = communityIds.length
    ? await supabase
        .from("subscription_history")
        .select("*")
        .in("community_id", communityIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };

  const history =
    (historyRaw as {
      id: string;
      community_id: string;
      event_type: string;
      from_tier: string | null;
      to_tier: string | null;
      amount: number | null;
      created_at: string;
    }[]) ?? [];

  const communityMap = new Map(communities.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col flex-1">
      <Header title="Billing" subtitle="Manage subscriptions and payments" />

      <main className="flex-1 p-6 space-y-6">
        {/* Current plans */}
        <div className="space-y-3">
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Current Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communities.map((c) => {
              const tier = c.subscription_tier
                ? TIER_INFO[c.subscription_tier]
                : null;
              const trialDaysLeft =
                c.status === "trial" && c.trial_ends_at
                  ? Math.max(
                      0,
                      differenceInDays(
                        new Date(c.trial_ends_at),
                        new Date()
                      )
                    )
                  : null;

              return (
                <div
                  key={c.id}
                  className="rounded-2xl border p-5 space-y-4"
                  style={{
                    backgroundColor: "var(--nly-surface)",
                    borderColor: "var(--nly-border)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--nly-text-primary)" }}
                      >
                        {c.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <CreditCard
                          size={13}
                          style={{ color: tier?.color ?? "var(--nly-text-tertiary)" }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: tier?.color ?? "var(--nly-text-tertiary)" }}
                        >
                          {tier?.name ?? "No plan"} {tier?.price ? `- ${tier.price}` : ""}
                        </span>
                      </div>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
                      style={{
                        backgroundColor:
                          c.status === "active"
                            ? "rgba(16, 185, 129, 0.1)"
                            : c.status === "trial"
                            ? "rgba(245, 158, 11, 0.1)"
                            : "rgba(239, 68, 68, 0.1)",
                        color:
                          c.status === "active"
                            ? "var(--nly-success)"
                            : c.status === "trial"
                            ? "var(--nly-warning)"
                            : "var(--nly-error)",
                      }}
                    >
                      {c.status}
                    </span>
                  </div>

                  {trialDaysLeft !== null && (
                    <div className="flex items-center gap-2">
                      <Clock
                        size={13}
                        style={{
                          color:
                            trialDaysLeft <= 3
                              ? "var(--nly-error)"
                              : "var(--nly-warning)",
                        }}
                      />
                      <span
                        className="text-xs"
                        style={{
                          color:
                            trialDaysLeft <= 3
                              ? "var(--nly-error)"
                              : "var(--nly-warning)",
                        }}
                      >
                        {trialDaysLeft > 0
                          ? `${trialDaysLeft} days left in trial`
                          : "Trial expired"}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled
                    title="Self-serve subscription management is coming soon. Email support@miyora-app.com to make changes."
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl text-white opacity-60 cursor-not-allowed"
                    style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
                  >
                    <ArrowUpRight size={14} />
                    {c.stripe_subscription_id ? "Manage Subscription" : "Upgrade Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscription history */}
        <div className="space-y-3">
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Subscription History
          </h2>
          {history.length === 0 ? (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{
                backgroundColor: "var(--nly-surface)",
                borderColor: "var(--nly-border)",
              }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                No subscription events yet.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{
                backgroundColor: "var(--nly-surface)",
                borderColor: "var(--nly-border)",
              }}
            >
              {history.map((h) => {
                const Icon = EVENT_ICONS[h.event_type] ?? CheckCircle;
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 px-5 py-3.5"
                    style={{ borderColor: "var(--nly-divider)" }}
                  >
                    <Icon
                      size={16}
                      style={{ color: "var(--nly-text-tertiary)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm capitalize"
                        style={{ color: "var(--nly-text-primary)" }}
                      >
                        {h.event_type}
                        {h.to_tier ? ` to ${h.to_tier}` : ""}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--nly-text-tertiary)" }}
                      >
                        {communityMap.get(h.community_id) ?? "Unknown"} &middot;{" "}
                        {new Date(h.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {h.amount !== null && (
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--nly-text-primary)" }}
                      >
                        ${h.amount.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
