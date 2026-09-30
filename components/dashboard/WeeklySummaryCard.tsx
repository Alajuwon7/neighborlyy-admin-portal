import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import {
  formatWeekRange,
  isQuiet,
  metricLabel,
  visibleMetrics,
  type DigestWithSuggestions,
} from "@/lib/digest";

export interface WeeklySummaryEntry {
  communityId: string;
  communityName: string;
  digest: DigestWithSuggestions;
}

/**
 * Dashboard teaser for each community's latest weekly digest. The full
 * history and the A/B choice live on the community's Weekly Summary tab.
 */
export function WeeklySummaryCard({
  entries,
  showCommunity,
}: {
  entries: WeeklySummaryEntry[];
  showCommunity: boolean;
}) {
  return (
    <div
      className="nly-card-hover rounded-2xl border"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <div
        className="px-5 py-4 border-b flex items-center gap-2"
        style={{ borderColor: "var(--nly-border)" }}
      >
        <BarChart3 size={16} style={{ color: "var(--nly-brand)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          Weekly Summary
        </h3>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
        {entries.map(({ communityId, communityName, digest }) => {
          const quiet = isQuiet(digest);
          // Active residents first — it's the headline number — then the
          // busiest activity metrics.
          const metrics = [
            ...(digest.active_residents > 0 ? (["active_residents"] as const) : []),
            ...visibleMetrics([digest]).filter((k) => k !== "active_residents"),
          ].slice(0, 4);
          const needsPick =
            digest.suggestions.length > 0 && digest.suggestions.every((s) => s.status === "open");
          return (
            <Link
              key={communityId}
              href={`/dashboard/communities/${communityId}/summary`}
              className="block px-5 py-4 transition-colors duration-200 hover:bg-[var(--nly-surface-hover)] group"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                  {showCommunity ? `${communityName} · ` : ""}
                  {formatWeekRange(digest.week_start, digest.week_end)}
                </p>
                <ArrowRight
                  size={14}
                  className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                  style={{ color: "var(--nly-text-tertiary)" }}
                />
              </div>
              {quiet ? (
                <p className="text-sm mt-1" style={{ color: "var(--nly-text-secondary)" }}>
                  Quiet week
                </p>
              ) : (
                <>
                  {digest.narrative && (
                    <p
                      className="text-sm mt-1.5 leading-relaxed line-clamp-3"
                      style={{ color: "var(--nly-text-secondary)" }}
                    >
                      {digest.narrative}
                    </p>
                  )}
                  {metrics.length > 0 && (
                    <p className="text-xs mt-2" style={{ color: "var(--nly-text-tertiary)" }}>
                      {metrics.map((k) => metricLabel(k, digest[k])).join(" · ")}
                    </p>
                  )}
                </>
              )}
              {needsPick && (
                <p className="text-xs font-medium mt-2" style={{ color: "var(--nly-brand)" }}>
                  Two suggestions ready — pick this week&apos;s focus
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
