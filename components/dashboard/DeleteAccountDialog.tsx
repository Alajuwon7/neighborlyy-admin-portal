"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { deleteAccount, getTeamMembersForTransfer } from "@/app/(dashboard)/dashboard/account/actions";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  community_id: string;
}

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (open) {
      getTeamMembersForTransfer().then(setTeamMembers);
    }
  }, [open]);

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setLoading(true);
    const result = await deleteAccount(password, transferTo);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Account deleted. We're sorry to see you go.");
    router.push("/login");
  }

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          color: "var(--nly-error)",
          border: "1px solid var(--nly-error)",
          backgroundColor: "transparent",
        }}
      >
        <Trash2 size={15} />
        Delete Account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div
            className="relative w-full max-w-md rounded-2xl border p-6 space-y-5"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              <X size={18} />
            </button>

            {/* Warning header */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--nly-error-bg)" }}
              >
                <AlertTriangle size={20} style={{ color: "var(--nly-error)" }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--nly-text-primary)" }}>
                  Delete Account
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--nly-text-secondary)" }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Warning details */}
            <div
              className="rounded-xl p-4 space-y-2 text-xs"
              style={{ backgroundColor: "var(--nly-error-bg)", color: "var(--nly-text-secondary)" }}
            >
              <p className="font-medium" style={{ color: "var(--nly-error)" }}>What will happen:</p>
              <ul className="space-y-1.5 ml-3 list-disc">
                <li>Your property manager profile will be permanently deleted</li>
                <li>All your communities will be suspended</li>
                <li>Team members will lose access</li>
                <li>Resident data will be preserved but inactive</li>
              </ul>
            </div>

            {/* Transfer ownership option */}
            {teamMembers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={14} style={{ color: "var(--nly-accent)" }} />
                  <label className="text-xs font-medium" style={{ color: "var(--nly-text-primary)" }}>
                    Transfer ownership to a team member (optional)
                  </label>
                </div>
                <select
                  value={transferTo ?? ""}
                  onChange={(e) => setTransferTo(e.target.value || null)}
                  className="w-full h-9 rounded-lg border px-3 text-sm"
                  style={inputStyle}
                >
                  <option value="">No transfer — suspend communities</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email}) — {m.role}
                    </option>
                  ))}
                </select>
                {transferTo && (
                  <p className="text-xs" style={{ color: "var(--nly-success)" }}>
                    Communities will remain active under the new owner.
                  </p>
                )}
              </div>
            )}

            {/* Password confirmation */}
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: "var(--nly-text-primary)" }}>
                Confirm your password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-9 rounded-lg border px-3 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Type DELETE confirmation */}
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: "var(--nly-text-primary)" }}>
                Type <span style={{ color: "var(--nly-error)" }}>DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full h-9 rounded-lg border px-3 text-sm font-mono"
                style={inputStyle}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80"
                style={{
                  borderColor: "var(--nly-border)",
                  color: "var(--nly-text-secondary)",
                  backgroundColor: "transparent",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || confirmText !== "DELETE" || !password}
                className="flex-1 h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "var(--nly-error)" }}
              >
                {loading ? "Deleting..." : "Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
