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
import { CheckCircle, XCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  approveResident,
  denyResident,
  bulkApproveResidents,
} from "@/app/(dashboard)/dashboard/communities/[id]/pending/actions";
import { toast } from "sonner";

const DENY_REASONS = [
  "Does not live in this community",
  "Incorrect unit number",
  "Duplicate account",
  "Unverifiable identity",
  "Other",
] as const;

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
  const [denyTarget, setDenyTarget] = useState<PendingUser | null>(null);

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

  async function handleDenyWithReason(reason: string) {
    if (!denyTarget) return;
    const id = denyTarget.id;
    setLoading(id);
    setDenyTarget(null);
    const result = await denyResident(id, communityId, reason);
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
                      onClick={() => setDenyTarget(u)}
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

      {/* Deny Reason Modal */}
      <AnimatePresence>
        {denyTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setDenyTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md mx-4 rounded-2xl border p-6"
              style={{
                backgroundColor: "var(--nly-surface)",
                borderColor: "var(--nly-border)",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  Deny {denyTarget.full_name}?
                </h3>
                <button
                  onClick={() => setDenyTarget(null)}
                  className="p-1 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  <X size={16} />
                </button>
              </div>
              <p
                className="text-xs mb-4"
                style={{ color: "var(--nly-text-secondary)" }}
              >
                Select a reason for denying this request:
              </p>
              <div className="space-y-2">
                {DENY_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleDenyWithReason(reason)}
                    disabled={loading === denyTarget.id}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all hover:brightness-110"
                    style={{
                      backgroundColor: "var(--nly-surface-hover)",
                      color: "var(--nly-text-primary)",
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
