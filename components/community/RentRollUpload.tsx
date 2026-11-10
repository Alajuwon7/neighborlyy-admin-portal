"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRentRoll } from "@/app/(dashboard)/dashboard/communities/[id]/renewals/actions";
import { formatReportMonth, parseRentRoll, reportMonthStart, type RentRollParse } from "@/lib/rent-roll";

const OUTCOME_LABEL = { renewed: "Renewed", moved_out: "Moved out", pending: "Pending" } as const;
const PREVIEW_ROWS = 8;

type Parsed = Extract<RentRollParse, { ok: true }>;

/**
 * Pick a CSV → preview (valid rows + per-row errors) → save. Parsing happens
 * here in the browser; only unit / lease end / outcome are sent to the server.
 */
export function RentRollUpload({
  communityId,
  defaultMonth,
  uploadedMonths,
}: {
  communityId: string;
  /** YYYY-MM, computed on the server so render is deterministic. */
  defaultMonth: string;
  /** report_month values (YYYY-MM-01) already uploaded. */
  uploadedMonths: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(defaultMonth);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const monthStart = reportMonthStart(month);
  const replacing = monthStart !== null && uploadedMonths.includes(monthStart);

  function reset() {
    setParsed(null);
    setFileName(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    setParsed(null);
    setFileError(null);
    if (!file) return setFileName(null);
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) {
      setFileError("That file is over 5 MB. Export only the current rent roll and try again.");
      return;
    }
    try {
      const result = parseRentRoll(await file.text());
      if (!result.ok) setFileError(result.error);
      else setParsed(result);
    } catch {
      setFileError("Couldn't read that file. Make sure it's a CSV export.");
    }
  }

  async function onSave() {
    if (!parsed || !monthStart) return;
    setSaving(true);
    try {
      const result = await saveRentRoll({
        communityId,
        reportMonth: month,
        fileName: fileName ?? "rent-roll.csv",
        rows: parsed.rows,
        rowsRejected: parsed.rejected.length,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Saved ${result.saved} leases for ${formatReportMonth(monthStart)}`);
      reset();
      router.refresh();
    } catch {
      toast.error("Couldn't save the rent roll. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-3">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="rent-roll-month">Rent roll month</Label>
          <Input
            id="rent-roll-month"
            type="month"
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="rent-roll-file">CSV file</Label>
          <Input
            id="rent-roll-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {replacing && (
        <p className="text-xs" style={{ color: "var(--nly-text-secondary)" }}>
          You already uploaded {formatReportMonth(monthStart!)}. Saving replaces that month&apos;s upload; other months
          aren&apos;t changed.
        </p>
      )}

      {fileError && (
        <p role="alert" className="text-sm break-words" style={{ color: "var(--nly-error)" }}>
          {fileError}
        </p>
      )}

      {parsed && (
        <div className="space-y-4">
          <div
            className="rounded-xl border p-3 text-sm"
            style={{ borderColor: "var(--nly-border)", backgroundColor: "var(--nly-surface-hover)" }}
          >
            <p style={{ color: "var(--nly-text-primary)" }}>
              <strong>{parsed.rows.length}</strong> {parsed.rows.length === 1 ? "lease" : "leases"} ready to save
              {parsed.rejected.length > 0 ? (
                <>
                  {" · "}
                  <strong>{parsed.rejected.length}</strong> {parsed.rejected.length === 1 ? "row" : "rows"} will be skipped
                </>
              ) : null}
            </p>
            <p className="text-xs mt-1 break-words" style={{ color: "var(--nly-text-tertiary)" }}>
              Read from columns: {parsed.columns.unit} · {parsed.columns.leaseEnd}
              {parsed.columns.outcome
                ? ` · ${parsed.columns.outcome}`
                : " · no outcome column found, so every lease is saved as pending"}
            </p>
          </div>

          {parsed.rejected.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--nly-text-secondary)" }}>
                Rows that will be skipped
              </h4>
              <ul
                className="max-h-48 overflow-y-auto rounded-xl border divide-y text-xs"
                style={{ borderColor: "var(--nly-border)" }}
              >
                {parsed.rejected.map((r) => (
                  <li key={r.row} className="px-3 py-2 flex gap-3" style={{ borderColor: "var(--nly-divider)" }}>
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--nly-text-tertiary)" }}>
                      Row {r.row}
                    </span>
                    <span className="min-w-0 break-words" style={{ color: "var(--nly-text-secondary)" }}>
                      {r.error}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.rows.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--nly-text-secondary)" }}>
                Preview{parsed.rows.length > PREVIEW_ROWS ? ` (first ${PREVIEW_ROWS})` : ""}
              </h4>
              <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--nly-border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "var(--nly-text-tertiary)" }}>
                      <th className="text-left font-medium px-3 py-2">Unit</th>
                      <th className="text-left font-medium px-3 py-2">Lease end</th>
                      <th className="text-left font-medium px-3 py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, PREVIEW_ROWS).map((r) => (
                      <tr key={`${r.unit}|${r.lease_end_date}`} className="border-t" style={{ borderColor: "var(--nly-divider)" }}>
                        <td className="px-3 py-2" style={{ color: "var(--nly-text-primary)" }}>{r.unit}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: "var(--nly-text-secondary)" }}>{r.lease_end_date}</td>
                        <td className="px-3 py-2" style={{ color: "var(--nly-text-secondary)" }}>{OUTCOME_LABEL[r.outcome]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSave} disabled={saving || parsed.rows.length === 0 || !monthStart}>
              <FileUp size={16} />
              {saving ? "Saving…" : replacing ? `Replace ${formatReportMonth(monthStart!)}` : "Save rent roll"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
