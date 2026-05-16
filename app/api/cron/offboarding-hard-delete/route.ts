import { timingSafeEqual } from "node:crypto";
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

  // Constant-time comparison — `!==` short-circuits on the first differing
  // byte and would leak timing info on a globally-reachable endpoint whose
  // successful bypass triggers an irreversible bulk hard-delete.
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Vercel Cron sets this header automatically on its scheduled invocations.
  // We don't reject on its absence (the secret check is the source of truth
  // for auth), but log it in production so unexpected callers are visible.
  if (
    process.env.NODE_ENV === "production" &&
    req.headers.get("x-vercel-cron") !== "1"
  ) {
    console.warn(
      "[cron:offboarding-hard-delete] authorized request missing x-vercel-cron header",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hard_delete_expired_offboarding");
  if (error) {
    console.error("[cron:offboarding-hard-delete] rpc failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The RPC returns a single row { processed, errored, request_ids, errored_ids }.
  const row = Array.isArray(data) ? data[0] : data;
  const processed = row?.processed ?? 0;
  const errored = row?.errored ?? 0;
  const requestIds = row?.request_ids ?? [];
  const erroredIds = row?.errored_ids ?? [];

  if (errored > 0) {
    console.warn(
      `[cron:offboarding-hard-delete] processed=${processed} errored=${errored}`,
      { request_ids: requestIds, errored_ids: erroredIds },
    );
  } else {
    console.info(
      `[cron:offboarding-hard-delete] processed=${processed} errored=0`,
      { request_ids: requestIds },
    );
  }

  // ok=false when any per-request iteration errored — the cron itself succeeded
  // (RPC returned cleanly), but the operator should know some requests need
  // attention. Vercel cron treats any 2xx as success; the body carries the
  // detail.
  return NextResponse.json({
    ok: errored === 0,
    processed,
    errored,
    request_ids: requestIds,
    errored_ids: erroredIds,
  });
}
