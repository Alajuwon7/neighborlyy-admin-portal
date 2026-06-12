"use client";

import Link from "next/link";
import { trialDaysLeft as computeTrialDaysLeft } from "@/lib/trial-days";
import { Building2, MapPin, Users, ArrowRight, Smartphone } from "lucide-react";
import { motion } from "motion/react";

interface CommunityCardProps {
  id: string;
  name: string;
  community_code?: string;
  city: string | null;
  state: string | null;
  unit_count: number | null;
  property_type: string | null;
  status: string;
  trial_ends_at: string | null;
  primary_color: string | null;
  street_address?: string | null;
  index?: number;
}

export function CommunityCard({
  id,
  name,
  community_code,
  city,
  state,
  unit_count,
  property_type,
  status,
  trial_ends_at,
  primary_color,
  street_address,
  index = 0,
}: CommunityCardProps) {
  const isMigrated = !city && !street_address && unit_count == null;

  const trialDaysLeft =
    status === "trial" && trial_ends_at
      ? Math.max(0, computeTrialDaysLeft(trial_ends_at))
      : null;

  const statusConfig: Record<string, { bg: string; color: string }> = {
    active: { bg: "rgba(16, 185, 129, 0.1)", color: "var(--nly-success)" },
    trial: { bg: "rgba(245, 158, 11, 0.1)", color: "var(--nly-warning)" },
    suspended: { bg: "rgba(239, 68, 68, 0.1)", color: "var(--nly-error)" },
    cancelled: { bg: "rgba(239, 68, 68, 0.1)", color: "var(--nly-error)" },
  };

  const { bg, color } = statusConfig[status] ?? statusConfig.cancelled;

  if (isMigrated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="nly-card-hover rounded-2xl border p-5 flex flex-col gap-4"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-warning)",
          borderStyle: "dashed",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
            style={{ backgroundColor: primary_color ?? "var(--nly-brand)" }}
          >
            {name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: "var(--nly-text-primary)" }}
            >
              {name}
            </h3>
            {community_code && (
              <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                Code: {community_code}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: "rgba(139, 92, 246, 0.1)",
              color: "rgb(139, 92, 246)",
            }}
          >
            <Smartphone size={11} />
            Migrated from Mobile App
          </span>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              color: "var(--nly-warning)",
            }}
          >
            Setup Incomplete
          </span>
        </div>

        <Link
          href={`/dashboard/communities/${id}/complete-setup`}
          className="nly-btn-glow flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
          style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
        >
          Complete Setup
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/dashboard/communities/${id}`}
        className="nly-card-hover rounded-2xl border p-5 flex flex-col gap-4 block relative overflow-hidden group"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        {/* Hover accent glow */}
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500 pointer-events-none"
          style={{ backgroundColor: primary_color ?? "var(--nly-brand)" }}
        />

        <div className="flex items-start gap-3 relative">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: primary_color ?? "var(--nly-brand)" }}
          >
            {name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: "var(--nly-text-primary)" }}
            >
              {name}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={12} style={{ color: "var(--nly-text-tertiary)" }} />
              <p className="text-xs truncate" style={{ color: "var(--nly-text-tertiary)" }}>
                {city && state ? `${city}, ${state}` : "No address"}
              </p>
            </div>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
            style={{ backgroundColor: bg, color }}
          >
            {status}
          </span>
        </div>

        <div
          className="flex items-center gap-4 pt-3 border-t relative"
          style={{ borderColor: "var(--nly-divider)" }}
        >
          <div className="flex items-center gap-1.5">
            <Users size={13} style={{ color: "var(--nly-text-tertiary)" }} />
            <span className="text-xs" style={{ color: "var(--nly-text-secondary)" }}>
              {unit_count != null ? `${unit_count} units` : "\u2014"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 size={13} style={{ color: "var(--nly-text-tertiary)" }} />
            <span className="text-xs capitalize" style={{ color: "var(--nly-text-secondary)" }}>
              {property_type ?? "\u2014"}
            </span>
          </div>
          {trialDaysLeft !== null && (
            <span
              className="text-xs font-medium ml-auto"
              style={{
                color:
                  trialDaysLeft <= 3
                    ? "var(--nly-error)"
                    : trialDaysLeft <= 7
                    ? "var(--nly-warning)"
                    : "var(--nly-success)",
              }}
            >
              {trialDaysLeft > 0 ? `${trialDaysLeft}d left` : "Trial ended"}
            </span>
          )}
          {/* Arrow hint on hover */}
          <ArrowRight
            size={14}
            className="ml-auto opacity-0 group-hover:opacity-60 transition-all duration-300 group-hover:translate-x-0.5"
            style={{ color: "var(--nly-text-tertiary)" }}
          />
        </div>
      </Link>
    </motion.div>
  );
}
