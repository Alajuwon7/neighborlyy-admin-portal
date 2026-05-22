"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronDown, Check } from "lucide-react";
import {
  updateTeamMemberStatus,
  updateTeamMemberRole,
} from "@/app/(dashboard)/dashboard/team/actions";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  community_name: string;
  invited_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  assistant_manager: "Asst. Manager",
  leasing_agent: "Leasing Agent",
};

const EDITABLE_ROLES = [
  "manager",
  "assistant_manager",
  "leasing_agent",
] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "rgba(16, 185, 129, 0.12)", color: "var(--nly-success)" },
  invited: { label: "Pending", bg: "rgba(245, 158, 11, 0.12)", color: "var(--nly-warning)" },
  deactivated: { label: "Deactivated", bg: "rgba(239, 68, 68, 0.12)", color: "var(--nly-error)" },
};

export function TeamTable({ members }: { members: TeamMember[] }) {
  async function handleStatusChange(
    memberId: string,
    status: "active" | "deactivated"
  ) {
    try {
      const result = await updateTeamMemberStatus(memberId, status);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Member ${status === "active" ? "activated" : "deactivated"}`
        );
      }
    } catch (err) {
      console.error("Failed to update member status:", err);
      toast.error("Something went wrong. Please try again.");
    }
  }

  async function handleRoleChange(
    memberId: string,
    role: (typeof EDITABLE_ROLES)[number]
  ) {
    try {
      const result = await updateTeamMemberRole(memberId, role);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Role updated");
      }
    } catch (err) {
      console.error("Failed to update member role:", err);
      toast.error("Something went wrong. Please try again.");
    }
  }

  if (members.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          No team members yet. Invite someone to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {members.map((m) => {
        const status = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.deactivated;
        const initial = (m.full_name || m.email || "?").charAt(0).toUpperCase();
        const isOwner = m.role === "owner";
        return (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b last:border-b-0"
            style={{ borderColor: "var(--nly-divider)" }}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
              style={{
                backgroundColor: "rgba(47, 196, 211, 0.12)",
                color: "var(--nly-brand)",
              }}
            >
              {initial}
            </div>

            {/* Name + email + community */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  {m.full_name}
                </p>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: status.bg, color: status.color }}
                >
                  {status.label}
                </span>
              </div>
              <p
                className="text-xs truncate"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                {m.email} · {m.community_name}
              </p>
            </div>

            {/* Role */}
            {isOwner ? (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-lg border shrink-0"
                style={{
                  borderColor: "var(--nly-border)",
                  color: "var(--nly-text-secondary)",
                }}
              >
                Owner
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-opacity hover:opacity-80 shrink-0"
                  style={{
                    borderColor: "var(--nly-border)",
                    color: "var(--nly-text-secondary)",
                  }}
                >
                  {ROLE_LABELS[m.role] ?? m.role}
                  <ChevronDown size={12} />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  style={{
                    backgroundColor: "var(--nly-surface)",
                    borderColor: "var(--nly-border)",
                  }}
                >
                  {EDITABLE_ROLES.map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => handleRoleChange(m.id, r)}
                      style={{ color: "var(--nly-text-primary)" }}
                    >
                      <span className="flex-1">{ROLE_LABELS[r]}</span>
                      {m.role === r && (
                        <Check size={14} style={{ color: "var(--nly-brand)" }} />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="p-1.5 rounded-lg transition-opacity hover:opacity-80 shrink-0"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                style={{
                  backgroundColor: "var(--nly-surface)",
                  borderColor: "var(--nly-border)",
                }}
              >
                {m.status !== "active" && (
                  <DropdownMenuItem
                    onClick={() => handleStatusChange(m.id, "active")}
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    Activate
                  </DropdownMenuItem>
                )}
                {m.status !== "deactivated" && (
                  <DropdownMenuItem
                    onClick={() => handleStatusChange(m.id, "deactivated")}
                    className="text-red-400"
                  >
                    Deactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
