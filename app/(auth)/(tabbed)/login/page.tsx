"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  // Surface confirm-link failures (expired/invalid signup or recovery links the
  // /api/auth/confirm route sends here) instead of leaving the user guessing.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err === "link_invalid" || err === "auth") {
      toast.error(
        "That link was invalid or expired — please sign in, or request a new one."
      );
    }
  }, []);

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
    <>
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
            color: "var(--nly-brand-text)",
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </>
  );
}
