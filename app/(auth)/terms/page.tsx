import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Neighborlyy",
};

export default function TermsPage() {
  return (
    <div
      className="min-h-screen flex items-start justify-center p-4 pt-8 sm:pt-16"
      style={{ backgroundColor: "var(--nly-background)" }}
    >
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-xl font-bold"
            style={{ color: "var(--nly-brand)" }}
          >
            NEIGHBORLYY
          </Link>
        </div>

        <div
          className="rounded-2xl border p-6 sm:p-8 space-y-6"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: "var(--nly-text-primary)" }}
            >
              Terms of Service
            </h1>
            <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              Last updated: April 2026
            </p>
          </div>

          <div className="space-y-5 text-sm leading-relaxed" style={{ color: "var(--nly-text-secondary)" }}>
            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using the Neighborlyy Property Manager Portal and associated mobile application
                (collectively, the &quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not
                agree to these terms, do not use the Service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                2. Description of Service
              </h2>
              <p>
                Neighborlyy provides a community management platform for property managers and residents of
                residential communities. The Service includes tools for resident management, event coordination,
                facility reservations, community communications, and related features.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                3. User Accounts
              </h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all
                activities that occur under your account. You must provide accurate, current, and complete
                information during registration.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                4. Subscription and Billing
              </h2>
              <p>
                Certain features of the Service require a paid subscription. Billing terms, including pricing,
                trial periods, and renewal policies, are presented during the subscription process. You may
                cancel your subscription at any time through your account settings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                5. Account Deletion
              </h2>
              <p>
                You may delete your account at any time through your account settings. Upon deletion,
                your personal data will be removed and your communities will be suspended. Resident data
                may be retained as required by law or legitimate business purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                6. Acceptable Use
              </h2>
              <p>
                You agree not to use the Service for any unlawful purpose or in any way that could damage,
                disable, or impair the Service. You are responsible for all content you create or share
                through the platform.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                7. Limitation of Liability
              </h2>
              <p>
                To the fullest extent permitted by law, Neighborlyy shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages arising from your use of the Service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                8. Changes to Terms
              </h2>
              <p>
                We reserve the right to modify these terms at any time. We will notify users of material
                changes via email or through the Service. Continued use after changes constitutes acceptance
                of the updated terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                9. Contact
              </h2>
              <p>
                For questions about these Terms, contact us at{" "}
                <span style={{ color: "var(--nly-accent)" }}>support@neighborlyy.com</span>.
              </p>
            </section>
          </div>

          <div
            className="pt-4 border-t flex items-center justify-between text-xs"
            style={{ borderColor: "var(--nly-border)", color: "var(--nly-text-tertiary)" }}
          >
            <Link href="/privacy" className="hover:underline" style={{ color: "var(--nly-accent)" }}>
              Privacy Policy
            </Link>
            <Link href="/login" className="hover:underline" style={{ color: "var(--nly-accent)" }}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
