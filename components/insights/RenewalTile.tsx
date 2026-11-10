import Link from "next/link";
import { ENGAGED_RULE, RENEWAL_PERIOD_LABEL, renewalNotes, type GroupStat, type RenewalSummary } from "@/lib/renewal";

export type RenewalTileState =
  | { kind: "ready"; summary: RenewalSummary }
  | { kind: "no-data" }
  | { kind: "failed" };

/**
 * "Renewal rate by engagement" — top-row Insights tile. Same shell as the
 * page's other tiles; two columns wide (it holds two numbers and a definition).
 * Shows only rates and lease counts, never names or units. Always covers the
 * last 12 months, whatever the page's range filter (see RENEWAL_PERIOD_LABEL).
 */
export function RenewalTile({ state, uploadHref }: { state: RenewalTileState; uploadHref: string }) {
  return (
    <div
      className="col-span-2 rounded-2xl border p-4 min-w-0"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        Renewal rate by engagement · {RENEWAL_PERIOD_LABEL}
      </p>
      <Body state={state} uploadHref={uploadHref} />
    </div>
  );
}

function Body({ state, uploadHref }: { state: RenewalTileState; uploadHref: string }) {
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
    return <Message>No leases ended in the {RENEWAL_PERIOD_LABEL}.</Message>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <Group label="Engaged" stat={s.engaged} />
        <Group label="Others" stat={s.others} />
      </div>
      <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
        Engaged = took part (as in the activity chart) in at least {ENGAGED_RULE.minWeeks} of every{" "}
        {ENGAGED_RULE.windowWeeks} weeks before the lease ended, counting only weeks since they joined · leases
        ended in the {RENEWAL_PERIOD_LABEL}
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
        {stat.leases === null || stat.renewed === null ? "" : ` · ${stat.renewed} of ${stat.leases} renewed`}
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
