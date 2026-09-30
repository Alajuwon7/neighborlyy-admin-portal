"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { explainWeakPassword } from "@/lib/password-policy";
import {
  signApprovalToken,
  TOKEN_TTL,
} from "@/lib/auth/offboarding-tokens";
import { appendAudit } from "@/lib/offboarding/audit";
import {
  buildApprovalUrl,
  sendCorpApprovalRequest,
  sendDeletionRequestReceived,
} from "@/lib/offboarding/email-senders";
import {
  OPEN_DELETION_STATUSES,
  OPEN_TRANSFER_STATUSES,
  type DeletionReason,
  type DeletionRequestRow,
} from "@/lib/offboarding/types";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = formData.get("full_name") as string;
  const phone = formData.get("phone") as string;
  const companyName = formData.get("company_name") as string;

  if (!fullName) return { error: "Full name is required" };

  const { error } = await supabase
    .from("property_managers")
    .update({
      full_name: fullName,
      phone: phone || null,
      company_name: companyName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/account");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    const weak = explainWeakPassword(newPassword, error);
    if (weak) return { error: weak };
    console.error("changePassword failed:", error);
    return { error: "Couldn't update your password. Please try again." };
  }

  return { success: true };
}

// =============================================================================
// PM Account Offboarding — Deletion request flow (Phase 2)
//
// Spec source of truth:
//   docs/PM Account Offboarding — Overview & Decision Framework/01-DELETION-FLOW.md
//
// These actions only cover Gates 0–1: the PM submits a deletion request, the
// system emails the corporation, the corporation approves or denies via the
// public /offboarding/approve page. Subsequent gates (billing review, community
// disposition, PII wipe, cron hard delete) ship in Phases 3–4.
// =============================================================================

const VALID_DELETION_REASONS: DeletionReason[] = [
  "moving_to_other_platform",
  "property_sold",
  "no_longer_managing",
  "other",
];

interface SubmitDeletionRequestInput {
  reason: DeletionReason;
  reasonOther?: string | null;
  confirmEmail: string;
}

type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };

export async function submitDeletionRequest(
  input: SubmitDeletionRequestInput,
): Promise<ActionResult<{ requestId: string; alreadyExisted: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Not authenticated" };

  if (!VALID_DELETION_REASONS.includes(input.reason)) {
    return { ok: false, error: "Please select a reason for leaving" };
  }

  if (
    typeof input.confirmEmail !== "string" ||
    input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
  ) {
    return {
      ok: false,
      error: "The email you typed doesn't match your account email",
    };
  }

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, full_name, email, organization_id")
    .eq("user_id", user.id)
    .single();

  if (!pm) return { ok: false, error: "Profile not found" };
  if (!pm.organization_id) {
    return {
      ok: false,
      error: "Your account is not linked to an organization yet",
    };
  }

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name, corporation_contact_email")
    .eq("id", pm.organization_id)
    .single();

  if (orgError || !org) {
    return { ok: false, error: "Could not load your organization" };
  }
  if (!org.corporation_contact_email) {
    return {
      ok: false,
      error:
        "Your corporation's contact email is missing. Please add it before continuing.",
    };
  }

  const { data: openTransfer } = await admin
    .from("transfer_requests")
    .select("id")
    .eq("outgoing_pm_id", pm.id)
    .in("status", OPEN_TRANSFER_STATUSES)
    .maybeSingle();
  if (openTransfer) {
    return {
      ok: false,
      error:
        "You have an open transfer request. Cancel it before requesting deletion.",
    };
  }

  const { data: existing } = await admin
    .from("deletion_requests")
    .select("id")
    .eq("pm_id", pm.id)
    .in("status", OPEN_DELETION_STATUSES)
    .maybeSingle();

  if (existing) {
    return { ok: true, requestId: existing.id, alreadyExisted: true };
  }

  const reasonText =
    input.reason === "other" && input.reasonOther
      ? `other: ${input.reasonOther.slice(0, 500)}`
      : input.reason;

  const nowIso = new Date().toISOString();
  const initialAudit = [
    {
      actor: "pm" as const,
      actor_id: user.id,
      action: "request_submitted",
      at: nowIso,
      note: reasonText,
    },
  ];

  const { data: inserted, error: insertError } = await admin
    .from("deletion_requests")
    .insert({
      pm_id: pm.id,
      org_id: org.id,
      reason: reasonText,
      status: "awaiting_corp_approval",
      audit_log: initialAudit,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // The pre-check above has a race window; the partial unique index
    // `deletion_requests_one_open_per_pm_idx` is the source of truth.
    // Treat its violation as the same idempotent path the pre-check uses.
    if ((insertError as { code?: string } | null)?.code === "23505") {
      const { data: existingAfterRace } = await admin
        .from("deletion_requests")
        .select("id")
        .eq("pm_id", pm.id)
        .in("status", OPEN_DELETION_STATUSES)
        .maybeSingle();
      if (existingAfterRace) {
        return { ok: true, requestId: existingAfterRace.id, alreadyExisted: true };
      }
    }
    return {
      ok: false,
      error: insertError?.message || "Could not create deletion request",
    };
  }

  const { data: communities } = await admin
    .from("communities")
    .select("name, building_name, community_code")
    .eq("organization_id", org.id);

  const communityNames = (communities ?? []).map(
    (c: { name?: string | null; building_name?: string | null; community_code?: string | null }) =>
      c.name || c.building_name || c.community_code || "(unnamed community)",
  );

  const { token, jti } = await signApprovalToken(
    { kind: "deletion", request_id: inserted.id, org_id: org.id },
    TOKEN_TTL.CORP_APPROVAL_SECONDS,
  );
  const approveUrl = buildApprovalUrl(token);

  const { error: jtiError } = await admin
    .from("deletion_requests")
    .update({ current_approval_jti: jti })
    .eq("id", inserted.id);
  if (jtiError) {
    // Without a persisted jti, the corp's link can't be verified. Roll back
    // by cancelling so the partial unique index releases.
    await admin
      .from("deletion_requests")
      .update({ status: "cancelled" })
      .eq("id", inserted.id);
    return {
      ok: false,
      error: "Could not finalize your request. Please try again.",
    };
  }

  try {
    await sendCorpApprovalRequest({
      to: org.corporation_contact_email,
      kind: "deletion",
      pmName: pm.full_name,
      orgName: org.name,
      communityNames,
      approveUrl,
      expiresInDays: 14,
    });
    await appendAudit(admin, "deletion_requests", inserted.id, {
      actor: "system",
      actor_id: "system",
      action: "corp_email_sent",
      note: `recipient=${org.corporation_contact_email}`,
    });
  } catch (err) {
    // Email is the load-bearing handoff. If it failed, leaving the row in
    // awaiting_corp_approval would orphan the request — the corp never gets
    // a link, the PM is blocked from resubmitting by the partial unique index.
    // Cancel it so the user can cleanly retry.
    await appendAudit(admin, "deletion_requests", inserted.id, {
      actor: "system",
      actor_id: "system",
      action: "corp_email_send_failed",
      note: err instanceof Error ? err.message : String(err),
    });
    await admin
      .from("deletion_requests")
      .update({ status: "cancelled" })
      .eq("id", inserted.id);
    return {
      ok: false,
      error:
        "We couldn't email your corporation. Please try again, or contact support@miyora-app.com if the problem persists.",
    };
  }

  try {
    await sendDeletionRequestReceived({
      to: pm.email,
      pmFirstName: pm.full_name?.split(" ")[0] ?? "",
    });
  } catch {
    // Non-fatal — the corp email is the load-bearing one.
  }

  revalidatePath("/dashboard/account");
  return { ok: true, requestId: inserted.id, alreadyExisted: false };
}

export async function cancelDeletionRequest(
  requestId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!pm) return { ok: false, error: "Profile not found" };

  const { data: req, error: readError } = await admin
    .from("deletion_requests")
    .select("id, pm_id, status")
    .eq("id", requestId)
    .single();
  if (readError || !req) return { ok: false, error: "Request not found" };
  if (req.pm_id !== pm.id) {
    return { ok: false, error: "Not your request" };
  }

  if (!OPEN_DELETION_STATUSES.includes(req.status)) {
    return { ok: false, error: "This request can no longer be cancelled" };
  }

  const { error: updateError } = await admin
    .from("deletion_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);
  if (updateError) return { ok: false, error: updateError.message };

  await appendAudit(admin, "deletion_requests", requestId, {
    actor: "pm",
    actor_id: user.id,
    action: "request_cancelled",
  });

  revalidatePath("/dashboard/account");
  return { ok: true };
}

export async function setCorporationContactEmail(
  email: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const cleaned = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return { ok: false, error: "That doesn't look like a valid email" };
  }

  const { data: pm } = await supabase
    .from("property_managers")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();
  if (!pm?.organization_id) {
    return { ok: false, error: "No organization linked to your account" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ corporation_contact_email: cleaned })
    .eq("id", pm.organization_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/account");
  return { ok: true };
}

export async function getActiveDeletionRequest(): Promise<DeletionRequestRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!pm) return null;

  const { data } = await supabase
    .from("deletion_requests")
    .select("*")
    .eq("pm_id", pm.id)
    .in("status", OPEN_DELETION_STATUSES)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as DeletionRequestRow | null) ?? null;
}

export async function resendCorpApprovalEmail(
  requestId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();
  if (!pm) return { ok: false, error: "Profile not found" };

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, pm_id, org_id, status")
    .eq("id", requestId)
    .single();
  if (!req) return { ok: false, error: "Request not found" };
  if (req.pm_id !== pm.id) return { ok: false, error: "Not your request" };
  if (req.status !== "awaiting_corp_approval") {
    return {
      ok: false,
      error: "Approval has already been decided — no need to resend.",
    };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name, corporation_contact_email")
    .eq("id", req.org_id)
    .single();
  if (!org?.corporation_contact_email) {
    return { ok: false, error: "Corporation email is missing." };
  }

  const { data: communities } = await admin
    .from("communities")
    .select("name, building_name, community_code")
    .eq("organization_id", req.org_id);
  const communityNames = (communities ?? []).map(
    (c: { name?: string | null; building_name?: string | null; community_code?: string | null }) =>
      c.name || c.building_name || c.community_code || "(unnamed community)",
  );

  const { token, jti } = await signApprovalToken(
    { kind: "deletion", request_id: req.id, org_id: req.org_id! },
    TOKEN_TTL.CORP_APPROVAL_SECONDS,
  );
  const approveUrl = buildApprovalUrl(token);

  // Rotate the persisted jti before sending — invalidates any prior link
  // already in the corp's inbox.
  const { error: jtiError } = await admin
    .from("deletion_requests")
    .update({ current_approval_jti: jti })
    .eq("id", req.id);
  if (jtiError) {
    return { ok: false, error: "Could not prepare a new approval link." };
  }

  try {
    await sendCorpApprovalRequest({
      to: org.corporation_contact_email,
      kind: "deletion",
      pmName: pm.full_name,
      orgName: org.name,
      communityNames,
      approveUrl,
      expiresInDays: 14,
    });
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not resend the email",
    };
  }

  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "pm",
    actor_id: user.id,
    action: "corp_email_resent",
    note: `recipient=${org.corporation_contact_email}`,
  });

  return { ok: true };
}

export async function getCorporationContactEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pm } = await supabase
    .from("property_managers")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();
  if (!pm?.organization_id) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("corporation_contact_email")
    .eq("id", pm.organization_id)
    .single();

  return org?.corporation_contact_email ?? null;
}
