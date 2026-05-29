"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, User, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
            account_type: "property_manager",
          },
          emailRedirectTo: `${window.location.origin}/api/auth/confirm?next=/dashboard`,
        },
      });

      if (authError) throw authError;

      // The property_managers row is created server-side by the
      // on_auth_user_created_create_pm trigger (migration 032), keyed off the
      // account_type marker above. No client-side insert — it would run
      // without a session when email confirmation is enabled and fail RLS.

      toast.success("Account created! Please check your email to verify.");
      router.push("/verify-email");
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
    <>
      <div className="space-y-2 mb-8">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Create Account
        </h2>
        <p style={{ color: "var(--nly-text-secondary)" }} className="text-sm">
          Start your 14-day free trial. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName" style={{ color: "var(--nly-text-primary)" }}>
            Full Name *
          </Label>
          <div className="relative">
            <User
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--nly-text-tertiary)" }}
            />
            <Input
              id="fullName"
              type="text"
              required
              placeholder="John Smith"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className="pl-10"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" style={{ color: "var(--nly-text-primary)" }}>
            Email *
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
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="pl-10"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" style={{ color: "var(--nly-text-secondary)" }}>
            Phone (optional)
          </Label>
          <div className="relative">
            <Phone
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--nly-text-tertiary)" }}
            />
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="pl-10"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" style={{ color: "var(--nly-text-primary)" }}>
            Password *
          </Label>
          <PasswordInput
            id="password"
            required
            placeholder="Create a password"
            value={formData.password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, password: e.target.value })
            }
            style={inputStyle}
          />
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Minimum 8 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="confirmPassword"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Confirm Password *
          </Label>
          <PasswordInput
            id="confirmPassword"
            required
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          className="w-full h-12 rounded-xl font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          style={{
            background: "var(--nly-brand-gradient)",
            color: "var(--nly-brand-text)",
          }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="text-center text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          By creating an account, you agree to our{" "}
          <a href="/terms" className="underline hover:opacity-80" style={{ color: "var(--nly-accent)" }}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:opacity-80" style={{ color: "var(--nly-accent)" }}>
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </>
  );
}
