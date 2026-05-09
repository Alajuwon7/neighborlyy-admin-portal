"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  cancelDeletionRequest,
  resendCorpApprovalEmail,
} from "@/app/(dashboard)/dashboard/account/actions";
import { createClient } from "@/lib/supabase/client";
import type {
  DeletionRequestRow,
  DeletionStatus,
} from "@/lib/offboarding/types";

interface OffboardingStatusCardProps {
  initialRequest: DeletionRequestRow;
}

interface Step {
  key: string;
  label: string;
  completedAt: string | null;
  active: boolean;
}

export function OffboardingStatusCard({
  initialRequest,
}: OffboardingStatusCardProps) {
  const router = useRouter();
  const [request, setRequest] = useState<DeletionRequestRow>(initialRequest);
  const [working, setWorking] = useState<"cancel" | "resend" | null>(null);

  // Subscribe to realtime updates on this row. UPDATE covers status changes
  // (corp decision, billing review). DELETE forward-compatibility for Phase 4
  // hard deletion — without this listener the card would render stale forever.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`deletion_request:${initialRequest.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deletion_requests",
          filter: `id=eq.${initialRequest.id}`,
        },
        (payload: { new: Partial<DeletionRequestRow> }) => {
          setRequest((prev) => ({ ...prev, ...payload.new } as DeletionRequestRow));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "deletion_requests",
          filter: `id=eq.${initialRequest.id}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialRequest.id, router]);

  // Terminal status changes (regardless of whether they came from this client
  // or a remote actor like the corp approver) trigger one refresh so the
  // server re-evaluates which UI to render.
  useEffect(() => {
    if (
      request.status === "cancelled" ||
      request.status === "blocked" ||
      request.status === "completed"
    ) {
      router.refresh();
    }
  }, [request.status, router]);

  const blocked = request.status === "blocked";

  async function handleCancel() {
    if (!confirm("Cancel this deletion request? Your account stays as it was.")) {
      return;
    }
    setWorking("cancel");
    const result = await cancelDeletionRequest(request.id);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Deletion request cancelled.");
    // Optimistic local update — the status-change effect refreshes once.
    // Realtime UPDATE will arrive shortly with the same payload (idempotent).
    setRequest((prev) => ({ ...prev, status: "cancelled" }));
  }

  async function handleResend() {
    setWorking("resend");
    const result = await resendCorpApprovalEmail(request.id);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Approval email resent to your corporation.");
  }

  const steps = buildSteps(request);

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: blocked ? "var(--nly-error)" : "var(--nly-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{
              color: blocked ? "var(--nly-error)" : "var(--nly-text-primary)",
            }}
          >
            {blocked
              ? "Deletion request denied"
              : "Account deletion in progress"}
          </h3>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Submitted {new Date(request.requested_at).toLocaleString()}
          </p>
        </div>
        {!blocked && (
          <span
            className="text-xs rounded-full px-2 py-0.5"
            style={{
              backgroundColor: "var(--nly-info-bg, rgba(47,196,211,0.12))",
              color: "var(--nly-brand)",
            }}
          >
            {humanizeStatus(request.status)}
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.key}
            className="flex items-center gap-2 text-sm"
            style={{
              color: step.completedAt
                ? "var(--nly-text-secondary)"
                : step.active
                  ? "var(--nly-text-primary)"
                  : "var(--nly-text-tertiary)",
            }}
          >
            {step.completedAt ? (
              <Check size={14} style={{ color: "var(--nly-success)" }} />
            ) : step.active ? (
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "var(--nly-brand)" }}
              />
            ) : (
              <Circle size={14} />
            )}
            <span>{step.label}</span>
            {step.completedAt && (
              <span
                className="text-xs"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                · {new Date(step.completedAt).toLocaleDateString()}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-col-reverse md:flex-row gap-2 pt-1">
        <button
          type="button"
          disabled={working !== null || blocked}
          onClick={handleCancel}
          className="flex-1 h-9 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-secondary)",
            backgroundColor: "transparent",
          }}
        >
          <X size={14} />
          {working === "cancel" ? "Cancelling..." : "Cancel request"}
        </button>
        {request.status === "awaiting_corp_approval" && (
          <button
            type="button"
            disabled={working !== null}
            onClick={handleResend}
            className="flex-1 h-9 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
            style={{
              borderColor: "var(--nly-brand)",
              color: "var(--nly-brand)",
              backgroundColor: "transparent",
            }}
          >
            <RefreshCw size={14} />
            {working === "resend" ? "Resending..." : "Resend corp email"}
          </button>
        )}
      </div>
    </div>
  );
}

function buildSteps(req: DeletionRequestRow): Step[] {
  const submitted = req.requested_at;
  const corpDecided = req.corporation_approval_at;

  const status = req.status;

  return [
    {
      key: "submitted",
      label: "Request submitted",
      completedAt: submitted,
      active: false,
    },
    {
      key: "corp",
      label:
        status === "blocked"
          ? "Corporation denied"
          : "Corporation approval",
      completedAt: corpDecided,
      active: status === "awaiting_corp_approval",
    },
    {
      key: "billing",
      label: "Billing review",
      completedAt: req.stripe_resolved_at,
      active: status === "in_review" || status === "billing_blocked",
    },
    {
      key: "disposition",
      label: "Community disposition",
      completedAt: status === "approved" || status === "completed" ? req.updated_at : null,
      active: status === "approved",
    },
    {
      key: "closed",
      label: "Account closed",
      completedAt: req.pii_wiped_at,
      active: status === "completed" && !req.pii_wiped_at,
    },
  ];
}

function humanizeStatus(status: DeletionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "awaiting_corp_approval":
      return "Awaiting corporation approval";
    case "in_review":
      return "In review";
    case "billing_blocked":
      return "Billing on hold";
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    case "blocked":
      return "Denied";
    case "cancelled":
      return "Cancelled";
  }
}
