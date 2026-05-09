import { test } from "node:test";
import assert from "node:assert/strict";
import { allCommunitiesBillingResolved } from "../../app/api/webhooks/stripe/fan-in";

test("returns true when zero communities", () => {
  assert.equal(allCommunitiesBillingResolved([]), true);
});

test("returns true when all subs canceled", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "canceled" },
      { stripe_subscription_id: "sub_2", stripe_subscription_status: "canceled" },
    ]),
    true,
  );
});

test("returns true when communities have no sub at all", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: null, stripe_subscription_status: null },
      { stripe_subscription_id: null, stripe_subscription_status: null },
    ]),
    true,
  );
});

test("returns true when mix of canceled and no-sub", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "canceled" },
      { stripe_subscription_id: null, stripe_subscription_status: null },
    ]),
    true,
  );
});

test("returns false when one is still active", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "canceled" },
      { stripe_subscription_id: "sub_2", stripe_subscription_status: "active" },
    ]),
    false,
  );
});

test("returns false when one is past_due", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "past_due" },
    ]),
    false,
  );
});
