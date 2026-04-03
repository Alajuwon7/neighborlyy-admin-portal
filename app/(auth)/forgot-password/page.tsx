"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// asChild not available in base-ui Button — using Link directly for nav buttons
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/account`,
      });

      if (error) throw error;

      setSent(true);
      toast.success("Password reset email sent!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-2xl" style={{ color: "var(--nly-text-primary)" }}>
            Reset Password
          </CardTitle>
          <CardDescription style={{ color: "var(--nly-text-secondary)" }}>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
                Check your inbox for a password reset link. It may take a minute
                to arrive.
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
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: "var(--nly-text-primary)" }}>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="john@property.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    backgroundColor: "var(--nly-input-bg)",
                    borderColor: "var(--nly-input-border)",
                    color: "var(--nly-text-primary)",
                  }}
                />
              </div>

              <Button
                type="submit"
                className="w-full touch-target font-semibold"
                disabled={loading}
                style={{
                  backgroundColor: "var(--nly-brand)",
                  color: "#fff",
                }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>

              <p className="text-center text-sm" style={{ color: "var(--nly-text-secondary)" }}>
                <Link
                  href="/login"
                  className="hover:underline"
                  style={{ color: "var(--nly-accent)" }}
                >
                  Back to Sign In
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
