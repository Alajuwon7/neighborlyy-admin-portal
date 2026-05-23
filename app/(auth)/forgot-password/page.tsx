"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [linkError, setLinkError] = useState(false);

  // The confirm route sends invalid/expired/used recovery links back here with
  // ?error=link_invalid instead of silently bouncing to the sign-in page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "link_invalid") {
      setLinkError(true);
      toast.error(
        "That reset link was invalid or expired — please request a new one."
      );
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/confirm?next=/dashboard/account`,
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

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <AuthLayout>
      <div className="space-y-2 mb-8">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Reset Password
        </h2>
        <p style={{ color: "var(--nly-text-secondary)" }} className="text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {linkError && !sent && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--nly-error-bg)",
            color: "var(--nly-error)",
          }}
        >
          That reset link was invalid or expired. Enter your email below to get a
          fresh one.
        </div>
      )}

      {sent ? (
        <div className="space-y-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
            style={{ backgroundColor: "var(--nly-success-bg)" }}
          >
            ✉
          </div>
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            Check your inbox for a password reset link. It may take a minute
            to arrive.
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
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" style={{ color: "var(--nly-text-primary)" }}>
              Email
            </Label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--nly-text-tertiary)" }}
              />
              <Input
                id="email"
                type="email"
                required
                placeholder="john@property.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={loading}
            style={{
              background: "var(--nly-brand-gradient)",
              color: "#fff",
            }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

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
    </AuthLayout>
  );
}
