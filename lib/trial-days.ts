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
