import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

interface Props {
  communityName: string;
  adminCode: string;
  paymentCompleted?: boolean;
  plan?: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

export function SetupComplete({ communityName, adminCode, paymentCompleted, plan }: Props) {
  const router = useRouter();
  const planLabel = plan ? PLAN_LABELS[plan] || plan : null;

  return (
    <div className="text-center space-y-6 py-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-4xl"
        style={{ backgroundColor: "rgba(16, 185, 129, 0.12)" }}
      >
        🎉
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          <span style={{ color: "var(--nly-brand)" }}>Neighborlyy</span>{" "}
          <span style={{ color: "var(--nly-text-tertiary)" }}>@</span>{" "}
          {communityName} is live!
        </h2>
        <p style={{ color: "var(--nly-text-secondary)" }}>
          Your community portal is ready. Your 14-day free trial has started.
        </p>
      </div>

      {/* Payment confirmation banner */}
      {paymentCompleted && (
        <div
          className="flex items-center justify-center gap-2 rounded-xl p-3 border"
          style={{
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            borderColor: "rgba(16, 185, 129, 0.2)",
          }}
        >
          <CheckCircle size={16} style={{ color: "var(--nly-success, #10b981)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--nly-success, #10b981)" }}>
            Payment confirmed
            {planLabel && <> — {planLabel} subscription is active</>}
          </p>
        </div>
      )}

      <div
        className="rounded-xl p-4 border text-left space-y-3"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--nly-text-tertiary)" }}>
          NEXT STEPS
        </p>
        {[
          { icon: "📱", text: "Share the Neighborlyy app with your residents" },
          {
            icon: "🔑",
            text: `Your admin code is: ${adminCode} — share with your team, not residents`,
          },
          { icon: "📊", text: "Visit your dashboard to track resident engagement" },
          { icon: "⚙️", text: "Customize your community in Settings anytime" },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-lg">{item.icon}</span>
            <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
              {item.text}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push("/dashboard?onboarding=complete")}
        className="w-full h-12 rounded-xl font-bold text-base transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
      >
        Go to Dashboard →
      </button>
    </div>
  );
}
