"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { StepOrganization, type StepOrgData } from "@/components/onboarding/StepOrganization";
import { Step1PropertyInfo, type Step1Data } from "@/components/onboarding/Step1PropertyInfo";
import { Step2Branding, type Step2Data } from "@/components/onboarding/Step2Branding";
import { Step3Facilities, type Step3Data } from "@/components/onboarding/Step3Facilities";
import { Step4AdminAccess, type Step4Data } from "@/components/onboarding/Step4AdminAccess";
import { Step5Billing, type Step5Data, type SubscriptionTier } from "@/components/onboarding/Step5Billing";
import { SetupComplete } from "@/components/onboarding/SetupComplete";

interface OnboardingData extends StepOrgData, Step1Data, Step2Data, Step3Data, Step4Data, Step5Data {}

const defaultData: OnboardingData = {
  org_type: "individual",
  org_name: "",
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
  "Organization Type",
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
      if (stepNum >= 1 && stepNum <= 6) {
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

      let { data: pmData } = await supabase
        .from("property_managers")
        .select("id, organization_id, full_name")
        .eq("user_id", user.id)
        .single();

      // Create PM record if it doesn't exist (e.g., signup insert failed due to RLS)
      if (!pmData) {
        const meta = user.user_metadata ?? {};
        const { data: newPm, error: pmError } = await supabase
          .from("property_managers")
          .insert({
            user_id: user.id,
            full_name: meta.full_name || user.email?.split("@")[0] || "Manager",
            email: user.email!,
            phone: meta.phone || null,
          })
          .select("id, organization_id, full_name")
          .single();

        if (pmError) throw new Error(`Could not create profile: ${pmError.message}`);
        pmData = newPm;
      }

      const pm = pmData as { id: string; organization_id: string | null; full_name: string };
      if (!pm) throw new Error("Property manager profile not found");

      // Create or reuse organization. We go through a SECURITY DEFINER RPC
      // because PostgREST's INSERT...RETURNING evaluates the SELECT policy
      // on the new row, which fails before the PM is linked to the org.
      let orgId = pm.organization_id;
      if (!orgId) {
        const orgName =
          data.org_type === "company" && data.org_name.trim()
            ? data.org_name.trim()
            : pm.full_name;

        const { data: newOrgId, error: orgError } = await supabase.rpc(
          "onboarding_create_org_and_link",
          {
            p_org_name: orgName,
            p_org_type: data.org_type,
            p_company_name: data.org_type === "company" ? orgName : null,
          }
        );

        if (orgError) throw new Error(`Org creation failed: ${orgError.message || orgError.code || JSON.stringify(orgError)}`);
        orgId = newOrgId as string;
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const fullName = `Miyora @ ${data.name}`;

      const tier = skipPayment ? "professional" : data.subscription_tier;

      const { error } = await supabase.from("communities").insert({
        property_manager_id: pm.id,
        organization_id: orgId,
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

      if (error) throw new Error(`Community creation failed: ${error.message || error.code || JSON.stringify(error)}`);

      setComplete(true);
    } catch (err: unknown) {
      console.error("Onboarding error:", err);
      let message = "Setup failed. Please try again.";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object" && err !== null) {
        // Supabase errors are plain objects with a message property
        const obj = err as Record<string, unknown>;
        message = String(obj.message || obj.details || obj.hint || JSON.stringify(err));
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Collect all onboarding data to pass through Stripe checkout
  const onboardingPayload = {
    org_type: data.org_type,
    org_name: data.org_name,
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
      className="min-h-screen flex items-start justify-center p-4 pt-8 sm:pt-16 nly-auth-bg"
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--nly-brand)" }}>
            MIYORA
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

            {/* Step title + time estimate */}
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--nly-text-tertiary)" }}>
                  STEP {step} OF 6
                </p>
                <h2 className="text-xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
                  {STEP_TITLES[step - 1]}
                </h2>
              </div>
              <p className="text-xs" style={{ color: "var(--nly-text-placeholder)" }}>
                ~{Math.max(1, 7 - step)} min left
              </p>
            </div>

            {/* Step content with animated transitions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {step === 1 && (
                  <StepOrganization
                    data={data}
                    onChange={update}
                    onNext={() => setStep(2)}
                  />
                )}
                {step === 2 && (
                  <Step1PropertyInfo
                    data={data}
                    onChange={update}
                    onNext={() => setStep(3)}
                    onBack={() => setStep(1)}
                  />
                )}
                {step === 3 && (
                  <Step2Branding
                    data={data}
                    communityName={data.name}
                    websiteUrl={data.website_url}
                    onChange={update}
                    onNext={() => setStep(4)}
                    onBack={() => setStep(2)}
                  />
                )}
                {step === 4 && (
                  <Step3Facilities
                    data={data}
                    propertyType={data.property_type}
                    onChange={update}
                    onNext={() => setStep(5)}
                    onBack={() => setStep(3)}
                  />
                )}
                {step === 5 && (
                  <Step4AdminAccess
                    data={data}
                    onChange={update}
                    onNext={() => setStep(6)}
                    onBack={() => setStep(4)}
                  />
                )}
                {step === 6 && (
                  <Step5Billing
                    data={data}
                    onboardingData={onboardingPayload}
                    onChange={update}
                    onSubmit={() => handleFinish(false)}
                    onBack={() => setStep(5)}
                    loading={loading}
                    onSkipPayment={() => handleFinish(true)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
