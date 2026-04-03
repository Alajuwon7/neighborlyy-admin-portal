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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("property_managers")
          .insert({
            user_id: authData.user.id,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
          });

        if (profileError) throw profileError;
      }

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
            Create Account
          </CardTitle>
          <CardDescription style={{ color: "var(--nly-text-secondary)" }}>
            Start your 14-day free trial. No credit card required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" style={{ color: "var(--nly-text-primary)" }}>
                Full Name *
              </Label>
              <Input
                id="fullName"
                type="text"
                required
                placeholder="John Smith"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: "var(--nly-text-primary)" }}>
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="john@property.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" style={{ color: "var(--nly-text-secondary)" }}>
                Phone (optional)
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: "var(--nly-text-primary)" }}>
                Password *
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
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
              <Input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
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
              {loading ? "Creating account…" : "Create Account & Continue"}
            </Button>
          </form>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="hover:underline"
              style={{ color: "var(--nly-accent)" }}
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
