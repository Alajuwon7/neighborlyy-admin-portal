"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthToggleTabs } from "@/components/auth/AuthToggleTabs";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: pmData } = await supabase
          .from("property_managers")
          .select("id")
          .eq("user_id", user.id)
          .single();

        const pmId = pmData?.id as string | undefined;

        if (pmId) {
          const { data: communityData } = await supabase
            .from("communities")
            .select("onboarding_completed")
            .eq("property_manager_id", pmId)
            .single();

          if (communityData?.onboarding_completed) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
          return;
        }
      }

      router.push("/onboarding");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid credentials");
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
      <AuthToggleTabs />

      <div className="space-y-2 mb-8">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Welcome Back
        </h2>
        <p style={{ color: "var(--nly-text-secondary)" }} className="text-sm">
          Sign in to your property manager account
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
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

        <div className="space-y-2">
          <Label
            htmlFor="password"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Password
          </Label>
          <PasswordInput
            id="password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border accent-[var(--nly-brand)]"
              style={{ borderColor: "var(--nly-border)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Remember me
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm hover:underline"
            style={{ color: "var(--nly-accent)" }}
          >
            Forgot password?
          </Link>
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
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {/* OR divider */}
      <div className="flex items-center gap-3 my-6" style={{ color: "var(--nly-text-tertiary)" }}>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--nly-divider)" }} />
        <span className="text-xs font-medium">OR</span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--nly-divider)" }} />
      </div>

      {/* Social login buttons */}
      <div className="space-y-3">
        {/* TODO: Wire up Supabase OAuth for Apple */}
        <button
          type="button"
          disabled
          className="w-full h-11 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#fff", color: "#0B1520" }}
        >
          <svg width="16" height="16" viewBox="0 0 17 20" fill="currentColor">
            <path d="M13.34 10.05c-.03-2.8 2.3-4.15 2.4-4.22-1.3-1.9-3.34-2.16-4.07-2.19-1.73-.18-3.38 1.02-4.26 1.02-.88 0-2.24-1-3.68-.97-1.89.03-3.64 1.1-4.61 2.8-1.97 3.42-.5 8.48 1.42 11.25.94 1.36 2.06 2.88 3.53 2.83 1.42-.06 1.95-.91 3.66-.91s2.19.91 3.69.88c1.52-.03 2.49-1.38 3.42-2.75 1.08-1.58 1.52-3.1 1.55-3.18-.03-.01-2.97-1.14-3.05-4.56z" />
            <path d="M10.49 2.48C11.27 1.53 11.8.23 11.65-1c-1.1.04-2.45.74-3.24 1.66-.71.82-1.33 2.13-1.16 3.39 1.23.1 2.48-.63 3.24-1.57z" transform="translate(0 2)" />
          </svg>
          Sign in with Apple
        </button>

        {/* TODO: Wire up Supabase OAuth for Google */}
        <button
          type="button"
          disabled
          className="w-full h-11 rounded-xl font-medium text-sm flex items-center justify-center gap-3 border transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-primary)",
            backgroundColor: "transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </AuthLayout>
  );
}
