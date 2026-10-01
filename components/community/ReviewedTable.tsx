import { Check, X } from "lucide-react";

export type ReviewedRow = {
  id: string;
  name: string;
  email: string;
  decision: "approved" | "rejected";
  reason: string | null;
  decidedAt: string;
  /** "4 minutes"-style, or "—" when the application date is unknown. */
  waited: string;
  /** "You" / a mobile admin's name / "Another admin" / "Not recorded". */
  decidedBy: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Server-rendered, so format deterministically (UTC) rather than with the
// server's locale/zone.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Read-only decision history from the user_application_decisions ledger. */
export function ReviewedTable({ rows, emptyText }: { rows: ReviewedRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-x-auto"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <table className="w-full text-sm min-w-[40rem]">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--nly-border)" }}>
            {["Applicant", "Decision", "Waited", "Decided by", "Date"].map((h) => (
              <th
                key={h}
                scope="col"
                className="text-left text-xs font-medium px-4 py-3"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const approved = r.decision === "approved";
            return (
              <tr key={r.id} className="border-b last:border-b-0 align-top" style={{ borderColor: "var(--nly-divider)" }}>
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: "var(--nly-text-primary)" }}>
                    {r.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                    {r.email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {/* Icon + label, never colour alone. */}
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: approved ? "rgba(16, 185, 129, 0.12)" : "rgba(217, 89, 38, 0.14)",
                      color: approved ? "var(--nly-success)" : "#E8794C",
                    }}
                  >
                    {approved ? <Check size={12} /> : <X size={12} />}
                    {approved ? "Approved" : "Rejected"}
                  </span>
                  {r.reason && (
                    <p className="text-xs mt-1.5 max-w-xs" style={{ color: "var(--nly-text-secondary)" }}>
                      &ldquo;{r.reason}&rdquo;
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--nly-text-secondary)" }}>
                  {r.waited}
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--nly-text-secondary)" }}>
                  {r.decidedBy}
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--nly-text-tertiary)" }}>
                  {formatDate(r.decidedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
