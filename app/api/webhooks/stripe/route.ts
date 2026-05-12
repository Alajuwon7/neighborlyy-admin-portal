import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/offboarding/audit";
import { allCommunitiesBillingResolved } from "./fan-in";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: first writer wins. Subsequent retries return 200 immediately.
  const { data: inserted, error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type, payload: event as unknown as object })
    .select("id")
    .maybeSingle();

  if (insertError && (insertError as { code?: string }).code !== "23505") {
    console.error("[stripe-webhook] failed to record event", insertError);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
  if (!inserted) {
    return NextResponse.json({ received: true, deduped: true }, { status: 200 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
        break;
      default:
        // Other event types are recorded for audit but not actioned.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler error for ${event.type}`, err);
    // Still return 200 — we've recorded the event. Manual replay possible if needed.
    return NextResponse.json({ received: true, handler_error: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleSubscriptionUpdated(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  await admin
    .from("communities")
    .update({
      stripe_subscription_status: sub.status,
      stripe_cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    })
    .eq("stripe_subscription_id", sub.id)
    .neq("stripe_subscription_status", sub.status);
}

async function handleSubscriptionDeleted(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  // Mirror the idempotency pattern from handleSubscriptionUpdated.
  // Only enter fan-in when this UPDATE actually transitioned a row —
  // a duplicate "deleted" event won't trigger redundant fan-in queries.
  const { data: changed } = await admin
    .from("communities")
    .update({ stripe_subscription_status: "canceled" })
    .eq("stripe_subscription_id", sub.id)
    .neq("stripe_subscription_status", "canceled")
    .select("id");

  if (changed && changed.length > 0) {
    await runFanIn(admin, sub.id);
  }
}

async function handleInvoicePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice,
) {
  // invoice.subscription is `string | Stripe.Subscription | null` — webhooks
  // arrive unexpanded so it's a string in practice, but narrow defensively
  // in case expansion is ever enabled at the destination.
  const rawSubRef = (invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  }).subscription;
  const subId = typeof rawSubRef === "string" ? rawSubRef : rawSubRef?.id;
  if (!subId) return;

  const { data: community } = await admin
    .from("communities")
    .select("organization_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!community?.organization_id) return;

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id")
    .eq("org_id", community.organization_id)
    .eq("status", "in_review")
    .maybeSingle();
  if (!req) return;

  await admin
    .from("deletion_requests")
    .update({ status: "billing_blocked" })
    .eq("id", req.id)
    .eq("status", "in_review");

  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "system",
    actor_id: "stripe",
    action: "billing_blocked_by_payment_failure",
    note: `invoice=${invoice.id}; subscription=${subId}`,
  });
}

async function runFanIn(
  admin: ReturnType<typeof createAdminClient>,
  canceledSubId: string,
) {
  const { data: community } = await admin
    .from("communities")
    .select("organization_id")
    .eq("stripe_subscription_id", canceledSubId)
    .maybeSingle();
  if (!community?.organization_id) return;

  const { data: orgCommunities } = await admin
    .from("communities")
    .select("stripe_subscription_id, stripe_subscription_status")
    .eq("organization_id", community.organization_id);

  const allDone = allCommunitiesBillingResolved(orgCommunities ?? []);
  if (!allDone) return;

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id")
    .eq("org_id", community.organization_id)
    .eq("status", "in_review")
    .is("stripe_resolved_at", null)
    .maybeSingle();
  if (!req) return;

  const { error: updErr } = await admin
    .from("deletion_requests")
    .update({ stripe_resolved_at: new Date().toISOString() })
    .eq("id", req.id)
    .is("stripe_resolved_at", null);
  if (updErr) return;

  // Fan-in audit append happens AFTER the row update commits. If this throws,
  // the next event sees stripe_resolved_at already set and short-circuits at
  // the .is("stripe_resolved_at", null) guard above — leaving an audit gap.
  // Acceptable trade-off: the recorded stripe_webhook_events.payload row is
  // the replay surface. Promote to a single SQL RPC if audit completeness
  // becomes load-bearing.
  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "system",
    actor_id: "stripe",
    action: "billing_resolved",
    note: `last_subscription=${canceledSubId}`,
  });
}
