import { jsPDF } from "jspdf";
import { formatWait } from "./insights";
import { dayIn, formatIsoDay, safeTimeZone } from "./report-period";
import { adoptionPct, buildAdvice, type SectionAdvice } from "./insights-advice";
import type { InsightsReport } from "./insights-report";

// A4 portrait, millimetres. Light page, Miyora navy + cyan accents.
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // margin
const CW = PAGE_W - M * 2; // content width
const FOOTER_Y = PAGE_H - 9;
const BOTTOM = PAGE_H - 18; // last usable y before the footer
const MAX_CELL_LINES = 6; // a table row must never be taller than a page

type RGB = [number, number, number];
const NAVY: RGB = [11, 21, 32]; // app background
const NAVY_2: RGB = [24, 42, 60];
const BRAND: RGB = [47, 196, 211]; // #2FC4D3
const BRAND_DEEP: RGB = [12, 122, 135]; // cyan dark enough for text on white
const BRAND_MID: RGB = [22, 163, 179];
const BRAND_LIGHT: RGB = [158, 226, 233];
const BRAND_TINT: RGB = [232, 248, 250];
const INK: RGB = [15, 23, 42]; // slate-900
const BODY: RGB = [30, 41, 59]; // slate-800
const MUTED: RGB = [51, 65, 85]; // slate-700
const LINE: RGB = [203, 213, 225]; // slate-300
const PANEL: RGB = [248, 250, 252];
const AMBER: RGB = [161, 98, 7]; // amber-700
const AMBER_TINT: RGB = [254, 243, 199];
const WHITE: RGB = [255, 255, 255];

/**
 * The built-in PDF fonts only cover Latin-1. Map common typography to ASCII
 * and drop anything else (emoji in event titles would otherwise print as
 * garbage).
 */
export function pdfText(s: string): string {
  return s
    .replace(/[–—−]/g, "-")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^ -~¡-ÿ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildInsightsPdf(report: InsightsReport, timeZone?: string | null): ArrayBuffer {
  const tz = safeTimeZone(timeZone);
  const advice = buildAdvice(report);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({
    title: pdfText(`${report.communityName} - Resident Insights - ${report.period.label}`),
    subject: "Resident Insights Report",
    creator: "Miyora",
  });

  let y = M;

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (size: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  const lh = (size: number) => size * 0.42; // line height (mm) for a font size (pt)

  const newPage = () => {
    doc.addPage();
    fill(NAVY);
    doc.rect(0, 0, PAGE_W, 9, "F");
    fill(BRAND);
    doc.rect(0, 9, PAGE_W, 1, "F");
    font(8, "bold");
    color(BRAND);
    doc.text("MIYORA", M, 6);
    font(8);
    color(WHITE);
    doc.text(pdfText(`${report.communityName}  |  Resident Insights`), M + CW, 6, { align: "right" });
    y = 18;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  /** `keepWith`: height of what follows, so a heading never ends a page alone. */
  const section = (n: number, title: string, subtitle?: string, keepWith = 0) => {
    ensure((subtitle ? 30 : 22) + keepWith);
    y += 5;
    fill(BRAND);
    doc.roundedRect(M, y - 5, 7, 7, 1.5, 1.5, "F");
    font(10, "bold");
    color(NAVY);
    doc.text(String(n), M + 3.5, y - 0.2, { align: "center" });
    font(14, "bold");
    color(NAVY);
    doc.text(pdfText(title), M + 10, y);
    y += 3;
    stroke(BRAND);
    doc.setLineWidth(0.6);
    doc.line(M, y, M + CW, y);
    y += 5;
    if (subtitle) {
      font(9);
      color(MUTED);
      const lines = doc.splitTextToSize(pdfText(subtitle), CW);
      doc.text(lines, M, y);
      y += lines.length * lh(9) + 2.5;
    }
  };

  /** Cyan-tinted read-out box, then a "Suggested next steps" list. */
  const adviceBlock = (a: SectionAdvice) => {
    font(9.5);
    const sumLines = doc.splitTextToSize(pdfText(a.summary), CW - 12) as string[];
    const h = 8 + sumLines.length * lh(9.5) + 2;
    ensure(h + 4);
    fill(BRAND_TINT);
    doc.rect(M, y, CW, h, "F");
    fill(BRAND);
    doc.rect(M, y, 1.4, h, "F");
    font(8, "bold");
    color(BRAND_DEEP);
    doc.text("WHAT THIS SHOWS", M + 6, y + 5);
    font(9.5);
    color(BODY);
    doc.text(sumLines, M + 6, y + 10);
    y += h + 4;

    if (a.tips.length === 0) return;
    ensure(14);
    font(8, "bold");
    color(NAVY);
    doc.text("SUGGESTED NEXT STEPS", M, y);
    y += 4.5;
    for (const tip of a.tips) {
      font(9.5);
      const lines = doc.splitTextToSize(pdfText(tip), CW - 7) as string[];
      ensure(lines.length * lh(9.5) + 2);
      fill(BRAND_MID);
      doc.circle(M + 1.6, y - 1.1, 1, "F");
      color(BODY);
      doc.text(lines, M + 5.5, y);
      y += lines.length * lh(9.5) + 2;
    }
    y += 2;
  };

  const kpiGrid = (cards: { label: string; value: string; note: string }[], cols: number) => {
    const gap = 4;
    const w = (CW - gap * (cols - 1)) / cols;
    const h = 27;
    for (let i = 0; i < cards.length; i += cols) {
      ensure(h + gap);
      cards.slice(i, i + cols).forEach((c, j) => {
        const x = M + j * (w + gap);
        fill(WHITE);
        stroke(LINE);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, w, h, 2, 2, "FD");
        fill(BRAND);
        doc.rect(x + 0.2, y + 0.2, w - 0.4, 1.2, "F");
        font(7.5, "bold");
        color(BRAND_DEEP);
        doc.text(pdfText(c.label).toUpperCase(), x + 4, y + 7);
        font(17, "bold");
        color(NAVY);
        doc.text(pdfText(c.value), x + 4, y + 15.5);
        font(8);
        color(MUTED);
        const note = doc.splitTextToSize(pdfText(c.note), w - 8).slice(0, 2);
        doc.text(note, x + 4, y + 20.5);
      });
      y += h + gap;
    }
  };

  const paragraph = (text: string, size = 9.5, c: RGB = BODY) => {
    font(size);
    color(c);
    const lines = doc.splitTextToSize(pdfText(text), CW);
    ensure(lines.length * lh(size) + 2);
    doc.text(lines, M, y);
    y += lines.length * lh(size) + 2;
  };

  type Col = { header: string; width: number; align?: "left" | "right" };
  type Row = { cells: string[]; tags?: ({ text: RGB; bg: RGB } | null)[] };
  const table = (cols: Col[], rows: Row[]) => {
    const pad = 2.5;
    const lineH = 4.2;
    const header = () => {
      ensure(9);
      fill(NAVY);
      doc.rect(M, y, CW, 7.5, "F");
      font(7.5, "bold");
      color(WHITE);
      let x = M;
      for (const c of cols) {
        const tx = c.align === "right" ? x + c.width - pad : x + pad;
        doc.text(c.header.toUpperCase(), tx, y + 5, { align: c.align ?? "left" });
        x += c.width;
      }
      y += 7.5;
    };
    ensure(26); // don't strand the header with a single row at the bottom of a page
    header();
    rows.forEach((r, ri) => {
      // "\n" separates lines within a cell (pdfText would strip it). The
      // first line of column 1 prints bold, so measure it bold.
      const wrapped = r.cells.map((cell, i) =>
        cell
          .split("\n")
          .flatMap((part, pi) => {
            font(9, i === 1 && pi === 0 ? "bold" : "normal");
            return doc.splitTextToSize(pdfText(part), cols[i].width - pad * 2) as string[];
          })
          .slice(0, MAX_CELL_LINES),
      );
      const boldLines = r.cells.map((cell, i) => {
        if (i !== 1) return 0;
        font(9, "bold");
        return (doc.splitTextToSize(pdfText(cell.split("\n")[0]), cols[i].width - pad * 2) as string[]).length;
      });
      const h = Math.max(...wrapped.map((w) => w.length)) * lineH + 3.4;
      if (y + h > BOTTOM) {
        newPage();
        header();
        font(9);
      }
      if (ri % 2 === 1) {
        fill(PANEL);
        doc.rect(M, y, CW, h, "F");
      }
      let x = M;
      wrapped.forEach((lines, i) => {
        const c = cols[i];
        const tag = r.tags?.[i];
        if (tag) {
          font(8, "bold");
          const tw = doc.getTextWidth(lines[0]) + 4;
          fill(tag.bg);
          doc.roundedRect(x + pad - 0.5, y + 1.6, tw, 4.6, 1.2, 1.2, "F");
          color(tag.text);
          doc.text(lines[0], x + pad + 1.5, y + 4.9);
        } else {
          const tx = c.align === "right" ? x + c.width - pad : x + pad;
          const nBold = Math.min(boldLines[i], lines.length);
          if (nBold > 0) {
            font(9, "bold");
            color(INK);
            doc.text(lines.slice(0, nBold), tx, y + 4.9, { align: c.align ?? "left" });
          }
          const rest = lines.slice(nBold);
          if (rest.length) {
            font(nBold > 0 ? 8.5 : 9);
            color(nBold > 0 ? MUTED : BODY);
            doc.text(rest, tx, y + 4.9 + nBold * lineH, { align: c.align ?? "left" });
          }
        }
        x += c.width;
      });
      y += h;
      stroke(LINE);
      doc.setLineWidth(0.2);
      doc.line(M, y, M + CW, y);
    });
  };

  // ── Cover band ─────────────────────────────────────────────────────────
  fill(NAVY);
  doc.rect(0, 0, PAGE_W, 50, "F");
  fill(NAVY_2);
  doc.circle(PAGE_W - 18, 6, 34, "F");
  fill(WHITE);
  doc.rect(0, 50, PAGE_W, 12, "F"); // clip the circle at the band's edge
  fill(BRAND);
  doc.rect(0, 50, PAGE_W, 1.6, "F");

  font(10, "bold");
  color(BRAND);
  doc.text("MIYORA", M, 14);
  const generated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(report.generatedAt);
  font(8.5);
  color(BRAND_LIGHT);
  doc.text(pdfText(`Generated ${generated}`), M + CW, 14, { align: "right" });

  font(24, "bold");
  color(WHITE);
  doc.text("Resident Insights Report", M, 28);
  font(13);
  doc.text(pdfText(report.communityName), M, 36);
  font(10);
  color(BRAND_LIGHT);
  doc.text(pdfText(`${report.period.kind}  |  ${report.period.label}`), M, 43);
  y = 60;

  // ── Summary ───────────────────────────────────────────────────────────
  {
    const colW = CW / 2 - 12;
    font(9.5);
    const hiLines = advice.highlights.filter(Boolean).map((t) => doc.splitTextToSize(pdfText(t), colW) as string[]);
    const tipLines = advice.topTips.map((t) => doc.splitTextToSize(pdfText(t), colW) as string[]);
    const colH = (ls: string[][]) => ls.reduce((s, l) => s + l.length * lh(9.5) + 2.2, 0);
    const h = 12 + Math.max(colH(hiLines), colH(tipLines), 8) + 3;
    ensure(h);
    fill(BRAND_TINT);
    doc.roundedRect(M, y, CW, h, 2.5, 2.5, "F");
    const colX = [M + 5, M + CW / 2 + 3];
    font(8, "bold");
    color(BRAND_DEEP);
    doc.text("PERIOD HIGHLIGHTS", colX[0], y + 7);
    doc.text("TOP SUGGESTIONS", colX[1], y + 7);
    stroke(BRAND_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M + CW / 2 - 1, y + 4, M + CW / 2 - 1, y + h - 4);
    const list = (ls: string[][], x: number, dot: RGB) => {
      let yy = y + 13;
      for (const l of ls) {
        fill(dot);
        doc.circle(x + 1, yy - 1.1, 0.9, "F");
        font(9.5);
        color(BODY);
        doc.text(l, x + 4, yy);
        yy += l.length * lh(9.5) + 2.2;
      }
    };
    list(hiLines, colX[0], NAVY);
    if (tipLines.length) list(tipLines, colX[1], BRAND_MID);
    else {
      font(9.5);
      color(BODY);
      doc.text("Nothing stands out - keep doing what's working.", colX[1], y + 13);
    }
    y += h + 2;
  }

  // ── 1. At a glance ─────────────────────────────────────────────────────
  const d = report.decisions;
  const adoption = adoptionPct(report);
  section(1, "Residents at a glance");
  kpiGrid(
    [
      {
        label: "Residents on Miyora",
        value: report.buildingResidents
          ? `${report.residents.toLocaleString("en-US")} / ${report.buildingResidents.toLocaleString("en-US")}`
          : report.residents.toLocaleString("en-US"),
        note: adoption !== null ? `${adoption}% of the building has joined` : "Approved residents today",
      },
      {
        label: "Active residents",
        value: report.active.toLocaleString("en-US"),
        note:
          report.activeShare === null
            ? "Used the app in this period"
            : `${report.activeShare}% of app users were active in this period`,
      },
      {
        label: "New residents",
        value: `+${d.approved}`,
        note: "Applications approved in this period",
      },
      {
        label: "Approval rate",
        value: d.approvalRate === null ? "-" : `${d.approvalRate}%`,
        note: d.total === 0 ? "No applications decided" : `${d.approved} approved, ${d.rejected} rejected`,
      },
      {
        label: "Typical wait",
        value: report.wait ? formatWait(report.wait.hours) : "-",
        note: report.wait
          ? `Median from applying to a decision (${report.wait.sample} ${report.wait.sample === 1 ? "applicant" : "applicants"})`
          : "No decisions with a known application date",
      },
      {
        label: "Alerts sent",
        value: report.alertsSent.toLocaleString("en-US"),
        note: "Community alerts posted in this period",
      },
    ],
    3,
  );
  adviceBlock(advice.glance);

  // ── 2. Weekly activity chart ──────────────────────────────────────────
  section(
    2,
    "Resident activity, by week",
    "Took part = posted, commented, asked for help, RSVPed, answered a survey or used Connect. Quietly active = opened the app, liked, booked or listed something. Weeks run Monday to Sunday.",
    report.weekly.length ? 76 : 0,
  );
  const weeks = report.weekly;
  if (weeks.length === 0) {
    paragraph("No completed weeks with activity data in this period.");
  } else {
    const eventWeeks = new Set(
      report.events.map((e) => {
        const dt = new Date(e.eventDate);
        const mon = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
        mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7));
        return mon.toISOString().slice(0, 10);
      }),
    );
    const chartH = 54;
    ensure(chartH + 22);
    const top = y + 3;
    const axisX = M + 8;
    const plotW = CW - 8;
    const base = top + chartH;
    const maxV = Math.max(1, ...weeks.map((w) => w.active ?? w.tookPart ?? 0));
    const step = Math.max(1, Math.ceil(maxV / 4));
    const yMax = step * 4;

    for (let i = 0; i <= 4; i++) {
      const gy = base - (chartH * i) / 4;
      stroke(i === 0 ? MUTED : LINE);
      doc.setLineWidth(i === 0 ? 0.3 : 0.15);
      doc.line(axisX, gy, M + CW, gy);
      font(7.5);
      color(MUTED);
      doc.text(String(step * i), axisX - 1.5, gy + 1, { align: "right" });
    }

    const slot = plotW / weeks.length;
    const barW = Math.min(9, slot * 0.68);
    const labelEvery = Math.ceil(weeks.length / 14);
    weeks.forEach((w, i) => {
      const cx = axisX + slot * i + slot / 2;
      const took = w.tookPart ?? 0;
      const quiet = w.quiet ?? 0;
      const hTook = (took / yMax) * chartH;
      const hQuiet = (quiet / yMax) * chartH;
      if (hTook > 0) {
        fill(BRAND_DEEP);
        doc.rect(cx - barW / 2, base - hTook, barW, hTook, "F");
      }
      if (hQuiet > 0) {
        fill(BRAND_LIGHT);
        doc.rect(cx - barW / 2, base - hTook - hQuiet, barW, hQuiet, "F");
      }
      const total = w.active ?? w.tookPart;
      if (weeks.length <= 20 && total !== null) {
        font(7.5, "bold");
        color(NAVY);
        doc.text(String(total), cx, base - hTook - hQuiet - 1.3, { align: "center" });
      }
      if (eventWeeks.has(w.weekStart)) {
        fill(AMBER);
        doc.circle(cx, base + 2.6, 0.9, "F");
      }
      if (i % labelEvery === 0) {
        font(7.5);
        color(MUTED);
        doc.text(w.label, cx, base + 6.8, { align: "center" });
      }
    });

    y = base + 12;
    font(8.5);
    color(BODY);
    fill(BRAND_DEEP);
    doc.rect(M, y - 2.6, 3.2, 3.2, "F");
    doc.text("Took part", M + 4.6, y);
    fill(BRAND_LIGHT);
    doc.rect(M + 26, y - 2.6, 3.2, 3.2, "F");
    doc.text("Quietly active", M + 30.6, y);
    fill(AMBER);
    doc.circle(M + 58.6, y - 1, 0.9, "F");
    doc.text("Week with an event", M + 61, y);
    y += 6;
    if (weeks.some((w) => !w.tracked)) {
      paragraph("Some weeks predate app-open tracking and show taking part only.", 8.5, MUTED);
    }
  }
  adviceBlock(advice.activity);

  // ── 3. Events ──────────────────────────────────────────────────────────
  const ev = report.events;
  const mgmt = ev.filter((e) => e.host === "management").length;
  const res = ev.filter((e) => e.host === "resident").length;
  const totalGoing = ev.reduce((s, e) => s + (e.going ?? 0), 0);
  section(
    3,
    "Events",
    "Events scheduled in this period. RSVPs count residents who marked themselves as going in the app (management accounts excluded).",
  );
  if (ev.length > 0) {
    kpiGrid(
      [
        { label: "Events", value: String(ev.length), note: "Scheduled in this period" },
        {
          label: "Hosted by residents",
          value: report.eventInfoAvailable ? String(res) : "-",
          note: report.eventInfoAvailable ? `${mgmt} hosted by management` : "Host unavailable",
        },
        {
          label: "RSVPs",
          value: report.eventInfoAvailable ? totalGoing.toLocaleString("en-US") : "-",
          note: report.eventInfoAvailable
            ? `${Math.round((totalGoing / ev.length) * 10) / 10} per event on average`
            : "RSVPs unavailable",
        },
      ],
      3,
    );
    const dateFmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });
    table(
      [
        { header: "Date", width: 40 },
        { header: "Event", width: 84 },
        { header: "Host", width: 30 },
        { header: "RSVPs", width: CW - 154, align: "right" },
      ],
      ev.map((e) => ({
        cells: [
          dateFmt.format(new Date(e.eventDate)),
          e.location ? `${e.title}\n${e.location}` : e.title,
          e.host === "management" ? "Management" : e.host === "resident" ? "Residents" : "-",
          e.going === null ? "-" : e.maxAttendees ? `${e.going} / ${e.maxAttendees}` : String(e.going),
        ],
        tags: [
          null,
          null,
          e.host === "management"
            ? { text: BRAND_DEEP, bg: BRAND_TINT }
            : e.host === "resident"
              ? { text: AMBER, bg: AMBER_TINT }
              : null,
          null,
        ],
      })),
    );
    y += 5;
  }
  adviceBlock(advice.events);

  // ── 4. Help requests ──────────────────────────────────────────────────
  const h = report.help;
  section(4, "Help requests", "Neighbours asking each other for help on the help board. Requests made in this period.");
  kpiGrid(
    [
      {
        label: "Requests",
        value: String(h.total),
        note: h.cancelled > 0 ? `${h.cancelled} withdrawn by the resident` : "Asked in this period",
      },
      {
        label: "Completed",
        value: h.completionRate === null ? String(h.completed) : `${h.completionRate}%`,
        note:
          h.completionRate === null
            ? "No requests to complete"
            : `${h.completed} of ${h.total - h.cancelled} (withdrawn excluded)`,
      },
      {
        label: "Time to help",
        value: h.medianResolveHours === null ? "-" : formatWait(h.medianResolveHours),
        note: h.medianResolveHours === null ? "No completed requests" : "Median from asking to completed",
      },
      {
        label: "Open now",
        value: String(report.openHelpNow),
        note:
          `Waiting as of ${formatIsoDay(dayIn(report.generatedAt, tz))}` +
          (report.inProgressHelpNow > 0 ? `; ${report.inProgressHelpNow} in progress` : ""),
      },
    ],
    4,
  );
  if (report.helpCategories.length > 0) {
    ensure(12);
    font(9, "bold");
    color(NAVY);
    y += 1;
    doc.text("What residents ask for", M, y);
    y += 5;
    const maxC = Math.max(1, ...report.helpCategories.map((c) => c.count));
    const labelW = 45;
    const barMax = CW - labelW - 14;
    for (const c of report.helpCategories) {
      ensure(7);
      font(9);
      color(BODY);
      doc.text(doc.splitTextToSize(pdfText(c.label), labelW - 2)[0] as string, M, y + 3);
      fill(PANEL);
      doc.roundedRect(M + labelW, y, barMax, 3.8, 1.2, 1.2, "F");
      fill(BRAND_DEEP);
      doc.roundedRect(M + labelW, y, Math.max(1.5, (c.count / maxC) * barMax), 3.8, 1.2, 1.2, "F");
      font(9, "bold");
      color(NAVY);
      doc.text(String(c.count), M + CW, y + 3, { align: "right" });
      y += 6.8;
    }
    y += 2;
  }
  adviceBlock(advice.help);

  // ── Notes ─────────────────────────────────────────────────────────────
  ensure(30);
  y += 3;
  font(8, "bold");
  color(NAVY);
  doc.text("ABOUT THESE NUMBERS", M, y);
  y += 4.5;
  for (const n of [
    "Residents are approved, non-management accounts; management and staff accounts are excluded from every figure.",
    "Active residents counts anyone who took part or opened the app at least once in the period.",
    "Residents on Miyora and Open now are a snapshot at the time this report was generated; every other figure covers the period above. The building total is the number entered in the portal.",
    "RSVP counts come from the Miyora app. Attendance recorded elsewhere (sign-in sheets, door counts) is not included.",
    "Suggestions are generated from this period's numbers and are a starting point, not a guarantee of results.",
  ]) {
    paragraph(`-  ${n}`, 8.5, MUTED);
  }

  // ── Footer on every page ──────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(BRAND);
    doc.setLineWidth(0.4);
    doc.line(M, FOOTER_Y - 4, M + CW, FOOTER_Y - 4);
    font(8, "bold");
    color(BRAND_DEEP);
    doc.text("MIYORA", M, FOOTER_Y);
    font(8);
    color(MUTED);
    doc.text(pdfText(`${report.communityName}  |  ${report.period.label}`), M + 15, FOOTER_Y);
    doc.text(`Page ${p} of ${pages}`, M + CW, FOOTER_Y, { align: "right" });
  }

  return doc.output("arraybuffer");
}
