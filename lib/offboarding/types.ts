export type DeletionStatus =
  | "pending"
  | "awaiting_corp_approval"
  | "in_review"
  | "billing_blocked"
  | "approved"
  | "completed"
  | "blocked"
  | "cancelled";

export type TransferStatus =
  | "pending"
  | "awaiting_corp_approval"
  | "incoming_pm_invited"
  | "incoming_pm_accepted"
  | "stripe_pending"
  | "completed"
  | "blocked"
  | "cancelled";

export type DeletionReason =
  | "moving_to_other_platform"
  | "property_sold"
  | "no_longer_managing"
  | "other";

export type TransferReason =
  | "staff_change_new_hire"
  | "staff_change_promotion"
  | "management_company_change"
  | "co_ownership_handoff"
  | "other";

export type AuditActor = "system" | "pm" | "corporation" | "support" | "cron";

export interface AuditEntry {
  actor: AuditActor;
  actor_id: string;
  action: string;
  at: string;
  ip_address?: string;
  note?: string;
}

export interface CommunityDisposition {
  community_id: string;
  action: "transfer" | "suspend" | "close";
  notes?: string;
  set_at: string;
}

export interface DeletionRequestRow {
  id: string;
  pm_id: string | null;
  org_id: string | null;
  reason: string | null;
  requested_at: string;
  corporation_approval_at: string | null;
  corporation_approver_name: string | null;
  corporation_approver_email: string | null;
  community_disposition: CommunityDisposition[];
  stripe_resolved_at: string | null;
  pii_wiped_at: string | null;
  soft_deleted_at: string | null;
  hard_deleted_at: string | null;
  status: DeletionStatus;
  audit_log: AuditEntry[];
  created_at: string;
  updated_at: string;
}

export interface TransferRequestRow {
  id: string;
  outgoing_pm_id: string | null;
  incoming_pm_email: string;
  incoming_pm_id: string | null;
  org_id: string | null;
  reason: string | null;
  effective_date: string | null;
  notes: string | null;
  community_ids: string[];
  requested_at: string;
  corporation_approval_at: string | null;
  corporation_approver_name: string | null;
  corporation_approver_email: string | null;
  stripe_reassigned_at: string | null;
  completed_at: string | null;
  status: TransferStatus;
  audit_log: AuditEntry[];
  created_at: string;
  updated_at: string;
}

export const OPEN_DELETION_STATUSES: DeletionStatus[] = [
  "pending",
  "awaiting_corp_approval",
  "in_review",
  "billing_blocked",
  "approved",
];

export const OPEN_TRANSFER_STATUSES: TransferStatus[] = [
  "pending",
  "awaiting_corp_approval",
  "incoming_pm_invited",
  "incoming_pm_accepted",
  "stripe_pending",
];
