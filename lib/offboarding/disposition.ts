import type { CommunityDisposition } from "./types";

export type DispositionAction = "transfer" | "suspend" | "close";

const VALID_ACTIONS: DispositionAction[] = ["transfer", "suspend", "close"];

export function isDispositionAction(value: unknown): value is DispositionAction {
  return typeof value === "string" && (VALID_ACTIONS as string[]).includes(value);
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
  if (communityIds.length === 0) return false;
  const decided = new Set(dispositions.map((d) => d.community_id));
  return communityIds.every((id) => decided.has(id));
}
