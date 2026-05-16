// Pure helpers for Phase 4 account closure. The atomic DB work lives in the
// `complete_pm_offboarding` / `hard_delete_expired_offboarding` Postgres RPCs
// (migration 031); this module only holds logic that the server action needs
// in TypeScript and that is worth unit-testing on its own.

export interface StripeAnonymization {
  name: string;
  email: string;
  metadata: {
    deleted_at: string;
    deletion_request_id: string;
  };
}

/**
 * GDPR-safe replacement values for a Stripe customer belonging to a deleted PM.
 * The subscription itself was already cancelled in Phase 3 (Gate 2); this only
 * scrubs the customer's identifying fields.
 */
export function buildStripeAnonymization(
  pmId: string,
  deletionRequestId: string,
  now: Date = new Date(),
): StripeAnonymization {
  return {
    name: "Deleted Account",
    email: `deleted-${pmId}@neighborlyy.internal`,
    metadata: {
      deleted_at: now.toISOString(),
      deletion_request_id: deletionRequestId,
    },
  };
}
