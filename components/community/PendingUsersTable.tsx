"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import {
  approveResident,
  denyResident,
  bulkApproveResidents,
} from "@/app/(dashboard)/dashboard/communities/[id]/pending/actions";
import { toast } from "sonner";

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  unit_number: string | null;
  created_at: string;
}

export function PendingUsersTable({
  users: initialUsers,
  communityId,
}: {
  users: PendingUser[];
  communityId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  }

  async function handleApprove(id: string) {
    setLoading(id);
    const result = await approveResident(id, communityId);
    setLoading(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Resident approved");
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleDeny(id: string) {
    setLoading(id);
    const result = await denyResident(id, communityId);
    setLoading(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Resident denied");
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setLoading("bulk");
    const result = await bulkApproveResidents(ids, communityId);
    setLoading(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`${ids.length} residents approved`);
      setUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
      setSelected(new Set());
    }
  }

  if (users.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          No pending approval requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-3">
          <span
            className="text-xs"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            {selected.size} selected
          </span>
          <Button
            size="sm"
            disabled={loading === "bulk"}
            onClick={handleBulkApprove}
            className="text-white text-xs"
            style={{ backgroundColor: "var(--nly-success)" }}
          >
            Approve Selected
          </Button>
        </div>
      )}
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
              <TableHead className="w-10">
                <Checkbox
                  checked={selected.size === users.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
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
                Unit
              </TableHead>
              <TableHead
                className="text-xs font-medium"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                Requested
              </TableHead>
              <TableHead className="text-right text-xs font-medium"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow
                key={u.id}
                style={{ borderColor: "var(--nly-divider)" }}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(u.id)}
                    onCheckedChange={() => toggleSelect(u.id)}
                  />
                </TableCell>
                <TableCell
                  className="text-sm font-medium"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  {u.full_name}
                </TableCell>
                <TableCell
                  className="text-sm"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {u.email}
                </TableCell>
                <TableCell
                  className="text-sm"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  {u.unit_number ?? "—"}
                </TableCell>
                <TableCell
                  className="text-sm"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleApprove(u.id)}
                      disabled={loading === u.id}
                      className="p-1.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{ color: "var(--nly-success)" }}
                      title="Approve"
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      onClick={() => handleDeny(u.id)}
                      disabled={loading === u.id}
                      className="p-1.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{ color: "var(--nly-error)" }}
                      title="Deny"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
