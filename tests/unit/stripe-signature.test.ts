import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

const SECRET = "whsec_test_" + "a".repeat(32);

function buildSignedPayload(
  stripe: Stripe,
  secret: string,
  payload: object,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const body = JSON.stringify(payload);
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
    timestamp,
  });
  return { body, header };
}

test("constructEvent accepts a correctly signed payload", () => {
  const stripe = new Stripe("sk_test_dummy");
  const { body, header } = buildSignedPayload(stripe, SECRET, {
    id: "evt_1",
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_1" } },
  });
  const evt = stripe.webhooks.constructEvent(body, header, SECRET);
  assert.equal(evt.id, "evt_1");
  assert.equal(evt.type, "customer.subscription.deleted");
});

test("constructEvent throws on tampered body", () => {
  const stripe = new Stripe("sk_test_dummy");
  const { header } = buildSignedPayload(stripe, SECRET, {
    id: "evt_1",
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_1" } },
  });
  const tamperedBody = JSON.stringify({ id: "evt_HACKED" });
  assert.throws(
    () => stripe.webhooks.constructEvent(tamperedBody, header, SECRET),
    Stripe.errors.StripeSignatureVerificationError,
  );
});

test("constructEvent throws on wrong secret", () => {
  const stripe = new Stripe("sk_test_dummy");
  const { body, header } = buildSignedPayload(stripe, SECRET, {
    id: "evt_1",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_1" } },
  });
  assert.throws(
    () => stripe.webhooks.constructEvent(body, header, "whsec_wrong_" + "b".repeat(32)),
    Stripe.errors.StripeSignatureVerificationError,
  );
});
