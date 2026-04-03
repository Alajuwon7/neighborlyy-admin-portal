"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <CardHeader>
          <CardTitle
            className="text-2xl"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Welcome Back
          </CardTitle>
          <CardDescription style={{ color: "var(--nly-text-secondary)" }}>
            Sign in to your property manager account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
                style={inputStyle}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label
                  htmlFor="password"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm hover:underline"
                  style={{ color: "var(--nly-accent)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
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
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="hover:underline"
              style={{ color: "var(--nly-accent)" }}
            >
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
