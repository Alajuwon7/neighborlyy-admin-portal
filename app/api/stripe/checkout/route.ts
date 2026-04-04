import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const PRICE_MAP: Record<string, Record<string, string | undefined>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
  },
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { plan, billingCycle, onboardingData } = body as {
      plan: string;
      billingCycle: "monthly" | "annual";
      onboardingData: Record<string, unknown>;
    };

    // Validate plan and cycle
    const priceId = PRICE_MAP[plan]?.[billingCycle];
    if (!priceId) {
      return Response.json(
        { error: `No price configured for ${plan}/${billingCycle}. Check Stripe price IDs in environment variables.` },
        { status: 400 }
      );
    }

    // Store onboarding data in temporary session (avoids Stripe metadata limits)
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .insert({
        user_id: user.id,
        data: onboardingData,
      })
      .select("id")
      .single();

    if (sessionError) {
      return Response.json(
        { error: "Failed to save onboarding data" },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;

    // Create Stripe checkout session
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
          onboarding_session_id: session.id,
          plan,
          billing_cycle: billingCycle,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        onboarding_session_id: session.id,
      },
      success_url: `${origin}/api/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding?step=5&cancelled=true`,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Checkout failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
