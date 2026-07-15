import { differenceInCalendarDays } from "date-fns";

/**
 * Canonical "days left on trial" math, shared by every surface that shows a
 * trial countdown (sticky TrialBanner, dashboard chip, community page banner,
 * billing cards, CommunityCard) so they can never disagree on the same screen.
 *
 * Calendar-day based: 1 always means "ends tomorrow" and 0 "ends today",
 * regardless of time of day. Negative = already ended — clamp with
 * Math.max(0, ...) at call sites that don't distinguish ended trials.
 */
export function trialDaysLeft(trialEndsAt: string): number {
  return differenceInCalendarDays(new Date(trialEndsAt), new Date());
}

/**
 * Fewest calendar-days-left among communities still on trial (the soonest to
 * expire), clamped at 0. Returns null when no community is on trial. Lets the
 * header show one honest countdown for a PM with several trials on different
 * clocks instead of arbitrarily using the first community.
 */
export function soonestTrialDaysLeft(
  communities: { status: string; trial_ends_at: string | null }[],
  now: Date = new Date(),
): number | null {
  const days = communities
    .filter((c) => c.status === "trial" && c.trial_ends_at)
    .map((c) =>
      Math.max(0, differenceInCalendarDays(new Date(c.trial_ends_at as string), now)),
    );
  return days.length ? Math.min(...days) : null;
}
