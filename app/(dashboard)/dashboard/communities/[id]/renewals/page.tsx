import Link from "next/link";
import { Download } from "lucide-react";
import { getCommunityWithAuth } from "@/lib/queries";
import { formatReportMonth } from "@/lib/rent-roll";
import { RentRollUpload } from "@/components/community/RentRollUpload";

export const dynamic = "force-dynamic";

type UploadRow = {
  id: string;
  report_month: string;
  file_name: string | null;
  row_count: number;
  rows_rejected: number;
  uploaded_by_name: string | null;
  uploaded_at: string;
  upload_count: number;
};

const HISTORY_SHOWN = 24;

export default async function RenewalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);
  const code = community.community_code as string;

  const [uploadsRes, leaseCountRes] = await Promise.all([
    supabase
      .from("rent_roll_uploads")
      .select("id, report_month, file_name, row_count, rows_rejected, uploaded_by_name, uploaded_at, upload_count")
      .eq("community_code", code)
      .order("report_month", { ascending: false })
      .limit(HISTORY_SHOWN),
    supabase.from("lease_records").select("id", { count: "exact", head: true }).eq("community_code", code),
  ]);
  if (uploadsRes.error) console.error("rent_roll_uploads read failed:", uploadsRes.error);
  if (leaseCountRes.error) console.error("lease_records count failed:", leaseCountRes.error);

  const uploads = (uploadsRes.data as UploadRow[] | null) ?? [];
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
          Renewals
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
          Upload your monthly rent roll to see how engaged residents renew on the{" "}
          <Link href={`/dashboard/communities/${id}/insights`} className="underline underline-offset-2">
            Insights
          </Link>{" "}
          tab
        </p>
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
              Upload a rent roll
            </h3>
            <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
              A CSV with a unit, a lease end date and (optionally) the renewal outcome: renewed, moved out or
              pending. Only those three columns are saved — names and rents stay on your computer.
            </p>
          </div>
          <a
            href="/rent-roll-template.csv"
            download
            className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0"
            style={{ color: "var(--nly-brand)" }}
          >
            <Download size={14} />
            Template CSV
          </a>
        </div>
        <RentRollUpload
          communityId={id}
          defaultMonth={defaultMonth}
          uploadedMonths={uploads.map((u) => u.report_month)}
        />
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
            Upload history
          </h3>
          {leaseCountRes.count != null && (
            <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              {leaseCountRes.count} {leaseCountRes.count === 1 ? "lease" : "leases"} on file
            </p>
          )}
        </div>
        {uploadsRes.error ? (
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            Couldn&apos;t load upload history. Please refresh to try again.
          </p>
        ) : uploads.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            No rent rolls uploaded yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
            {uploads.map((u) => (
              <li key={u.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: "var(--nly-text-primary)" }}>
                    {formatReportMonth(u.report_month)}
                  </p>
                  <p className="text-[11px] break-words" style={{ color: "var(--nly-text-tertiary)" }}>
                    {u.file_name ?? "rent roll"} · {u.uploaded_by_name ?? "a manager"} ·{" "}
                    {new Date(u.uploaded_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                    {u.upload_count > 1 ? ` · uploaded ${u.upload_count} times` : ""}
                  </p>
                </div>
                <p className="text-xs tabular-nums" style={{ color: "var(--nly-text-secondary)" }}>
                  {u.row_count} saved
                  {u.rows_rejected > 0 ? ` · ${u.rows_rejected} skipped` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      {children}
    </div>
  );
}
