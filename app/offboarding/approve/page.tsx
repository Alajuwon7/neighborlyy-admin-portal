import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApprovalToken } from "@/lib/auth/offboarding-tokens";
import { CorpApprovalForm } from "./CorpApprovalForm";

export const dynamic = "force-dynamic";

interface ApprovePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function CorpApprovalPage({
  searchParams,
}: ApprovePageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorPanel
        title="Missing link"
        body="This approval link is incomplete. Please use the link from the email you received."
      />
    );
  }

  const verifyResult = await verifyApprovalToken(token);
  if (!verifyResult.ok) {
    if (verifyResult.reason === "expired") {
      return (
        <ErrorPanel
          title="This link has expired"
          body="Approval links expire 14 days after they are issued. Please ask the property manager to resend the request."
        />
      );
    }
    return (
      <ErrorPanel
        title="This link is invalid"
        body="The link could not be verified. Please make sure you used the most recent email."
      />
    );
  }

  if (verifyResult.payload.kind !== "deletion") {
    return (
      <ErrorPanel
        title="Not yet available"
        body="Transfer approvals are not yet enabled. Please contact support@miyora-app.com."
      />
    );
  }

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status, reason, requested_at, pm_id, org_id")
    .eq("id", verifyResult.payload.request_id)
    .single();

  if (!req) {
    return (
      <ErrorPanel
        title="Request not found"
        body="We couldn't find this request. It may have been cancelled."
      />
    );
  }

  if (req.status !== "awaiting_corp_approval") {
    return (
      <ErrorPanel
        title="Already decided"
        body="This request has already been decided. No further action is needed."
      />
    );
  }

  const [{ data: pm }, { data: org }, { data: communities }] = await Promise.all([
    admin
      .from("property_managers")
      .select("full_name")
      .eq("id", req.pm_id)
      .single(),
    admin.from("organizations").select("name").eq("id", req.org_id).single(),
    admin
      .from("communities")
      .select("name, building_name, community_code")
      .eq("organization_id", req.org_id),
  ]);

  const communityNames = (communities ?? []).map(
    (c: { name?: string | null; building_name?: string | null; community_code?: string | null }) =>
      c.name || c.building_name || c.community_code || "(unnamed community)",
  );

  return (
    <CorpApprovalForm
      token={token}
      pmName={pm?.full_name ?? "(unknown)"}
      orgName={org?.name ?? "(unknown)"}
      communityNames={communityNames}
      reason={req.reason}
      requestedAt={req.requested_at}
    />
  );
}

function ErrorPanel({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="rounded-2xl border p-6 text-center space-y-3"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <h1
        className="text-xl font-bold"
        style={{ color: "var(--nly-text-primary)" }}
      >
        {title}
      </h1>
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        {body}
      </p>
    </div>
  );
}
