import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Card
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <CardHeader className="text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{ backgroundColor: "var(--nly-success-bg)", color: "var(--nly-success)" }}
          >
            ✉
          </div>
          <CardTitle className="text-2xl" style={{ color: "var(--nly-text-primary)" }}>
            Check Your Email
          </CardTitle>
          <CardDescription style={{ color: "var(--nly-text-secondary)" }}>
            We&apos;ve sent a verification link to your email address. Click the
            link to activate your account and get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            Didn&apos;t receive an email? Check your spam folder or try signing
            up again.
          </p>
          <Link
            href="/login"
            className="touch-target flex items-center justify-center w-full rounded-lg border text-sm font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-primary)",
              backgroundColor: "transparent",
            }}
          >
            Back to Sign In
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
