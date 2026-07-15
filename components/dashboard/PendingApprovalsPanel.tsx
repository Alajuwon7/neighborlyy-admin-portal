"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Check, X } from "lucide-react";
import {
  approveResident,
  denyResident,
} from "@/app/(dashboard)/dashboard/communities/[id]/pending/actions";

export interface PendingRow {
  id: string;
  full_name: string;
  email: string;
  unit_number: string | null;
  created_at: string;
  community_code: string;
}

interface Props {
  rows: PendingRow[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  showCommunity: boolean;
}

export function PendingApprovalsPanel({
  rows: initialRows,
  communityMap,
  communityNameMap,
  showCommunity,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<Record<string, "approve" | "deny">>({});
  const router = useRouter();

  async function act(row: PendingRow, kind: "approve" | "deny") {
    const communityId = communityMap[row.community_code];
    if (!communityId) {
      toast.error("Couldn't resolve this resident's community.");
      return;
    }
    setBusy((b) => ({ ...b, [row.id]: kind }));
    try {
      const res =
        kind === "approve"
          ? await approveResident(row.id, communityId)
          : await denyResident(row.id, communityId);
      if ("error" in res && res.error) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success(
        kind === "approve"
          ? `${row.full_name} approved`
          : `${row.full_name} denied`,
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[row.id];
        return next;
      });
    }
  }

  return (
    <div
      id="pending-approvals"
      className="rounded-2xl border scroll-mt-24"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--nly-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          Pending approvals
        </h3>
        <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          {rows.length} awaiting review
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            All caught up — no residents waiting for review.
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
          {rows.map((row) => {
            const state = busy[row.id];
            return (
              <div
                key={row.id}
                className="px-5 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    {row.full_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--nly-text-tertiary)" }}>
                    {showCommunity && (
                      <span className="mr-1.5">
                        {communityNameMap[row.community_code]} &middot;
                      </span>
                    )}
                    {row.unit_number ? `Unit ${row.unit_number} · ` : ""}
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => act(row, "approve")}
                  disabled={!!state}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
                >
                  <Check size={13} />
                  {state === "approve" ? "..." : "Approve"}
                </button>
                <button
                  onClick={() => act(row, "deny")}
                  disabled={!!state}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: "var(--nly-border)", color: "var(--nly-text-secondary)" }}
                >
                  <X size={13} />
                  {state === "deny" ? "..." : "Deny"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
