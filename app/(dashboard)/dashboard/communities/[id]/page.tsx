import { getCommunityWithAuth } from "@/lib/queries";
import { trialDaysLeft as computeTrialDaysLeft } from "@/lib/trial-days";
import {
  Building2,
  Users,
  Calendar,
  Shield,
  Palette,
  MapPin,
  CreditCard,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommunityOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const [{ count: pendingCount }, { count: alertsCount }] = await Promise.all([
    supabase
      .from("pending_users")
      .select("id", { count: "exact", head: true })
      .eq("community_code", community.community_code)
      .eq("status", "pending"),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("community_code", community.community_code),
  ]);

  const trialDaysLeft =
    community.status === "trial" && community.trial_ends_at
      ? Math.max(0, computeTrialDaysLeft(community.trial_ends_at))
      : null;

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Trial banner */}
      {trialDaysLeft !== null && (
        <div
          className="rounded-xl px-5 py-3 flex items-center justify-between"
          style={{
            backgroundColor:
              trialDaysLeft <= 3
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(245, 158, 11, 0.1)",
            borderLeft: `3px solid ${
              trialDaysLeft <= 3 ? "var(--nly-error)" : "var(--nly-warning)"
            }`,
          }}
        >
          <p
            className="text-sm font-medium"
            style={{
              color:
                trialDaysLeft <= 3 ? "var(--nly-error)" : "var(--nly-warning)",
            }}
          >
            {trialDaysLeft > 0
              ? `${trialDaysLeft} days remaining in your trial`
              : "Your trial has ended"}
          </p>
          <a
            href="/dashboard/billing"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            Upgrade Plan
          </a>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Property Details */}
        <section
          className="rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <h2
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--nly-text-primary)" }}
          >
            <Building2 size={15} /> Property Details
          </h2>
          <div className="space-y-3">
            <InfoRow label="Property Type" value={community.property_type ?? "—"} capitalize />
            <InfoRow label="Unit Count" value={`${community.unit_count} units`} />
            <InfoRow
              label="Address"
              value={
                [community.street_address, community.city, community.state, community.zip_code]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
              icon={<MapPin size={13} />}
            />
            <InfoRow label="Community Code" value={community.community_code} mono />
          </div>
        </section>

        {/* Admin & Access */}
        <section
          className="rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <h2
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--nly-text-primary)" }}
          >
            <Shield size={15} /> Admin & Access
          </h2>
          <div className="space-y-3">
            <InfoRow label="Admin Code" value={community.admin_code ?? "—"} mono />
            <InfoRow
              label="Subscription"
              value={community.subscription_tier ?? "None"}
              capitalize
              icon={<CreditCard size={13} />}
            />
            <InfoRow
              label="Status"
              value={community.status}
              capitalize
            />
            <InfoRow
              label="Created"
              value={new Date(community.created_at).toLocaleDateString()}
              icon={<Calendar size={13} />}
            />
          </div>
        </section>

        {/* Branding */}
        <section
          className="rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <h2
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--nly-text-primary)" }}
          >
            <Palette size={15} /> Branding
          </h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border"
                style={{
                  backgroundColor: community.primary_color,
                  borderColor: "var(--nly-border)",
                }}
              />
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Primary
                </p>
                <p
                  className="text-xs font-mono"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {community.primary_color}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border"
                style={{
                  backgroundColor: community.accent_color,
                  borderColor: "var(--nly-border)",
                }}
              />
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  Accent
                </p>
                <p
                  className="text-xs font-mono"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {community.accent_color}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section
          className="rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <h2
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--nly-text-primary)" }}
          >
            <Users size={15} /> Quick Stats
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <StatBlock label="Units" value={community.unit_count ?? 0} />
            <StatBlock label="Pending" value={pendingCount ?? 0} />
            <StatBlock label="Alerts" value={alertsCount ?? 0} />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  mono,
  capitalize,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span
        className="text-xs shrink-0"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className={`text-xs text-right ${mono ? "font-mono" : ""} ${
          capitalize ? "capitalize" : ""
        } flex items-center gap-1`}
        style={{ color: "var(--nly-text-secondary)" }}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ backgroundColor: "var(--nly-background)" }}
    >
      <p
        className="text-xl font-bold"
        style={{ color: "var(--nly-text-primary)" }}
      >
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
        {label}
      </p>
    </div>
  );
}
