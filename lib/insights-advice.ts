import { formatWait } from "./insights";
import type { InsightsReport } from "./insights-report";

/**
 * Plain-language read-outs and next steps for the PDF report. Every claim is
 * computed from the report's own numbers; tips only fire when the data
 * points at them, so a strong period gets short advice.
 */
export type SectionAdvice = { summary: string; tips: string[] };

export type ReportAdvice = {
  highlights: string[];
  topTips: string[];
  glance: SectionAdvice;
  activity: SectionAdvice;
  events: SectionAdvice;
  help: SectionAdvice;
};

const DAY_MS = 86_400_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function adoptionPct(report: Pick<InsightsReport, "residents" | "buildingResidents">): number | null {
  return report.buildingResidents ? Math.min(100, Math.round((report.residents / report.buildingResidents) * 100)) : null;
}

export function buildAdvice(r: InsightsReport): ReportAdvice {
  const periodDays = Math.max(1, Math.round((r.period.end.getTime() - r.period.start.getTime()) / DAY_MS));
  const adoption = adoptionPct(r);

  // ── At a glance ──────────────────────────────────────────────────────
  const glanceParts: string[] = [];
  glanceParts.push(
    adoption !== null
      ? `${r.residents} of the building's ${r.buildingResidents} residents (${adoption}%) are on Miyora.`
      : `${plural(r.residents, "resident")} ${r.residents === 1 ? "is" : "are"} on Miyora.`,
  );
  glanceParts.push(
    r.activeShare !== null
      ? `${r.active} (${r.activeShare}% of app users) were active during the period.`
      : `${r.active} were active during the period.`,
  );
  if (r.decisions.total > 0) {
    glanceParts.push(
      `${plural(r.decisions.approved, "new resident")} ${r.decisions.approved === 1 ? "was" : "were"} approved` +
        (r.wait ? `, typically within ${formatWait(r.wait.hours).toLowerCase()} of applying.` : "."),
    );
  } else {
    glanceParts.push("No applications were decided.");
  }
  const glanceTips: string[] = [];
  if (adoption === null) {
    glanceTips.push(
      "Add how many people live in the building (Property Details in the portal) so this report can show what share of residents have joined.",
    );
  } else if (adoption < 50) {
    glanceTips.push(
      `About ${100 - adoption}% of the building isn't on Miyora yet. Put the community code in move-in packets, renewal letters and lobby signage - the portal's printable Welcome Flyer has it ready.`,
    );
  }
  if (r.activeShare !== null && r.activeShare < 50 && r.residents > 0) {
    glanceTips.push(
      "Fewer than half of app users were active. A short weekly post, poll or alert gives residents a reason to open the app.",
    );
  }
  if (r.wait && r.wait.hours > 48) {
    glanceTips.push(
      `Applicants waited a median of ${formatWait(r.wait.hours).toLowerCase()} for approval. Reviewing within a day keeps new residents from losing interest before they start.`,
    );
  }

  // ── Weekly activity ──────────────────────────────────────────────────
  const weeks = r.weekly.filter((w) => (w.active ?? w.tookPart) !== null);
  const val = (w: (typeof weeks)[number]) => w.active ?? w.tookPart ?? 0;
  const activity: SectionAdvice = { summary: "", tips: [] };
  let trendPct: number | null = null;
  if (weeks.length === 0) {
    activity.summary = "No completed weeks with activity data fall in this period yet.";
  } else {
    const peak = weeks.reduce((a, b) => (val(b) > val(a) ? b : a));
    const parts = [
      `On average ${round1(avg(weeks.map(val)))} residents were active each week; the busiest week began ${peak.label} (${val(peak)}).`,
    ];
    if (weeks.length >= 6) {
      const k = Math.min(4, Math.floor(weeks.length / 2));
      const first = avg(weeks.slice(0, k).map(val));
      const last = avg(weeks.slice(-k).map(val));
      if (first > 0) {
        trendPct = Math.round(((last - first) / first) * 100);
        parts.push(
          Math.abs(trendPct) < 10
            ? "Activity held steady across the period."
            : `Activity ${trendPct > 0 ? "rose" : "fell"} ${Math.abs(trendPct)}% from the first ${k} weeks to the last ${k}.`,
        );
      }
    }
    activity.summary = parts.join(" ");

    // Weeks with an event vs without.
    const eventWeeks = new Set(
      r.events.map((e) => {
        const d = new Date(e.eventDate);
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
        return monday.toISOString().slice(0, 10);
      }),
    );
    const withEv = weeks.filter((w) => eventWeeks.has(w.weekStart)).map(val);
    const withoutEv = weeks.filter((w) => !eventWeeks.has(w.weekStart)).map(val);
    if (withEv.length >= 2 && withoutEv.length >= 2 && avg(withEv) > avg(withoutEv) * 1.1) {
      activity.tips.push(
        `Weeks with an event averaged ${round1(avg(withEv))} active residents, against ${round1(avg(withoutEv))} in weeks without one. Keeping something on the calendar most weeks should lift the quieter ones.`,
      );
    }
    if (trendPct !== null && trendPct <= -15) {
      activity.tips.push(
        "Activity slipped toward the end of the period. A fresh event, a survey or a building update in the app can restart momentum.",
      );
    }
    const tracked = weeks.filter((w) => w.tracked && w.active);
    const quietShare = tracked.length ? avg(tracked.map((w) => (w.quiet ?? 0) / (w.active || 1))) : 0;
    if (quietShare >= 0.5) {
      activity.tips.push(
        `About ${Math.round(quietShare * 100)}% of active residents mostly browsed without taking part. Ask a question in a post, run a quick poll, or invite RSVPs to turn browsers into participants.`,
      );
    }
  }

  // ── Events ───────────────────────────────────────────────────────────
  const ev = r.events;
  const events: SectionAdvice = { summary: "", tips: [] };
  const perMonth = round1((ev.length / periodDays) * 30);
  if (ev.length === 0) {
    events.summary = "No events were scheduled in this period.";
    events.tips.push(
      "Aim for at least two events a month. Small, low-cost socials (coffee mornings, game nights) give residents a reason to open the app and meet.",
    );
  } else {
    const mgmt = ev.filter((e) => e.host === "management");
    const res = ev.filter((e) => e.host === "resident");
    const going = (xs: typeof ev) => xs.reduce((s, e) => s + (e.going ?? 0), 0);
    const parts = [
      `${plural(ev.length, "event")} (about ${perMonth} a month)` +
        (r.eventInfoAvailable ? `: ${mgmt.length} by management and ${res.length} by residents.` : "."),
    ];
    if (r.eventInfoAvailable) {
      const total = going(ev);
      const top = ev.reduce((a, b) => ((b.going ?? 0) > (a.going ?? 0) ? b : a));
      parts.push(`Together they drew ${plural(total, "RSVP")}, ${round1(total / ev.length)} per event.`);
      if ((top.going ?? 0) > 0) parts.push(`The most popular was "${top.title}" with ${plural(top.going ?? 0, "RSVP")}.`);

      if (mgmt.length && res.length) {
        const m = round1(going(mgmt) / mgmt.length);
        const rr = round1(going(res) / res.length);
        // Only call out a real gap (20%+ and at least one RSVP per event).
        const gap = Math.abs(rr - m) >= 1 && Math.abs(rr - m) >= 0.2 * Math.max(rr, m);
        if (gap && rr > m) {
          events.tips.push(
            `Resident-hosted events averaged ${rr} RSVPs against ${m} for management events. Encourage residents to host, and promote their events in alerts.`,
          );
        } else if (gap && m > rr) {
          events.tips.push(
            `Management events averaged ${m} RSVPs against ${rr} for resident-hosted ones. Offering resident hosts a space, supplies or a shout-out could help their turnout.`,
          );
        }
      } else if (res.length === 0) {
        events.tips.push(
          'No resident-hosted events this period. Invite engaged residents to host something small, and mark it "Hosted by Residents" when you post it.',
        );
      }
      const zero = ev.filter((e) => (e.going ?? 0) === 0 && new Date(e.eventDate) < r.generatedAt);
      if (zero.length) {
        events.tips.push(
          `${plural(zero.length, "event")} got no RSVPs in the app. Post events at least a week ahead and send a reminder alert a day or two before.`,
        );
      }
    }
    if (perMonth < 2) {
      events.tips.push("Aim for at least two events a month to keep residents engaged between bigger occasions.");
    }
    events.summary = parts.join(" ");
  }

  // ── Help requests ────────────────────────────────────────────────────
  const h = r.help;
  const help: SectionAdvice = { summary: "", tips: [] };
  if (h.total === 0) {
    help.summary = "No help requests were made in this period.";
    help.tips.push(
      "Remind residents the help board is there for everyday favours like groceries, pet care or moving help. A single example post often gets it started.",
    );
  } else {
    const top = r.helpCategories[0];
    help.summary =
      `Residents asked each other for help ${plural(h.total, "time")}` +
      (h.completionRate !== null ? `; ${h.completionRate}% of requests were completed` : "") +
      (h.medianResolveHours !== null ? `, typically within ${formatWait(h.medianResolveHours).toLowerCase()}` : "") +
      "." +
      (top ? ` The most common request was ${top.label.toLowerCase()}.` : "");
    if (h.completionRate !== null && h.completionRate < 60) {
      help.tips.push(
        "Fewer than 60% of requests were completed. Spotlighting open requests in a weekly post helps neighbours see who needs a hand.",
      );
    }
    if (r.openHelpNow > 0) {
      help.tips.push(`${plural(r.openHelpNow, "request")} ${r.openHelpNow === 1 ? "is" : "are"} still waiting for a helper right now.`);
    }
  }

  const firstSentence = (t: string) => t.split(/(?<=\.) /)[0];
  const highlights = [`${glanceParts[0]} ${glanceParts[1]}`, firstSentence(activity.summary), firstSentence(events.summary)];
  // One from each section first, so the top list isn't all about one area.
  const sections = [glanceTips, activity.tips, events.tips, help.tips];
  const topTips = [...sections.map((t) => t[0]), ...sections.flatMap((t) => t.slice(1))]
    .filter((t): t is string => !!t)
    .slice(0, 3);

  return {
    highlights,
    topTips,
    glance: { summary: glanceParts.join(" "), tips: glanceTips },
    activity,
    events,
    help,
  };
}
