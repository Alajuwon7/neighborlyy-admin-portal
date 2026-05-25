"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile, changePassword } from "@/app/(dashboard)/dashboard/account/actions";
import { toast } from "sonner";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";
import { OffboardingStatusCard } from "@/components/dashboard/OffboardingStatusCard";
import { ArrowRightLeft } from "lucide-react";
import type { DeletionRequestRow } from "@/lib/offboarding/types";

interface AccountFormProps {
  pm: {
    full_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
  };
  corpContactEmail: string | null;
  activeDeletionRequest: DeletionRequestRow | null;
}

export function AccountForm({
  pm,
  corpContactEmail,
  activeDeletionRequest,
}: AccountFormProps) {
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
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
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
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {passwordLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </section>

      {/* Danger zone — Account actions */}
      <section
        className="rounded-2xl border p-5 space-y-4"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: activeDeletionRequest
            ? "var(--nly-border)"
            : "rgba(239, 68, 68, 0.2)",
        }}
      >
        <div>
          <h2
            className="text-sm font-semibold"
            style={{
              color: activeDeletionRequest
                ? "var(--nly-text-primary)"
                : "var(--nly-error)",
            }}
          >
            Account actions
          </h2>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            These actions require your corporation&apos;s approval. Nothing
            changes until everyone confirms.
          </p>
        </div>

        {activeDeletionRequest ? (
          <OffboardingStatusCard initialRequest={activeDeletionRequest} />
        ) : (
          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium opacity-60 cursor-not-allowed"
              style={{
                color: "var(--nly-text-secondary)",
                border: "1px solid var(--nly-border)",
                backgroundColor: "transparent",
              }}
            >
              <ArrowRightLeft size={15} />
              Request Account Transfer
            </button>
            <DeleteAccountDialog
              pmEmail={pm.email}
              corpContactEmail={corpContactEmail}
            />
          </div>
        )}
      </section>
    </div>
  );
}
