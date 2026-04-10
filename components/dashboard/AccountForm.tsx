"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile, changePassword } from "@/app/(dashboard)/dashboard/account/actions";
import { toast } from "sonner";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";

interface AccountFormProps {
  pm: {
    full_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
  };
}

export function AccountForm({ pm }: AccountFormProps) {
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleProfileSubmit(formData: FormData) {
    setProfileLoading(true);
    const result = await updateProfile(formData);
    setProfileLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Profile updated");
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPasswordLoading(true);
    const result = await changePassword(formData);
    setPasswordLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Password changed successfully");
    }
  }

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <div className="space-y-6">
      {/* Profile section */}
      <section
        className="rounded-2xl border p-5 space-y-4"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Profile Information
        </h2>
        <form action={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Full Name
              </Label>
              <Input
                name="full_name"
                defaultValue={pm.full_name}
                required
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Email
              </Label>
              <Input
                value={pm.email}
                disabled
                className="border opacity-60"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Phone
              </Label>
              <Input
                name="phone"
                defaultValue={pm.phone ?? ""}
                placeholder="(555) 123-4567"
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Company Name
              </Label>
              <Input
                name="company_name"
                defaultValue={pm.company_name ?? ""}
                placeholder="Your company"
                className="border"
                style={inputStyle}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={profileLoading}
            className="text-white"
            style={{ backgroundColor: "var(--nly-brand)" }}
          >
            {profileLoading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </section>

      {/* Password section */}
      <section
        className="rounded-2xl border p-5 space-y-4"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Change Password
        </h2>
        <form action={handlePasswordSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                New Password
              </Label>
              <Input
                name="new_password"
                type="password"
                required
                minLength={8}
                placeholder="Min 8 characters"
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Confirm Password
              </Label>
              <Input
                name="confirm_password"
                type="password"
                required
                minLength={8}
                placeholder="Confirm password"
                className="border"
                style={inputStyle}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={passwordLoading}
            className="text-white"
            style={{ backgroundColor: "var(--nly-brand)" }}
          >
            {passwordLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </section>

      {/* Danger zone */}
      <section
        className="rounded-2xl border p-5 space-y-4"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "rgba(239, 68, 68, 0.2)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--nly-error)" }}
        >
          Danger Zone
        </h2>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <DeleteAccountDialog />
      </section>
    </div>
  );
}
