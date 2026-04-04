"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { Step1PropertyInfo, type Step1Data } from "@/components/onboarding/Step1PropertyInfo";
import { Step2Branding, type Step2Data } from "@/components/onboarding/Step2Branding";
import { Step3Facilities, type Step3Data } from "@/components/onboarding/Step3Facilities";
import { Step4AdminAccess, type Step4Data } from "@/components/onboarding/Step4AdminAccess";
import { Step5Billing, type Step5Data, type SubscriptionTier } from "@/components/onboarding/Step5Billing";
import { SetupComplete } from "@/components/onboarding/SetupComplete";

interface OnboardingData extends Step1Data, Step2Data, Step3Data, Step4Data, Step5Data {}

const defaultData: OnboardingData = {
  name: "",
  community_code: "",
  street_address: "",
  city: "",
  state: "",
  zip_code: "",
  unit_count: "",
  property_type: "apartment",
  website_url: "",
  primary_color: "#E65C4F",
  accent_color: "#78A6C8",
  facilities: [],
  admin_code: "",
  subscription_tier: "professional",
  billing_cycle: "monthly",
};

const STEP_TITLES = [
  "Property Information",
  "Community Branding",
  "Facilities & Amenities",
  "Admin Access",
  "Choose a Plan",
];

const ERROR_MESSAGES: Record<string, string> = {
  no_session: "Checkout session not found. Please try again.",
  payment_incomplete: "Payment was not completed. Please try again.",
  missing_data: "Onboarding data was lost. Please try again.",
  session_expired: "Your session expired. Please fill out the form again.",
  no_profile: "Property manager profile not found. Please contact support.",
  setup_failed: "Community setup failed. Please try again.",
  stripe_error: "A payment error occurred. Please try again.",
};

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<string | null>(null);

  // Handle return from Stripe checkout or error redirects
  useEffect(() => {
    const payment = searchParams.get("payment");
    const error = searchParams.get("error");
    const cancelled = searchParams.get("cancelled");
    const stepParam = searchParams.get("step");

    if (payment === "completed") {
      // Returning from successful Stripe checkout
      setData((prev) => ({
        ...prev,
        name: searchParams.get("community") || prev.name,
        admin_code: searchParams.get("admin_code") || prev.admin_code,
      }));
      setPaymentPlan(searchParams.get("plan"));
      setComplete(true);
      return;
    }

    if (error) {
      const message = ERROR_MESSAGES[error] || "Something went wrong. Please try again.";
      toast.error(message);
    }

    if (cancelled) {
      toast("Checkout cancelled. You can try again when you're ready.");
    }

    if (stepParam) {
      const stepNum = parseInt(stepParam, 10);
      if (stepNum >= 1 && stepNum <= 5) {
        setStep(stepNum);
      }
    }
  }, [searchParams]);

  const update = (partial: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const handleFinish = async (skipPayment = false) => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: pmData } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const pmId = (pmData as { id: string } | null)?.id;
      if (!pmId) throw new Error("Property manager profile not found");

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const fullName = `Neighborlyy @ ${data.name}`;

      const tier = skipPayment ? "professional" : data.subscription_tier;

      const { error } = await supabase.from("communities").insert({
        property_manager_id: pmId,
        building_name: data.name,
        name: fullName,
        community_code: data.community_code,
        street_address: data.street_address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        unit_count: parseInt(data.unit_count, 10),
        property_type: data.property_type,
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        admin_code: data.admin_code,
        website_url: data.website_url || null,
        subscription_tier: tier as SubscriptionTier,
        status: "trial",
        onboarding_completed: true,
        trial_ends_at: trialEndsAt.toISOString(),
      });

      if (error) throw error;

      setComplete(true);
    } catch (err: unknown) {
      console.error("Onboarding error:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Setup failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Collect all onboarding data to pass through Stripe checkout
  const onboardingPayload = {
    name: data.name,
    community_code: data.community_code,
    street_address: data.street_address,
    city: data.city,
    state: data.state,
    zip_code: data.zip_code,
    unit_count: data.unit_count,
    property_type: data.property_type,
    primary_color: data.primary_color,
    accent_color: data.accent_color,
    admin_code: data.admin_code,
    website_url: data.website_url,
    subscription_tier: data.subscription_tier,
  };

  return (
    <div
      className="min-h-screen flex items-start justify-center p-4 pt-8 sm:pt-16"
      style={{ backgroundColor: "var(--nly-background)" }}
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--nly-brand)" }}>
            NEIGHBORLYY
          </h1>
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            Property Manager Portal
          </p>
        </div>

        {complete ? (
          <div
            className="rounded-2xl border p-6 sm:p-8"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
            }}
          >
            <SetupComplete
              communityName={data.name}
              adminCode={data.admin_code}
              paymentCompleted={!!paymentPlan}
              plan={paymentPlan}
            />
          </div>
        ) : (
          <div
            className="rounded-2xl border p-6 sm:p-8"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
            }}
          >
            {/* Progress */}
            <div className="mb-8">
              <StepProgress currentStep={step} />
            </div>

            {/* Step title */}
            <div className="mb-6">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--nly-text-tertiary)" }}>
                STEP {step} OF 5
              </p>
              <h2 className="text-xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
                {STEP_TITLES[step - 1]}
              </h2>
            </div>

            {/* Step content */}
            {step === 1 && (
              <Step1PropertyInfo
                data={data}
                onChange={update}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <Step2Branding
                data={data}
                communityName={data.name}
                onChange={update}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <Step3Facilities
                data={data}
                onChange={update}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <Step4AdminAccess
                data={data}
                onChange={update}
                onNext={() => setStep(5)}
                onBack={() => setStep(3)}
              />
            )}
            {step === 5 && (
              <Step5Billing
                data={data}
                onboardingData={onboardingPayload}
                onChange={update}
                onSubmit={() => handleFinish(false)}
                onBack={() => setStep(4)}
                loading={loading}
                onSkipPayment={() => handleFinish(true)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
