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
 * "Renewal rates compared" — top-row Insights tile, same size as its
 * neighbours (definitions sit behind "How it's measured"). Compares three
 * groups; it never claims Miyora causes renewals. Shows rounded rates and a
 * size band only, from the monthly snapshot (lib/renewal.ts).
 */
export function RenewalTile({ state, uploadHref }: { state: RenewalTileState; uploadHref: string }) {
  return (
    <div
      className="col-span-2 xl:col-span-1 rounded-2xl border p-4 min-w-0"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        Renewal rates compared
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
  const period = formatPeriod(s.periodFrom, s.periodTo);
  if (!s.leasesSeen) {
    return <Message>Your rent roll is saved. Renewal rates update monthly; it will be included on {next}.</Message>;
  }
  if (s.inPeriod === 0) {
    return <Message>No leases ended in {period || "the last 12 months"}.</Message>;
  }

  const notes = renewalNotes(s);
  return (
    <>
      {s.rates ? (
        <dl className="mt-1.5 space-y-0.5">
          <Group label="Took part" rate={s.rates.tookPart} />
          <Group label="Didn't take part" rate={s.rates.others} />
          <Group label="Not on Miyora" rate={s.rates.notOnMiyora} />
        </dl>
      ) : (
        <p className="text-sm font-medium mt-1.5 leading-snug" style={{ color: "var(--nly-text-secondary)" }}>
          Not enough leases yet: each group needs at least {MIN_GROUP_UNITS} households.
        </p>
      )}
      <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
        {s.sizeBand ? `Based on ${s.sizeBand} leases, ` : "Leases ending "}
        {period}
      </p>
      <details className="mt-1 text-[11px] leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
        <summary className="cursor-pointer underline underline-offset-2 w-fit">How it&apos;s measured</summary>
        <div className="mt-1 space-y-1">
          <p>Renewal rates for residents who took part, residents who didn&apos;t, and households not on Miyora.</p>
          <p>
            Took part = posted, commented, asked for help, RSVPed, answered a survey or used Connect in at least{" "}
            {ENGAGED_RULE.minWeeks} of every {ENGAGED_RULE.windowWeeks} weeks before the lease ended, counting only
            weeks since they joined. Not on Miyora = no matching resident account (includes vacant units and
            unit-number mismatches).
          </p>
          <p>Updated monthly, next on {next}.</p>
          {notes.length > 0 && <p>{notes.join(" · ")}</p>}
        </div>
      </details>
    </>
  );
}

function Group({ label, rate }: { label: string; rate: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <dt className="text-xs min-w-0" style={{ color: "var(--nly-text-secondary)" }}>
        {label}
      </dt>
      <dd className="text-base font-semibold tabular-nums shrink-0" style={{ color: "var(--nly-text-primary)" }}>
        {rate}%
      </dd>
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
