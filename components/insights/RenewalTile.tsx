import Link from "next/link";
import {
  ENGAGED_RULE,
  MIN_GROUP_UNITS,
  formatPeriod,
  nextUpdate,
  renewalNotes,
  type RenewalSnapshot,
} from "@/lib/renewal";

export type RenewalTileState =
  | { kind: "ready"; snapshot: RenewalSnapshot }
  | { kind: "no-data" }
  | { kind: "failed" };

/**
 * "Renewal rates" — top-row Insights tile, two columns wide. Compares three
 * groups side by side; it never claims Miyora causes renewals. Shows rounded
 * rates and a size band only, from the monthly snapshot (lib/renewal.ts).
 */
export function RenewalTile({ state, uploadHref }: { state: RenewalTileState; uploadHref: string }) {
  const period =
    state.kind === "ready" ? formatPeriod(state.snapshot.periodFrom, state.snapshot.periodTo) : "";
  return (
    <div
      className="col-span-2 rounded-2xl border p-4 min-w-0"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        Renewal rates{period ? ` · ${period}` : ""}
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

  const s = state.snapshot;
  const next = nextUpdate(s.snapshotDate);
  if (!s.leasesSeen) {
    return <Message>Your rent roll is saved. Renewal rates update monthly; it will be included on {next}.</Message>;
  }
  if (s.inPeriod === 0) {
    return <Message>No leases ended in {formatPeriod(s.periodFrom, s.periodTo) || "the last 12 months"}.</Message>;
  }

  const notes = renewalNotes(s);
  return (
    <>
      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--nly-text-secondary)" }}>
        Renewal rates for residents who took part, residents who didn&apos;t, and households not on Miyora.
      </p>
      {s.rates ? (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Group label="Took part" rate={s.rates.tookPart} />
          <Group label="Didn't take part" rate={s.rates.others} />
          <Group label="Not on Miyora" rate={s.rates.notOnMiyora} />
        </div>
      ) : (
        <p className="text-sm font-medium mt-2 leading-snug" style={{ color: "var(--nly-text-secondary)" }}>
          Not enough leases yet: each group needs at least {MIN_GROUP_UNITS} households.
        </p>
      )}
      <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
        {s.sizeBand ? `Based on ${s.sizeBand} leases · ` : ""}
        Updated monthly, next on {next} · Took part = posted, commented, asked for help, RSVPed, answered a survey
        or used Connect in at least {ENGAGED_RULE.minWeeks} of every {ENGAGED_RULE.windowWeeks} weeks before the
        lease ended, counting only weeks since they joined · Not on Miyora = no matching resident account (includes
        vacant units and unit-number mismatches)
        {notes.length > 0 ? ` · ${notes.join(" · ")}` : ""}
      </p>
    </>
  );
}

function Group({ label, rate }: { label: string; rate: number }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-semibold" style={{ color: "var(--nly-text-primary)" }}>
        {rate}%
      </p>
      <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--nly-text-tertiary)" }}>
        {label}
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
