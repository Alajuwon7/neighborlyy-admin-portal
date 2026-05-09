"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  setCorporationContactEmail,
  submitDeletionRequest,
} from "@/app/(dashboard)/dashboard/account/actions";
import type { DeletionReason } from "@/lib/offboarding/types";

interface DeleteAccountDialogProps {
  pmEmail: string;
  corpContactEmail: string | null;
}

const REASONS: { value: DeletionReason; label: string }[] = [
  { value: "moving_to_other_platform", label: "Moving to a different platform" },
  { value: "property_sold", label: "Property sold / management transferred" },
  { value: "no_longer_managing", label: "No longer managing this property" },
  { value: "other", label: "Other" },
];

export function DeleteAccountDialog({
  pmEmail,
  corpContactEmail,
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [needsCorpEmail, setNeedsCorpEmail] = useState(!corpContactEmail);
  const [corpEmailDraft, setCorpEmailDraft] = useState("");
  const [savingCorpEmail, setSavingCorpEmail] = useState(false);

  const [reason, setReason] = useState<DeletionReason | null>(null);
  const [reasonOther, setReasonOther] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    setOpen(false);
    setReason(null);
    setReasonOther("");
    setConfirmEmail("");
    setCorpEmailDraft("");
    setNeedsCorpEmail(!corpContactEmail);
  }

  async function handleSaveCorpEmail() {
    if (!corpEmailDraft.trim()) {
      toast.error("Please enter your corporation's contact email");
      return;
    }
    setSavingCorpEmail(true);
    const result = await setCorporationContactEmail(corpEmailDraft);
    setSavingCorpEmail(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Saved corporation contact email");
    setNeedsCorpEmail(false);
    router.refresh();
  }

  async function handleSubmit() {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    if (reason === "other" && !reasonOther.trim()) {
      toast.error("Please describe your reason");
      return;
    }
    if (
      confirmEmail.trim().toLowerCase() !== pmEmail.toLowerCase()
    ) {
      toast.error("The email you typed doesn't match your account email");
      return;
    }
    setSubmitting(true);
    const result = await submitDeletionRequest({
      reason,
      reasonOther: reason === "other" ? reasonOther.trim() : null,
      confirmEmail,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.alreadyExisted
        ? "You already have a deletion request in progress."
        : "Deletion request submitted. Your corporation will receive an email shortly.",
    );
    closeDialog();
    router.refresh();
  }

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          color: "var(--nly-error)",
          border: "1px solid var(--nly-error)",
          backgroundColor: "transparent",
        }}
      >
        <Trash2 size={15} />
        Delete My Account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => !submitting && setOpen(false)}
          />

          <div
            className="relative w-full max-w-md rounded-2xl border p-6 space-y-5"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (!submitting) closeDialog();
              }}
              className="absolute top-4 right-4 p-1 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--nly-error-bg)" }}
              >
                <AlertTriangle size={20} style={{ color: "var(--nly-error)" }} />
              </div>
              <div>
                <h3
                  className="text-base font-bold"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  Delete your Neighborlyy account
                </h3>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  Your corporation must approve before anything changes.
                </p>
              </div>
            </div>

            {needsCorpEmail ? (
              <div
                className="rounded-xl p-4 space-y-3 text-xs"
                style={{
                  backgroundColor: "var(--nly-info-bg, rgba(47,196,211,0.08))",
                  border: "1px solid var(--nly-border)",
                }}
              >
                <div className="flex items-start gap-2">
                  <Building2
                    size={14}
                    style={{ color: "var(--nly-brand)", marginTop: 2 }}
                  />
                  <p style={{ color: "var(--nly-text-secondary)" }}>
                    First, tell us your corporation&apos;s contact email — this
                    is who must sign off on closing your account.
                  </p>
                </div>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="approvals@yourcompany.com"
                  className="w-full h-9 rounded-lg border px-3 text-sm"
                  style={inputStyle}
                  value={corpEmailDraft}
                  onChange={(e) => setCorpEmailDraft(e.target.value)}
                  autoComplete="email"
                />
                <button
                  type="button"
                  disabled={savingCorpEmail}
                  onClick={handleSaveCorpEmail}
                  className="w-full h-9 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--nly-brand)" }}
                >
                  {savingCorpEmail ? "Saving..." : "Save and continue"}
                </button>
              </div>
            ) : (
              <>
                <div
                  className="rounded-xl p-4 space-y-2 text-xs"
                  style={{
                    backgroundColor: "var(--nly-error-bg)",
                    color: "var(--nly-text-secondary)",
                  }}
                >
                  <ul className="space-y-1.5 ml-3 list-disc">
                    <li>Your communities will be reviewed and handed off, suspended, or closed.</li>
                    <li>Your residents&apos; accounts and history are never affected.</li>
                    <li>Your corporation must approve before anything changes.</li>
                    <li>Your personal data will be wiped after a 30-day window.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs font-medium"
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    Why are you leaving? (required)
                  </label>
                  <div className="space-y-1.5">
                    {REASONS.map((r) => (
                      <label
                        key={r.value}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                        style={{ color: "var(--nly-text-secondary)" }}
                      >
                        <input
                          type="radio"
                          name="deletion-reason"
                          value={r.value}
                          checked={reason === r.value}
                          onChange={() => setReason(r.value)}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                  {reason === "other" && (
                    <input
                      type="text"
                      placeholder="Tell us briefly..."
                      maxLength={500}
                      className="w-full h-9 rounded-lg border px-3 text-sm"
                      style={inputStyle}
                      value={reasonOther}
                      onChange={(e) => setReasonOther(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs font-medium"
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    To confirm, type your account email
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    placeholder={pmEmail}
                    className="w-full h-9 rounded-lg border px-3 text-sm font-mono"
                    style={inputStyle}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={submitting}
                    className="flex-1 h-10 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{
                      borderColor: "var(--nly-border)",
                      color: "var(--nly-text-secondary)",
                      backgroundColor: "transparent",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      !reason ||
                      confirmEmail.trim().toLowerCase() !==
                        pmEmail.toLowerCase()
                    }
                    onClick={handleSubmit}
                    className="flex-1 h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "var(--nly-error)" }}
                  >
                    {submitting ? "Submitting..." : "Submit deletion request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
