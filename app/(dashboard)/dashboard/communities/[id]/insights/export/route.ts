import { getCommunityWithAuth } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveReportPeriod } from "@/lib/report-period";
import { loadInsightsReport } from "@/lib/insights-report";
import { buildInsightsPdf } from "@/lib/insights-pdf";

export const dynamic = "force-dynamic";

/**
 * GET ?range=30|60|90|120 or ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 * (&tz=<IANA zone> for printed times). Returns the Resident Insights PDF.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Auth first: redirects if this PM doesn't manage the community. The
  // service-role client below relies on this check.
  const { supabase, community } = await getCommunityWithAuth(id);

  const url = new URL(request.url);
  const now = new Date();
  const tz = url.searchParams.get("tz");
  const resolved = resolveReportPeriod(url.searchParams, now, tz ?? undefined);
  if ("error" in resolved) {
    return new Response(resolved.error, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  try {
    const report = await loadInsightsReport(
      supabase,
      createAdminClient(),
      community as {
        community_code: string;
        name: string;
        created_at: string;
        building_resident_count: number | null;
      },
      resolved.period,
      now,
    );
    const pdf = buildInsightsPdf(report, tz);
    const slug =
      String(community.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "community";
    const filename = `miyora-insights-${slug}-${resolved.period.fromDay}-to-${resolved.period.toDay}.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("insights export failed:", e);
    return new Response("Couldn't build the report. Please try again.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
