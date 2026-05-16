import type { CommunityDisposition } from "./types";

const VALID_ACTIONS = ["transfer", "suspend", "close"] as const;

export type DispositionAction = (typeof VALID_ACTIONS)[number];

export function isDispositionAction(value: unknown): value is DispositionAction {
  return typeof value === "string" && (VALID_ACTIONS as readonly string[]).includes(value);
}

export function canCloseCommunity(activeResidents: number): boolean {
  return activeResidents === 0;
}

export interface CommunitySummary {
  community_id: string;
  community_code: string;
  name: string;
  organization_id: string;
  active_residents: number;
  pending_residents: number;
  upcoming_events: number;
  open_help_requests: number;
}

export function dispositionForCommunity(
  dispositions: CommunityDisposition[],
  communityId: string,
): CommunityDisposition | null {
  return dispositions.find((d) => d.community_id === communityId) ?? null;
}

export function allCommunitiesHaveDisposition(
  communityIds: string[],
  dispositions: CommunityDisposition[],
): boolean {
  // Empty input returns false defensively. A PM with zero communities
  // should never reach the disposition page — the layout guard short-circuits
  // upstream. If they somehow do, we want the Continue button disabled
  // rather than silently advancing them to account closure with nothing to
  // disposition.
  if (communityIds.length === 0) return false;
  const decided = new Set(dispositions.map((d) => d.community_id));
  return communityIds.every((id) => decided.has(id));
}

export function dispositionLabel(action: DispositionAction): string {
  switch (action) {
    case "suspend":
      return "Suspended (awaiting a new property manager)";
    case "close":
      return "Closed and archived";
    case "transfer":
      return "Transferred to another property manager";
    default:
      return "Unknown disposition";
  }
}
