import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Gate 6 — daily hard delete. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
// automatically when the CRON_SECRET env var is set on the project.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hard_delete_expired_offboarding");
  if (error) {
    console.error("[cron:offboarding-hard-delete] rpc failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The RPC returns a single row { processed, request_ids }.
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    processed: row?.processed ?? 0,
    request_ids: row?.request_ids ?? [],
  });
}
