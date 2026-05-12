import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(`${origin}/onboarding?step=5&error=no_session`);
  }

  try {
    // 1. Verify the Stripe checkout session
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkoutSession.status !== "complete") {
      return NextResponse.redirect(
        `${origin}/onboarding?step=5&error=payment_incomplete`
      );
    }

    // 2. Get IDs from metadata
    const onboardingSessionId = checkoutSession.metadata?.onboarding_session_id;
    const userId = checkoutSession.metadata?.supabase_user_id;

    if (!onboardingSessionId || !userId) {
      return NextResponse.redirect(
        `${origin}/onboarding?step=5&error=missing_data`
      );
    }

    // 3. Retrieve onboarding data from temporary storage
    const supabase = await createClient();
    const { data: onboardingSession } = await supabase
      .from("onboarding_sessions")
      .select("data")
      .eq("id", onboardingSessionId)
      .single();

    if (!onboardingSession) {
      return NextResponse.redirect(
        `${origin}/onboarding?step=5&error=session_expired`
      );
    }

    const onboardingData = onboardingSession.data as Record<string, string>;

    // 4. Get property manager
    const { data: pmData } = await supabase
      .from("property_managers")
      .select("id, organization_id, full_name")
      .eq("user_id", userId)
      .single();

    const pm = pmData as { id: string; organization_id: string | null; full_name: string } | null;
    if (!pm) {
      return NextResponse.redirect(
        `${origin}/onboarding?step=5&error=no_profile`
      );
    }

    // 4b. Create or reuse organization. Routed through the SECURITY DEFINER
    // RPC for the same reason as the skip-payment path: PostgREST's
    // .insert().select() compiles to RETURNING, which makes Postgres run
    // org_read_own's USING clause on the new row before the PM is linked.
    let orgId = pm.organization_id;
    if (!orgId) {
      const orgType = onboardingData.org_type || "individual";
      const orgName =
        orgType === "company" && onboardingData.org_name?.trim()
          ? onboardingData.org_name.trim()
          : pm.full_name;

      const { data: newOrgId, error: orgError } = await supabase.rpc(
        "onboarding_create_org_and_link",
        {
          p_org_name: orgName,
          p_org_type: orgType,
          p_company_name: orgType === "company" ? orgName : null,
        }
      );

      if (orgError || !newOrgId) {
        console.error("Org creation failed in stripe success:", orgError);
        return NextResponse.redirect(
          `${origin}/onboarding?step=5&error=setup_failed`
        );
      }
      orgId = newOrgId as string;
    }

    // 5. Extract Stripe subscription details
    const subscription = checkoutSession.subscription as Stripe.Subscription;
    const stripeCustomerId =
      typeof checkoutSession.customer === "string"
        ? checkoutSession.customer
        : checkoutSession.customer?.id ?? null;
    const stripeSubscriptionId = subscription?.id ?? null;
    const plan = subscription?.metadata?.plan ?? onboardingData.subscription_tier ?? "professional";

    const trialEndsAt = subscription?.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 6. Create the community
    const fullName = `Miyora @ ${onboardingData.name}`;

    const { error: communityError } = await supabase.from("communities").insert({
      property_manager_id: pm.id,
      organization_id: orgId,
      building_name: onboardingData.name,
      name: fullName,
      community_code: onboardingData.community_code,
      street_address: onboardingData.street_address,
      city: onboardingData.city,
      state: onboardingData.state,
      zip_code: onboardingData.zip_code,
      unit_count: parseInt(onboardingData.unit_count, 10),
      property_type: onboardingData.property_type,
      primary_color: onboardingData.primary_color,
      accent_color: onboardingData.accent_color,
      admin_code: onboardingData.admin_code,
      website_url: onboardingData.website_url || null,
      subscription_tier: plan,
      status: "trial",
      onboarding_completed: true,
      trial_ends_at: trialEndsAt,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
    });

    if (communityError) {
      console.error("Community creation failed:", communityError);
      return NextResponse.redirect(
        `${origin}/onboarding?step=5&error=setup_failed`
      );
    }

    // 7. Clean up temporary onboarding session
    await supabase
      .from("onboarding_sessions")
      .delete()
      .eq("id", onboardingSessionId);

    // 8. Redirect to success
    const params = new URLSearchParams({
      payment: "completed",
      plan,
      community: onboardingData.name,
      admin_code: onboardingData.admin_code,
    });

    return NextResponse.redirect(
      `${origin}/onboarding?${params.toString()}`
    );
  } catch (err: unknown) {
    console.error("Stripe success handler error:", err);
    return NextResponse.redirect(
      `${origin}/onboarding?step=5&error=stripe_error`
    );
  }
}
