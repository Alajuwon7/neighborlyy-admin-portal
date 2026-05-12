import { useState } from "react";
import { toast } from "sonner";
import { Check, AlertTriangle } from "lucide-react";

export type SubscriptionTier = "starter" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export interface Step5Data {
  subscription_tier: SubscriptionTier;
  billing_cycle: BillingCycle;
  skipPayment?: boolean;
}

interface Props {
  data: Step5Data;
  onboardingData: Record<string, unknown>;
  onChange: (data: Partial<Step5Data>) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  onSkipPayment?: () => void;
}

const isStripeConfigured = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const PLANS = [
  {
    id: "starter" as SubscriptionTier,
    name: "Starter",
    monthlyPrice: 99,
    annualPrice: 79,
    description: "Perfect for smaller communities getting started.",
    units: "Up to 100 units",
    features: [
      "Community feed & announcements",
      "Event management",
      "Resident directory",
      "Help requests",
      "Email support",
    ],
    highlight: false,
  },
  {
    id: "professional" as SubscriptionTier,
    name: "Professional",
    monthlyPrice: 199,
    annualPrice: 159,
    description: "Everything you need for a thriving community.",
    units: "Up to 300 units",
    features: [
      "Everything in Starter",
      "Facility reservations",
      "Marketplace",
      "Priority alerts system",
      "Analytics dashboard",
      "Chat support",
    ],
    highlight: true,
  },
  {
    id: "enterprise" as SubscriptionTier,
    name: "Enterprise",
    monthlyPrice: 399,
    annualPrice: 319,
    description: "For large communities and management companies.",
    units: "Unlimited units",
    features: [
      "Everything in Professional",
      "White-label branding",
      "Multiple communities",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    highlight: false,
  },
];

export function Step5Billing({
  data,
  onboardingData,
  onChange,
  onSubmit,
  onBack,
  loading,
  onSkipPayment,
}: Props) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const isLoading = loading || checkoutLoading;

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: data.subscription_tier,
          billingCycle: data.billing_cycle,
          onboardingData,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to create checkout session");
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Checkout failed. Please try again."
      );
      setCheckoutLoading(false);
    }
  };

  const selectedPlan = PLANS.find((p) => p.id === data.subscription_tier);
  const price =
    data.billing_cycle === "annual"
      ? selectedPlan?.annualPrice
      : selectedPlan?.monthlyPrice;

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        Choose a plan to get started. All plans include a 14-day free trial.
      </p>

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--nly-input-bg)" }}>
        <button
          type="button"
          onClick={() => onChange({ billing_cycle: "monthly" })}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: data.billing_cycle === "monthly" ? "var(--nly-surface)" : "transparent",
            color: data.billing_cycle === "monthly" ? "var(--nly-text-primary)" : "var(--nly-text-tertiary)",
            boxShadow: data.billing_cycle === "monthly" ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
          }}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange({ billing_cycle: "annual" })}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: data.billing_cycle === "annual" ? "var(--nly-surface)" : "transparent",
            color: data.billing_cycle === "annual" ? "var(--nly-text-primary)" : "var(--nly-text-tertiary)",
            boxShadow: data.billing_cycle === "annual" ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
          }}
        >
          Annual
          <span
            className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "var(--nly-success, #10b981)",
            }}
          >
            Save 20%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-3">
        {PLANS.map((plan) => {
          const selected = data.subscription_tier === plan.id;
          const displayPrice =
            data.billing_cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange({ subscription_tier: plan.id })}
              className="text-left rounded-xl border p-4 transition-all"
              style={{
                backgroundColor: selected
                  ? "rgba(47, 196, 211, 0.06)"
                  : "var(--nly-surface)",
                borderColor: selected ? "var(--nly-brand)" : "var(--nly-border)",
                outline: selected ? "2px solid rgba(47, 196, 211, 0.2)" : "none",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="font-bold text-base"
                      style={{ color: "var(--nly-text-primary)" }}
                    >
                      {plan.name}
                    </span>
                    {plan.highlight && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: "rgba(47, 196, 211, 0.15)",
                          color: "var(--nly-brand)",
                        }}
                      >
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--nly-text-tertiary)" }}>
                    {plan.units}
                  </p>
                  <ul className="space-y-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-xs"
                        style={{ color: "var(--nly-text-secondary)" }}
                      >
                        <Check
                          size={12}
                          style={{ color: "var(--nly-success)", flexShrink: 0 }}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
                    ${displayPrice}
                  </span>
                  <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                    /mo
                  </span>
                  {data.billing_cycle === "annual" && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                      <span style={{ textDecoration: "line-through" }}>${plan.monthlyPrice}</span>
                    </p>
                  )}
                  <div className="mt-2">
                    <div
                      className="w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center"
                      style={{
                        borderColor: selected ? "var(--nly-brand)" : "var(--nly-border)",
                        backgroundColor: selected ? "var(--nly-brand)" : "transparent",
                      }}
                    >
                      {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        {isStripeConfigured
          ? `🔒 14-day free trial · Cancel anytime · You'll be charged $${price}/mo after trial`
          : "🔒 14-day free trial · Cancel anytime · No credit card needed to start"}
      </p>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-11 rounded-lg font-semibold text-sm border transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-secondary)",
            backgroundColor: "transparent",
          }}
          disabled={isLoading}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={isStripeConfigured ? handleCheckout : onSubmit}
          disabled={isLoading}
          className="flex-2 flex-1 h-11 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
        >
          {checkoutLoading
            ? "Redirecting to Stripe…"
            : loading
              ? "Setting up…"
              : isStripeConfigured
                ? "Start Free Trial →"
                : "Start Free Trial →"}
        </button>
      </div>

      {/* Skip payment option (testing only) */}
      {!isStripeConfigured && (
        <>
          <div className="flex items-center gap-3" style={{ color: "var(--nly-text-tertiary)" }}>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--nly-border)" }} />
            <span className="text-xs font-medium">OR</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--nly-border)" }} />
          </div>

          <div className="text-center space-y-2">
            <button
              type="button"
              data-testid="skip-payment-button"
              onClick={onSkipPayment}
              disabled={isLoading}
              className="w-full h-11 rounded-lg font-semibold text-sm border transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                borderColor: "var(--nly-border)",
                color: "var(--nly-text-secondary)",
                backgroundColor: "transparent",
              }}
            >
              {loading ? "Setting up…" : "Skip Payment for Now (Testing Only)"}
            </button>
            <p className="flex items-center justify-center gap-1 text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              <AlertTriangle size={12} />
              For testing only — creates a 14-day trial with Professional tier
            </p>
          </div>
        </>
      )}
    </div>
  );
}
