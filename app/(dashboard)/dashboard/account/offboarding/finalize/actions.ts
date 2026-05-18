"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { appendAudit } from "@/lib/offboarding/audit";
import { buildStripeAnonymization } from "@/lib/offboarding/completion";
import { dispositionLabel } from "@/lib/offboarding/disposition";
import { sendDeletionComplete } from "@/lib/offboarding/email-senders";
import type { CommunityDisposition } from "@/lib/offboarding/types";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Gate 5 — PM-initiated account closure. Sequenced around the atomic
 * `complete_pm_offboarding` RPC as the commit point:
 *
 * 1. Stripe anonymization (best-effort, pre-commit) — must run before the RPC
 *    wipes the PM/org rows to sentinel values, because the Stripe customer
 *    record mirrors those identifying fields.
 * 2. Atomic DB wipe via `complete_pm_offboarding` RPC (THE COMMIT POINT).
 * 3. Final confirmation email (best-effort, post-commit) — sending after the
 *    RPC means a no-op RPC (concurrent run / double-tap) never generates a
 *    duplicate "your account has been closed" email.
 * 4. Auth-user deletion (best-effort, post-commit) — status is already
 *    'completed'; a failure here is recoverable.
 *
 * Deliberately does NOT call revalidatePath — an RSC refetch of /finalize would
 * trip the layout guard the instant status becomes 'completed'. FinalConfirmation
 * swaps to Screen 6 client-side and signs the user out.
 */
export async function completeOffboarding(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, full_name, email, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) return { ok: false, error: "Profile not found" };

  const admin = createAdminClient();

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, org_id, status, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return { ok: false, error: "No account closure in progress" };

  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];

  // Load the org's communities for the email summary + Stripe anonymization.
  const { data: communities } = await admin
    .from("communities")
    .select("id, name, community_code, stripe_customer_id")
    .eq("organization_id", pm.organization_id);
  const communityRows = communities ?? [];

  // appendAudit must never abort the wipe — swallow its failures everywhere.
  const safeAudit = (
    action: string,
    actor: "system" | "pm",
    actorId: string,
    note: string,
  ) =>
    appendAudit(admin, "deletion_requests", req.id, {
      actor,
      actor_id: actorId,
      action,
      note,
    }).catch((err) => {
      console.warn(`[offboarding] audit append failed (${action})`, err);
    });

  // ---- Step 1: Stripe customer anonymization (best-effort, pre-commit) ----
  // Pre-commit because the Stripe customer record mirrors the PM/org identifying
  // data; we want to scrub it before the DB row is wiped to its sentinel values.
  const customerIds = Array.from(
    new Set(
      communityRows
        .map((c) => c.stripe_customer_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  if (customerIds.length > 0) {
    let stripe: ReturnType<typeof getStripe> | null = null;
    try {
      stripe = getStripe();
    } catch (err) {
      console.warn("[offboarding] stripe SDK not configured; skipping anonymization", err);
      await safeAudit(
        "stripe_skipped",
        "system",
        "stripe",
        err instanceof Error ? err.message : String(err),
      );
    }
    if (stripe) {
      for (const customerId of customerIds) {
        try {
          const anon = buildStripeAnonymization(pm.id, req.id);
          await stripe.customers.update(customerId, {
            name: anon.name,
            email: anon.email,
            metadata: anon.metadata,
          });
          await safeAudit("stripe_anonymized", "system", "stripe", `customer=${customerId}`);
        } catch (err) {
          console.warn("[offboarding] stripe customer anonymization failed", {
            customerId,
            err,
          });
          await safeAudit(
            "stripe_anonymize_failed",
            "system",
            "stripe",
            `customer=${customerId}; ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  // ---- Step 2: atomic DB wipe (THE COMMIT POINT) ----
  const { data: rpcRows, error: rpcError } = await admin.rpc(
    "complete_pm_offboarding",
    {
      p_request_id: req.id,
      p_audit: {
        actor: "pm",
        actor_id: user.id,
        action: "pii_wiped",
        at: new Date().toISOString(),
        note: "fields=full_name,phone,avatar_url,company_name,email",
      },
    },
  );
  if (rpcError) {
    console.warn("[offboarding] complete_pm_offboarding RPC failed", rpcError);
    await safeAudit(
      "rpc_failed",
      "system",
      "system",
      rpcError.message ?? "unknown",
    );
    return {
      ok: false,
      error: "Couldn't complete account closure. Please try again or contact support@miyora.com.",
    };
  }
  if (!rpcRows || (rpcRows as unknown[]).length === 0) {
    // RPC found no 'approved' row — already completed or a concurrent run.
    return { ok: false, error: "This request is no longer pending closure." };
  }

  // ---- Step 3: final confirmation email (best-effort, post-commit) ----
  // Post-commit so a no-op RPC (concurrent run / double-tap) never generates a
  // duplicate "your account has been closed" email. The email content uses local
  // consts (pm.email, pm.full_name, communityRows) captured before the RPC, so
  // the ordering is safe.
  const hardDeleteDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const communityLines = communityRows.map((c) => {
    const d = dispositions.find((x) => x.community_id === c.id);
    const label = d ? dispositionLabel(d.action) : "No disposition recorded";
    return `${c.name ?? c.community_code ?? "Community"} — ${label}`;
  });
  try {
    await sendDeletionComplete({
      to: pm.email,
      pmFirstName: pm.full_name?.split(" ")[0] ?? "",
      communityLines,
      hardDeleteDate: hardDeleteDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
    await safeAudit("final_email_sent", "system", "system", `recipient=${pm.email}`);
  } catch (err) {
    console.warn("[offboarding] final email send failed", err);
    await safeAudit(
      "final_email_failed",
      "system",
      "system",
      err instanceof Error ? err.message : String(err),
    );
  }

  // ---- Step 4: delete the auth user (best-effort, post-commit) ----
  // Status is already 'completed'; a failure here is recoverable. Residual
  // login is constrained by RLS on the wiped property_managers row (the
  // dashboard-wide layout guard for closed accounts is a separate follow-up).
  try {
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) throw authError;
    await safeAudit("auth_deleted", "system", "system", `auth_user=${user.id}`);
  } catch (err) {
    console.warn("[offboarding] auth user deletion failed", err);
    await safeAudit(
      "auth_delete_failed",
      "system",
      "system",
      err instanceof Error ? err.message : String(err),
    );
  }

  return { ok: true };
}
