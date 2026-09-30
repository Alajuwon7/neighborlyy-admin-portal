"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, BarChart3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chooseSuggestion } from "@/app/(dashboard)/dashboard/communities/[id]/summary/actions";
import {
  STATUS_LABEL,
  canChoose,
  formatWeekRange,
  isQuiet,
  metricLabel,
  suggestionTarget,
  visibleMetrics,
  type DigestWithSuggestions,
  type MetricKey,
  type Suggestion,
} from "@/lib/digest";

interface WeeklySummaryListProps {
  communityId: string;
  digests: DigestWithSuggestions[];
  loadFailed: boolean;
  /** "Monday, 5 October" — computed on the server so the render is stable. */
  nextSummaryLabel: string;
}

/**
 * Portal twin of the app's CommunityDigestScreen. The product rules are the
 * app's: a first-class empty state naming when the first summary arrives, a
 * compact "Quiet week" card, zero metrics never shown, and expired/unpicked
 * suggestions rendered plainly as "Not chosen" — never as an error.
 */
export function WeeklySummaryList({
  communityId,
  digests: initialDigests,
  loadFailed,
  nextSummaryLabel,
}: WeeklySummaryListProps) {
  const { digests, choosingId, choose: handleChoose } = useSuggestionChoice(initialDigests, communityId);

  // One metric set for every card so the layout doesn't change week to week.
  const keys = visibleMetrics(digests);

  if (loadFailed) {
    return (
      <Card>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Couldn&apos;t load your summaries. Please refresh to try again.
        </p>
      </Card>
    );
  }

  if (digests.length === 0) {
    return (
      <Card className="text-center py-10">
        <BarChart3 size={28} className="mx-auto mb-3" style={{ color: "var(--nly-brand)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          No weekly summary yet
        </p>
        <p className="text-sm mt-1.5" style={{ color: "var(--nly-text-secondary)" }}>
          Summaries are published every Monday for the week just ended.
          <br />
          Your first one arrives{" "}
          <span className="font-medium" style={{ color: "var(--nly-text-primary)" }}>
            {nextSummaryLabel}
          </span>
          .
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        This week is still in progress — next summary {nextSummaryLabel}.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {digests.map((d, i) => (
          <WeekCard
            key={d.week_start}
            communityId={communityId}
            digest={d}
            keys={keys}
            isNewest={i === 0}
            nextSummaryLabel={nextSummaryLabel}
            choosingId={choosingId}
            onChoose={handleChoose}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Optimistic A/B choice, rolled back as a pair on failure. Shared by the week
 * list and the week detail page so both behave identically.
 */
export function useSuggestionChoice(initialDigests: DigestWithSuggestions[], communityId: string) {
  const [digests, setDigests] = useState(initialDigests);
  const [choosingId, setChoosingId] = useState<string | null>(null);

  async function choose(weekStart: string, suggestionId: string) {
    const previous = digests;
    setDigests((rows) =>
      rows.map((d) =>
        d.week_start !== weekStart
          ? d
          : {
              ...d,
              suggestions: d.suggestions.map((s) => ({
                ...s,
                status: (s.id === suggestionId ? "chosen" : "not_chosen") as Suggestion["status"],
              })),
            },
      ),
    );
    setChoosingId(suggestionId);
    try {
      const result = await chooseSuggestion(suggestionId, communityId);
      if (result.error) {
        setDigests(previous);
        toast.error(result.error);
      } else {
        toast.success("Choice recorded");
      }
    } catch {
      setDigests(previous);
      toast.error("Couldn't save your choice. Please try again.");
    } finally {
      setChoosingId(null);
    }
  }

  return { digests, choosingId, choose };
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      {children}
    </div>
  );
}

function WeekCard({
  communityId,
  digest,
  keys,
  isNewest,
  nextSummaryLabel,
  choosingId,
  onChoose,
}: {
  communityId: string;
  digest: DigestWithSuggestions;
  keys: MetricKey[];
  isNewest: boolean;
  nextSummaryLabel: string;
  choosingId: string | null;
  onChoose: (weekStart: string, suggestionId: string) => void;
}) {
  const quiet = isQuiet(digest);
  // A metric live for the community can still be zero this week — hide it.
  const present = keys.filter((k) => digest[k] > 0);

  return (
    <Card className={`nly-week-card ${quiet ? "py-4" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight" style={{ color: "var(--nly-text-primary)" }}>
          {formatWeekRange(digest.week_start, digest.week_end)}
        </h3>
        {isNewest && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "rgba(47, 196, 211, 0.12)", color: "var(--nly-brand)" }}
          >
            Latest
          </span>
        )}
      </div>

      {quiet ? (
        <p className="text-sm mt-1" style={{ color: "var(--nly-text-tertiary)" }}>
          Quiet week
        </p>
      ) : (
        <>
          {digest.narrative && (
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--nly-text-secondary)" }}>
              {digest.narrative}
            </p>
          )}
          {present.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {present.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "var(--nly-surface-hover)", color: "var(--nly-text-secondary)" }}
                >
                  {metricLabel(k, digest[k])}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {digest.suggestions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 mt-4">
          {digest.suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              choosable={canChoose(s.status, isNewest)}
              isNewest={isNewest}
              nextSummaryLabel={nextSummaryLabel}
              busy={choosingId !== null}
              onChoose={() => onChoose(digest.week_start, s.id)}
            />
          ))}
        </div>
      )}

      {/* Opt-in detail view. The card itself stays inert — only this link
          navigates, so the Choose buttons can't be mis-clicked into it. */}
      <div className="flex justify-end mt-4">
        <Link
          href={`/dashboard/communities/${communityId}/summary/${digest.week_start}`}
          className="inline-flex items-center gap-1 text-xs font-medium hover:underline group/link"
          style={{ color: "var(--nly-brand)" }}
        >
          View details
          <ArrowRight size={12} className="transition-transform duration-200 group-hover/link:translate-x-0.5" />
        </Link>
      </div>
    </Card>
  );
}

export function SuggestionCard({
  suggestion,
  choosable,
  isNewest,
  nextSummaryLabel,
  busy,
  onChoose,
}: {
  suggestion: Suggestion;
  choosable: boolean;
  isNewest: boolean;
  nextSummaryLabel: string;
  busy: boolean;
  onChoose: () => void;
}) {
  const chosen = suggestion.status === "chosen";
  const positive = chosen || suggestion.status === "achieved";

  return (
    <div
      className="rounded-xl border p-4 flex flex-col"
      style={{
        borderColor: chosen ? "var(--nly-brand)" : "var(--nly-border)",
        backgroundColor: chosen ? "rgba(47, 196, 211, 0.06)" : "transparent",
      }}
    >
      <p className="text-[11px] font-semibold tracking-wide" style={{ color: "var(--nly-text-tertiary)" }}>
        OPTION {suggestion.variant}
      </p>
      <p className="text-sm font-medium mt-1" style={{ color: "var(--nly-text-primary)" }}>
        {suggestion.title}
      </p>
      <p className="text-xs mt-1 leading-relaxed flex-1" style={{ color: "var(--nly-text-secondary)" }}>
        {suggestion.rationale}
      </p>
      <p className="text-[11px] mt-2" style={{ color: "var(--nly-text-tertiary)" }}>
        {suggestionTarget(suggestion)}
      </p>

      <div className="flex items-center justify-between gap-2 mt-3 min-h-8">
        {/* An untouched pair shows buttons only; the chosen one shows its
            status; the sibling shows "Not chosen" AND the way to switch. */}
        {suggestion.status !== "open" && (
          <span
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: positive ? "var(--nly-success)" : "var(--nly-text-tertiary)" }}
          >
            {chosen && <Check size={12} />}
            {STATUS_LABEL[suggestion.status]}
          </span>
        )}
        {choosable && !chosen && (
          <Button
            size="sm"
            disabled={busy}
            onClick={onChoose}
            className="text-xs ml-auto"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
            aria-label={`Choose option ${suggestion.variant}: ${suggestion.title}`}
          >
            {suggestion.status === "not_chosen" ? "Switch to this" : "Choose this"}
          </Button>
        )}
      </div>

      {chosen && isNewest && (
        <p className="text-[11px] mt-2" style={{ color: "var(--nly-text-tertiary)" }}>
          Recorded. You can change this until {nextSummaryLabel}.
        </p>
      )}
    </div>
  );
}
