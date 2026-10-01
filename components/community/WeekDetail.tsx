"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Minus } from "lucide-react";
import { SuggestionCard, useSuggestionChoice } from "@/components/community/WeeklySummaryList";
import {
  canChoose,
  formatWeekRange,
  isQuiet,
  metricTitle,
  type DigestWithSuggestions,
  type MetricComparison,
} from "@/lib/digest";

interface WeekDetailProps {
  communityId: string;
  digest: DigestWithSuggestions;
  comparisons: MetricComparison[];
  isNewest: boolean;
  nextSummaryLabel: string;
}

/**
 * The optional deep view of one week, reached from a card's "View details".
 * Adds what the card leaves out: every metric against the week before and the
 * 4-week average (the same baseline the suggestions are measured from), and
 * how much of the roster was active.
 */
export function WeekDetail({ communityId, digest: initialDigest, comparisons, isNewest, nextSummaryLabel }: WeekDetailProps) {
  const { digests, choosingId, choose } = useSuggestionChoice([initialDigest], communityId);
  const digest = digests[0];
  const quiet = isQuiet(digest);

  // Hide metrics that are zero now AND had no history — the same "never show
  // a structural zero" rule as the cards. A metric that dropped to 0 stays.
  const shown = comparisons.filter((m) => m.value > 0 || (m.previous ?? 0) > 0 || (m.average ?? 0) > 0);
  const activeShare =
    digest.residents_total > 0 ? Math.round((digest.active_residents / digest.residents_total) * 100) : null;

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-5">
      <div>
        <BackLink communityId={communityId} />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--nly-text-primary)" }}>
            {formatWeekRange(digest.week_start, digest.week_end)}
          </h2>
          {isNewest && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "rgba(47, 196, 211, 0.12)", color: "var(--nly-brand)" }}
            >
              Latest
            </span>
          )}
        </div>
      </div>

      {/* Narrative */}
      <Section>
        {quiet ? (
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            Quiet week — no new posts, comments, requests or events.
          </p>
        ) : digest.narrative ? (
          <p className="text-base leading-relaxed max-w-3xl" style={{ color: "var(--nly-text-secondary)" }}>
            {digest.narrative}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            No written summary for this week — the numbers are below.
          </p>
        )}
        {activeShare !== null && (
          <p className="text-sm mt-4" style={{ color: "var(--nly-text-primary)" }}>
            <span className="font-semibold">{digest.active_residents}</span>
            <span style={{ color: "var(--nly-text-secondary)" }}>
              {" "}
              of {digest.residents_total} residents took part ({activeShare}%)
            </span>
          </p>
        )}
      </Section>

      {/* Metrics vs last week and the 4-week average */}
      {shown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--nly-text-primary)" }}>
            How the week compared
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {shown.map((m) => (
              <StatTile key={m.key} metric={m} />
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {digest.suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
            Suggestions
          </h3>
          <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--nly-text-tertiary)" }}>
            {isNewest
              ? `Pick one to focus on. You can change your choice until ${nextSummaryLabel}.`
              : "This week has closed, so the choice is final."}
          </p>
          <div className="grid gap-3 md:grid-cols-2 max-w-5xl">
            {digest.suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                choosable={canChoose(s.status, isNewest)}
                isNewest={isNewest}
                nextSummaryLabel={nextSummaryLabel}
                busy={choosingId !== null}
                onChoose={() => choose(digest.week_start, s.id)}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export function BackLink({ communityId }: { communityId: string }) {
  return (
    <Link
      href={`/dashboard/communities/${communityId}/summary`}
      className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
      style={{ color: "var(--nly-text-tertiary)" }}
    >
      <ArrowLeft size={12} />
      Weekly Summary
    </Link>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      {children}
    </div>
  );
}

function StatTile({ metric }: { metric: MetricComparison }) {
  const delta = metric.previous === null ? null : metric.value - metric.previous;
  // Up is shown as good; down stays neutral grey rather than red — a slower
  // week in a small community isn't a failure to alarm the PM about.
  const tone = delta === null || delta === 0 ? "var(--nly-text-tertiary)" : delta > 0 ? "var(--nly-success)" : "var(--nly-text-tertiary)";
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        {metricTitle(metric.key)}
      </p>
      <p className="text-2xl font-semibold mt-1" style={{ color: "var(--nly-text-primary)" }}>
        {metric.value}
      </p>
      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: tone }}>
        <Icon size={11} />
        {delta === null ? (metric.average === null ? "First week on file" : "Last week not on file") : delta === 0 ? "Same as last week" : `${Math.abs(delta)} vs last week`}
      </p>
      {metric.average !== null && (
        <p className="text-[11px] mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
          4-wk avg {metric.average}
        </p>
      )}
    </div>
  );
}
