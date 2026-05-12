export function allCommunitiesBillingResolved(
  communities: { stripe_subscription_id: string | null; stripe_subscription_status: string | null }[],
): boolean {
  return communities.every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );
}
