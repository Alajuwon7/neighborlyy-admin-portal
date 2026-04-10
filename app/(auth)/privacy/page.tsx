import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Neighborlyy",
};

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              Last updated: April 2026
            </p>
          </div>

          <div className="space-y-5 text-sm leading-relaxed" style={{ color: "var(--nly-text-secondary)" }}>
            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                1. Information We Collect
              </h2>
              <p>We collect information you provide directly, including:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Account information (name, email, phone number)</li>
                <li>Property and community details</li>
                <li>Resident information managed through the platform</li>
                <li>Payment information (processed securely via Stripe)</li>
                <li>Communications and content shared within communities</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                2. How We Use Your Information
              </h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>To provide and maintain the Service</li>
                <li>To manage your account and subscriptions</li>
                <li>To facilitate community management features</li>
                <li>To send important service-related communications</li>
                <li>To improve and develop new features</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                3. Data Sharing
              </h2>
              <p>
                We do not sell your personal information. We may share data with third-party service
                providers (such as Stripe for payments and Supabase for data storage) that help us operate
                the Service, subject to their own privacy policies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                4. Data Security
              </h2>
              <p>
                We implement industry-standard security measures including encryption, access controls,
                and row-level security policies to protect your data. However, no method of electronic
                transmission or storage is 100% secure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                5. Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Access and review your personal data</li>
                <li>Update or correct your information</li>
                <li>Delete your account and associated data</li>
                <li>Export your data upon request</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                6. Data Retention
              </h2>
              <p>
                We retain your data for as long as your account is active. Upon account deletion, personal
                data is removed promptly. Certain data may be retained as required by law, for dispute
                resolution, or to enforce our agreements.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                7. Cookies and Analytics
              </h2>
              <p>
                We use essential cookies for authentication and session management. We may use analytics
                tools to understand how the Service is used. You can manage cookie preferences through
                your browser settings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                8. Children&apos;s Privacy
              </h2>
              <p>
                The Service is not intended for children under 13. We do not knowingly collect personal
                information from children under 13.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                9. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of material changes
                via email or through the Service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                10. Contact
              </h2>
              <p>
                For privacy-related questions or requests, contact us at{" "}
                <span style={{ color: "var(--nly-accent)" }}>privacy@neighborlyy.com</span>.
              </p>
            </section>
          </div>

          <div
            className="pt-4 border-t flex items-center justify-between text-xs"
            style={{ borderColor: "var(--nly-border)", color: "var(--nly-text-tertiary)" }}
          >
            <Link href="/terms" className="hover:underline" style={{ color: "var(--nly-accent)" }}>
              Terms of Service
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
