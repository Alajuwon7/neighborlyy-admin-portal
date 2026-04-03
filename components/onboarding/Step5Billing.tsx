import { Check } from "lucide-react";

export type SubscriptionTier = "starter" | "professional" | "enterprise";

export interface Step5Data {
  subscription_tier: SubscriptionTier;
}

interface Props {
  data: Step5Data;
  onChange: (data: Partial<Step5Data>) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}

const PLANS = [
  {
    id: "starter" as SubscriptionTier,
    name: "Starter",
    price: "$99",
    period: "/mo",
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
    price: "$199",
    period: "/mo",
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
    price: "$399",
    period: "/mo",
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

export function Step5Billing({ data, onChange, onSubmit, onBack, loading }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        Choose a plan — your 14-day free trial starts now. No credit card required.
        You can upgrade or cancel anytime.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {PLANS.map((plan) => {
          const selected = data.subscription_tier === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange({ subscription_tier: plan.id })}
              className="text-left rounded-xl border p-4 transition-all"
              style={{
                backgroundColor: selected
                  ? "rgba(230, 92, 79, 0.06)"
                  : "var(--nly-surface)",
                borderColor: selected ? "var(--nly-brand)" : "var(--nly-border)",
                outline: selected ? `2px solid rgba(230, 92, 79, 0.2)` : "none",
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
                          backgroundColor: "rgba(230, 92, 79, 0.15)",
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
                    {plan.price}
                  </span>
                  <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                    {plan.period}
                  </span>
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
        🔒 14-day free trial · Cancel anytime · No credit card needed to start
      </p>

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
          disabled={loading}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex-2 flex-1 h-11 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
        >
          {loading ? "Setting up…" : "Start Free Trial →"}
        </button>
      </div>
    </div>
  );
}
