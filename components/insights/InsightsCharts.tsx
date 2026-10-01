"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { MonthBucket } from "@/lib/insights";

/*
 * Series colours, validated with the dataviz skill's palette checker against
 * the portal's (dark-only) surface #1A2B3D — lightness band, chroma floor,
 * CVD separation, normal-vision floor, 3:1 contrast all PASS:
 *   #16A3B3  brand cyan stepped down (#2FC4D3 is too light for marks)
 *   #d95926  orange (reference palette slot 2, dark step)
 * Rejected is deliberately NOT red — red is reserved for status/errors.
 */
const APPROVED = "#16A3B3";
const REJECTED = "#d95926";
const SURFACE = "#1A2B3D"; // 2px gaps between adjacent bars use the surface colour

const AXIS_TICK = { fill: "var(--nly-text-tertiary)", fontSize: 11 };
const GRID = "rgba(255, 255, 255, 0.06)";

/** value null = no weekly summary for that week (a gap, not zero). */
export type WeeklyPoint = { label: string; value: number | null };

export function WeeklyTookPartChart({ data }: { data: WeeklyPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--nly-text-tertiary)" }}>
        No weekly summaries yet — the first one publishes on Monday.
      </p>
    );
  }
  return (
    <figure>
      <figcaption className="sr-only">{describeWeekly(data)}</figcaption>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="activeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={APPROVED} stopOpacity={0.25} />
                <stop offset="100%" stopColor={APPROVED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "var(--nly-text-tertiary)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={(props) => <WeeklyTooltip {...props} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              connectNulls={false}
              stroke={APPROVED}
              strokeWidth={2}
              fill="url(#activeFill)"
              dot={false}
              activeDot={{ r: 4, fill: APPROVED, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TableView caption="Residents who took part, by week">
        <thead>
          <tr>
            <Th>Week of</Th>
            <Th align="right">Took part</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <Td>{d.label}</Td>
              <Td align="right">{d.value ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </figure>
  );
}

export function DecisionsChart({ data }: { data: MonthBucket[] }) {
  const approvedTotal = data.reduce((s, d) => s + d.approved, 0);
  const rejectedTotal = data.reduce((s, d) => s + d.rejected, 0);

  return (
    <figure>
      {/* Two series: legend always present, carrying totals so identity is never colour-alone. */}
      <div className="flex items-center gap-4 mb-2 text-xs" style={{ color: "var(--nly-text-secondary)" }}>
        <LegendKey color={APPROVED} label={`Approved · ${approvedTotal}`} />
        <LegendKey color={REJECTED} label={`Rejected · ${rejectedTotal}`} />
      </div>
      <figcaption className="sr-only">
        {`Applications decided per month: ${approvedTotal} approved, ${rejectedTotal} rejected over the last ${data.length} months.`}
      </figcaption>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: "rgba(255, 255, 255, 0.04)" }} content={(props) => <DecisionsTooltip {...props} />} />
            <Bar dataKey="approved" name="Approved" fill={APPROVED} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="rejected" name="Rejected" fill={REJECTED} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView caption="Applications decided per month">
        <thead>
          <tr>
            <Th>Month</Th>
            <Th align="right">Approved</Th>
            <Th align="right">Rejected</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <Td>{d.label}</Td>
              <Td align="right">{d.approved}</Td>
              <Td align="right">{d.rejected}</Td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </figure>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function describeWeekly(data: WeeklyPoint[]): string {
  const known = data.filter((d): d is { label: string; value: number } => d.value !== null);
  if (known.length === 0) return "No weekly data.";
  const peak = known.reduce((a, b) => (b.value > a.value ? b : a));
  const last = known[known.length - 1];
  return `Residents who took part each week over ${data.length} weeks. Peak ${peak.value} (week of ${peak.label}); most recent ${last.value} (week of ${last.label}).`;
}

function TooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: "var(--nly-surface-elevated)", borderColor: "var(--nly-border)", color: "var(--nly-text-primary)" }}
    >
      {children}
    </div>
  );
}

function WeeklyTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as WeeklyPoint;
  return (
    <TooltipShell>
      <p style={{ color: "var(--nly-text-tertiary)" }}>Week of {point.label}</p>
      <p className="font-semibold mt-0.5">
        {point.value === null
          ? "No summary for this week"
          : `${point.value} ${point.value === 1 ? "resident" : "residents"} took part`}
      </p>
    </TooltipShell>
  );
}

function DecisionsTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const month = payload[0].payload as MonthBucket;
  return (
    <TooltipShell>
      <p style={{ color: "var(--nly-text-tertiary)" }}>{month.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5">
        <Swatch color={APPROVED} /> {month.approved} approved
      </p>
      <p className="flex items-center gap-1.5">
        <Swatch color={REJECTED} /> {month.rejected} rejected
      </p>
    </TooltipShell>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />;
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Swatch color={color} />
      {label}
    </span>
  );
}

/** Accessible table view of the same numbers, collapsed by default. */
function TableView({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <details className="mt-3 group">
      <summary className="text-[11px] cursor-pointer select-none" style={{ color: "var(--nly-text-tertiary)" }}>
        View as table
      </summary>
      <table className="w-full mt-2 text-xs">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </details>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`py-1 font-medium ${align === "right" ? "text-right" : "text-left"}`} style={{ color: "var(--nly-text-tertiary)" }}>
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`py-1 ${align === "right" ? "text-right tabular-nums" : "text-left"}`} style={{ color: "var(--nly-text-secondary)" }}>
      {children}
    </td>
  );
}
