import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <div className="text-center space-y-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
          style={{ backgroundColor: "var(--nly-success-bg)", color: "var(--nly-success)" }}
        >
          ✉
        </div>

        <div className="space-y-2">
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Check Your Email
          </h2>
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            We&apos;ve sent a verification link to your email address. Click the
            link to activate your account and get started.
          </p>
        </div>

        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          Didn&apos;t receive an email? Check your spam folder or try signing
          up again.
        </p>

        <Link
          href="/login"
          className="flex items-center justify-center w-full h-11 rounded-xl border text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-primary)",
            backgroundColor: "transparent",
          }}
        >
          Back to Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}
