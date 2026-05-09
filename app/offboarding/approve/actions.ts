"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApprovalToken } from "@/lib/auth/offboarding-tokens";
import { appendAudit } from "@/lib/offboarding/audit";
import { sendCorpDecisionNoticeToPM } from "@/lib/offboarding/email-senders";

type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: "expired" | "invalid" | "already_decided" | "not_found" };

interface SubmitCorpDecisionInput {
  token: string;
  decision: "approve" | "deny";
  approverName: string;
  approverTitle: string;
  approverEmail: string;
}

export async function submitCorpDecision(
  input: SubmitCorpDecisionInput,
): Promise<ActionResult<{ kind: "deletion" | "transfer"; decision: "approved" | "denied" }>> {
  const approverName = input.approverName?.trim();
  const approverTitle = input.approverTitle?.trim();
  const approverEmail = input.approverEmail?.trim().toLowerCase();

  if (!approverName) {
    return { ok: false, error: "Please enter your full name" };
  }
  if (!approverTitle) {
    return { ok: false, error: "Please enter your title" };
  }
  if (!approverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approverEmail)) {
    return { ok: false, error: "Please enter a valid email address" };
  }
  if (input.decision !== "approve" && input.decision !== "deny") {
    return { ok: false, error: "Invalid decision" };
  }

  const verifyResult = await verifyApprovalToken(input.token);
  if (!verifyResult.ok) {
    return {
      ok: false,
      error:
        verifyResult.reason === "expired"
          ? "This approval link has expired. Please ask the property manager to resend it."
          : "This approval link is invalid.",
      code: verifyResult.reason,
    };
  }

  const { kind, request_id } = verifyResult.payload;
  const admin = createAdminClient();

  if (kind === "transfer") {
    // Transfer flow ships in Phase 5; this branch is wired up but rejects for now.
    return {
      ok: false,
      error: "Transfer approvals are not yet enabled.",
      code: "invalid",
    };
  }

  const { data: req, error: readError } = await admin
    .from("deletion_requests")
    .select("id, pm_id, org_id, status, corporation_approval_at, current_approval_jti")
    .eq("id", request_id)
    .single();

  if (readError || !req) {
    return { ok: false, error: "Request not found", code: "not_found" };
  }

  if (req.status !== "awaiting_corp_approval") {
    return {
      ok: false,
      error: "This request has already been decided.",
      code: "already_decided",
    };
  }

  // Single-use enforcement: only the most recently issued token can act.
  // Resends rotate current_approval_jti, invalidating any prior link.
  if (req.current_approval_jti !== verifyResult.payload.jti) {
    return {
      ok: false,
      error:
        "This approval link has been superseded. Please use the most recent email from the property manager.",
      code: "invalid",
    };
  }

  // Look up approver email + PM for notice + audit.
  const [{ data: org }, { data: pm }] = await Promise.all([
    admin
      .from("organizations")
      .select("corporation_contact_email, name")
      .eq("id", req.org_id)
      .single(),
    admin
      .from("property_managers")
      .select("email, full_name")
      .eq("id", req.pm_id)
      .single(),
  ]);

  const isApprove = input.decision === "approve";
  const newStatus = isApprove ? "in_review" : "blocked";
  const nowIso = new Date().toISOString();

  const { error: updateError } = await admin
    .from("deletion_requests")
    .update({
      status: newStatus,
      corporation_approval_at: nowIso,
      corporation_approver_name: approverName,
      corporation_approver_email: approverEmail,
      current_approval_jti: null,
    })
    .eq("id", request_id)
    .eq("status", "awaiting_corp_approval")
    .eq("current_approval_jti", verifyResult.payload.jti);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    undefined;

  await appendAudit(admin, "deletion_requests", request_id, {
    actor: "corporation",
    actor_id: approverEmail,
    action: isApprove ? "corp_approved" : "corp_denied",
    ip_address: ip,
    note: `approver=${approverName}; title=${approverTitle}; contact_on_file=${org?.corporation_contact_email ?? "none"}`,
  });

  if (pm?.email) {
    try {
      await sendCorpDecisionNoticeToPM({
        to: pm.email,
        kind: "deletion",
        decision: isApprove ? "approved" : "denied",
        pmFirstName: pm.full_name?.split(" ")[0] ?? "",
        approverName,
        nextStepCopy: isApprove
          ? "We'll walk you through billing review and community handoff next."
          : undefined,
      });
    } catch {
      // Non-fatal: status update is the source of truth; PM also sees status in portal.
    }
  }

  return {
    ok: true,
    kind: "deletion",
    decision: isApprove ? "approved" : "denied",
  };
}
