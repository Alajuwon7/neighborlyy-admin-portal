"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { updateTeamMemberStatus } from "@/app/(dashboard)/dashboard/team/actions";
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

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(16, 185, 129, 0.1)", color: "var(--nly-success)" },
  invited: { bg: "rgba(245, 158, 11, 0.1)", color: "var(--nly-warning)" },
  deactivated: { bg: "rgba(239, 68, 68, 0.1)", color: "var(--nly-error)" },
};

export function TeamTable({ members }: { members: TeamMember[] }) {
  async function handleStatusChange(
    memberId: string,
    status: "active" | "deactivated"
  ) {
    const result = await updateTeamMemberStatus(memberId, status);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Member ${status === "active" ? "activated" : "deactivated"}`);
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
      <Table>
        <TableHeader>
          <TableRow style={{ borderColor: "var(--nly-border)" }}>
            <TableHead
              className="text-xs font-medium"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Name
            </TableHead>
            <TableHead
              className="text-xs font-medium"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Email
            </TableHead>
            <TableHead
              className="text-xs font-medium"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Role
            </TableHead>
            <TableHead
              className="text-xs font-medium"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Community
            </TableHead>
            <TableHead
              className="text-xs font-medium"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Status
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const statusStyle =
              STATUS_STYLES[m.status] ?? STATUS_STYLES.deactivated;
            return (
              <TableRow
                key={m.id}
                style={{ borderColor: "var(--nly-divider)" }}
              >
                <TableCell
                  className="text-sm font-medium"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  {m.full_name}
                </TableCell>
                <TableCell
                  className="text-sm"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {m.email}
                </TableCell>
                <TableCell
                  className="text-sm capitalize"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {ROLE_LABELS[m.role] ?? m.role}
                </TableCell>
                <TableCell
                  className="text-sm"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {m.community_name}
                </TableCell>
                <TableCell>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color,
                    }}
                  >
                    {m.status}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="p-1.5 rounded-lg transition-opacity hover:opacity-80"
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
                          onClick={() =>
                            handleStatusChange(m.id, "deactivated")
                          }
                          className="text-red-400"
                        >
                          Deactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
