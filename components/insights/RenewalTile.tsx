import Link from "next/link";
import { ENGAGED_RULE, renewalNotes, type GroupStat, type RenewalSummary } from "@/lib/renewal";

export type RenewalTileState =
  | { kind: "ready"; summary: RenewalSummary }
  | { kind: "no-data" }
  | { kind: "failed" };

/**
 * "Renewal rate by engagement" — top-row Insights tile. Same shell as the
 * page's other tiles; spans both columns on phones (it holds two numbers).
 * Shows only rates and lease counts, never names or units.
 */
export function RenewalTile({
  state,
  rangeLabel,
  uploadHref,
}: {
  state: RenewalTileState;
  rangeLabel: string;
  uploadHref: string;
}) {
  return (
    <div
      className="col-span-2 xl:col-span-1 rounded-2xl border p-4 min-w-0"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        Renewal rate by engagement
      </p>
      <Body state={state} rangeLabel={rangeLabel} uploadHref={uploadHref} />
    </div>
  );
}

function Body({ state, rangeLabel, uploadHref }: { state: RenewalTileState; rangeLabel: string; uploadHref: string }) {
  if (state.kind === "failed") {
    return <Message>Renewals are unavailable right now. Refresh to try again.</Message>;
  }
  if (state.kind === "no-data") {
    return (
      <Message>
        <Link href={uploadHref} className="underline underline-offset-2" style={{ color: "var(--nly-brand)" }}>
          Upload a rent roll
        </Link>{" "}
        to see renewals
      </Message>
    );
  }

  const s = state.summary;
  const notes = renewalNotes(s);
  if (s.total === 0) {
    return <Message>No leases ended in the last {rangeLabel}.</Message>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <Group label="Engaged" stat={s.engaged} />
        <Group label="Others" stat={s.others} />
      </div>
      <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
        Engaged = posted, commented, liked, RSVPed, booked, listed, asked for help, answered a survey or used Connect in{" "}
        {ENGAGED_RULE.minWeeks}+ of the {ENGAGED_RULE.windowWeeks} weeks before the lease ended · leases ended in the last{" "}
        {rangeLabel}
        {notes.length > 0 ? ` · ${notes.join(" · ")}` : ""}
      </p>
    </>
  );
}

function Group({ label, stat }: { label: string; stat: GroupStat }) {
  return (
    <div className="min-w-0">
      {stat.rate === null ? (
        <p className="text-sm font-medium mt-1.5 leading-tight" style={{ color: "var(--nly-text-secondary)" }}>
          Not enough leases yet
        </p>
      ) : (
        <p className="text-2xl font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          {stat.rate}%
        </p>
      )}
      <p className="text-[11px] mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
        {label}
        {stat.rate === null ? "" : ` · ${stat.renewed} of ${stat.leases} renewed`}
      </p>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm mt-2 leading-snug" style={{ color: "var(--nly-text-secondary)" }}>
      {children}
    </p>
  );
}
