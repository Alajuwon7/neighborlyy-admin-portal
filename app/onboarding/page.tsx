"use client";

import { useState } from "react";
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
  primary_color: "#E65C4F",
  accent_color: "#78A6C8",
  facilities: [],
  admin_code: "",
  subscription_tier: "professional",
};

const STEP_TITLES = [
  "Property Information",
  "Community Branding",
  "Facilities & Amenities",
  "Admin Access",
  "Choose a Plan",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const update = (partial: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const handleFinish = async () => {
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

      const { error } = await supabase.from("communities").insert({
        property_manager_id: pmId,
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
        subscription_tier: data.subscription_tier as SubscriptionTier,
        status: "trial",
        onboarding_completed: true,
        trial_ends_at: trialEndsAt.toISOString(),
      });

      if (error) throw error;

      setComplete(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
            <SetupComplete communityName={data.name} adminCode={data.admin_code} />
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
                onChange={update}
                onSubmit={handleFinish}
                onBack={() => setStep(4)}
                loading={loading}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
