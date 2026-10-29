"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarStack,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
  type XAxisTickContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ActivityWeek } from "@/lib/activity-trend";
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

// PM markers: alerts reuse the app's alert yellow; events are neutral ink.
const MARK_ALERT = "#E8C547";
const MARK_EVENT = "#E8EEF3";

const AXIS_TICK = { fill: "var(--nly-text-tertiary)", fontSize: 11 };
const GRID = "rgba(255, 255, 255, 0.06)";

/** value null = no weekly summary for that week (a gap, not zero). */
export type WeeklyPoint = { label: string; value: number | null };

export function WeeklyTookPartChart({ data }: { data: WeeklyPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--nly-text-tertiary)" }}>
        {EMPTY_WEEKLY_COPY}
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

// ─── Weekly activity (stacked: took part + quietly active) ──────────────────

const EMPTY_WEEKLY_COPY = "No weekly summaries yet — the first one publishes on Monday.";

/** Render row. Recharts can't stack nulls, so nulls become 0 here only —
 * tooltip, caption and table read the real values from `week`. */
type ActivityRow = { label: string; tookPart: number; quiet: number; week: ActivityWeek };

/** Rough width an 11px "Sep 14" label needs, plus breathing room. */
const X_LABEL_SPACE = 46;

export function WeeklyActivityChart({ data }: { data: ActivityWeek[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--nly-text-tertiary)" }}>
        {EMPTY_WEEKLY_COPY}
      </p>
    );
  }
  const rows: ActivityRow[] = data.map((w) => ({
    label: w.label,
    tookPart: w.tookPart ?? 0,
    quiet: w.quiet ?? 0,
    week: w,
  }));
  const marked = data.filter((w) => w.markers.length > 0);

  return (
    <figure>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs"
        style={{ color: "var(--nly-text-secondary)" }}
      >
        <span className="whitespace-nowrap">
          <LegendKey color={REJECTED} label="Took part" />
        </span>
        <span className="whitespace-nowrap">
          <LegendKey color={APPROVED} opacity={QUIET_OPACITY} label="Quietly active" />
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Diamond color={MARK_EVENT} /> Your event
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Diamond color={MARK_ALERT} /> Your alert
        </span>
      </div>
      <figcaption className="sr-only">{describeActivity(data)}</figcaption>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            {marked.map((w) => (
              <ReferenceLine
                key={w.weekStart}
                x={w.label}
                stroke={w.markers.some((m) => m.kind === "alert") ? MARK_ALERT : MARK_EVENT}
                strokeOpacity={0.35}
                strokeDasharray="2 4"
                zIndex={150} // behind the bars (300), above the grid
              />
            ))}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              height={40}
              tick={(props: XAxisTickContentProps) => <ActivityTick {...props} rows={rows} />}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: "rgba(255, 255, 255, 0.04)" }} content={(props) => <ActivityTooltip {...props} />} />
            <BarStack stackId="a" radius={[4, 4, 0, 0]}>
              <Bar dataKey="tookPart" name="Took part" fill={REJECTED} maxBarSize={28} isAnimationActive={false} />
              <Bar
                dataKey="quiet"
                name="Quietly active"
                fill={APPROVED}
                fillOpacity={QUIET_OPACITY}
                maxBarSize={28}
                shape={QuietSlice}
                isAnimationActive={false}
              />
            </BarStack>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView caption="Residents active by week">
        <thead>
          <tr>
            <Th>Week of</Th>
            <Th align="right">Active</Th>
            <Th align="right">Took part</Th>
            <Th align="right">Quietly active</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((w) => (
            <tr key={w.weekStart}>
              <Td>
                {w.label}
                {w.markers.length > 0 && (
                  <span className="block text-[11px]" style={{ color: "var(--nly-text-tertiary)" }}>
                    {w.markers.map(markerText).join(" · ")}
                  </span>
                )}
              </Td>
              <Td align="right">{w.active === null ? "—" : `${w.active} (${pctText(w.pctActive)})`}</Td>
              <Td align="right">{w.tookPart ?? "—"}</Td>
              <Td align="right">{w.tracked ? (w.quiet ?? "—") : "Not tracked"}</Td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </figure>
  );
}

const QUIET_OPACITY = 0.55;

/** Top slice, 2px shorter at its base so a surface gap separates it from "took part". */
function QuietSlice(props: BarShapeProps) {
  const height = Number(props.height ?? 0);
  if (height <= 0) return null;
  const tookPart = (props.payload as ActivityRow | undefined)?.tookPart ?? 0;
  const gap = tookPart > 0 ? Math.min(2, height) : 0;
  return <Rectangle {...props} height={height - gap} />;
}

/** X tick: thinned week labels (latest week always labelled) + ◆ for every marked week. */
function ActivityTick({ x, y, index, width, visibleTicksCount, payload, rows }: XAxisTickContentProps & { rows: ActivityRow[] }) {
  const cx = Number(x);
  const cy = Number(y);
  const slot = Number(width ?? 0) / Math.max(visibleTicksCount, 1);
  const stride = slot > 0 ? Math.max(1, Math.ceil(X_LABEL_SPACE / slot)) : 1;
  const showLabel = (visibleTicksCount - 1 - index) % stride === 0;
  const markers = rows[index]?.week.markers ?? [];
  const hasEvent = markers.some((m) => m.kind === "event");
  const hasAlert = markers.some((m) => m.kind === "alert");
  const glyphs = [hasEvent && MARK_EVENT, hasAlert && MARK_ALERT].filter((c): c is string => !!c);
  return (
    <g>
      {showLabel && (
        <text x={cx} y={cy + 4} dy="0.71em" textAnchor="middle" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize}>
          {payload.value}
        </text>
      )}
      {glyphs.map((color, i) => {
        const gx = cx + (i - (glyphs.length - 1) / 2) * 11;
        const gy = cy + 28;
        return <path key={color} d={`M${gx} ${gy - 5}L${gx + 5} ${gy}L${gx} ${gy + 5}L${gx - 5} ${gy}Z`} fill={color} />;
      })}
    </g>
  );
}

function ActivityTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const w = (payload[0].payload as ActivityRow).week;
  return (
    <TooltipShell>
      <p style={{ color: "var(--nly-text-tertiary)" }}>Week of {w.label}</p>
      <p className="font-semibold mt-0.5">
        {w.active === null ? "No activity data for this week" : `${w.active} active (${pctText(w.pctActive)} of residents)`}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5">
        <Swatch color={REJECTED} /> {w.tookPart === null ? "No weekly summary" : `${w.tookPart} took part`}
      </p>
      <p className="flex items-center gap-1.5">
        <Swatch color={APPROVED} opacity={QUIET_OPACITY} />
        {w.tracked && w.quiet !== null ? `${w.quiet} quietly active` : "Quiet activity not tracked yet"}
      </p>
      {w.markers.map((m, i) => (
        <p key={i} className="mt-0.5 flex items-center gap-1.5">
          <Diamond color={m.kind === "alert" ? MARK_ALERT : MARK_EVENT} /> {m.title}
        </p>
      ))}
    </TooltipShell>
  );
}

function pctText(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

function markerText(m: ActivityWeek["markers"][number]): string {
  return `${m.kind === "alert" ? "Alert" : "Event"}: ${m.title}`;
}

function describeActivity(data: ActivityWeek[]): string {
  const weeks = data.map((w) => {
    let s: string;
    if (!w.tracked) {
      s = w.tookPart === null ? "no data" : `${w.tookPart} took part only`;
    } else if (w.active === null) {
      s = "no data";
    } else {
      const pct = w.pctActive === null ? "" : ` (${w.pctActive}% of residents)`;
      const took = w.tookPart === null ? "no weekly summary" : `${w.tookPart} took part`;
      s = `${w.active} active${pct}, ${took}, ${w.quiet ?? 0} quietly active`;
    }
    const marks = w.markers.length ? `; ${w.markers.map(markerText).join("; ")}` : "";
    return `Week of ${w.label}: ${s}${marks}.`;
  });
  return `Residents active each week over ${data.length} weeks, split into took part and quietly active. ${weeks.join(" ")}`;
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

function Swatch({ color, opacity }: { color: string; opacity?: number }) {
  return <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity }} />;
}

function Diamond({ color }: { color: string }) {
  return (
    <span aria-hidden className="text-[13px] leading-none" style={{ color }}>
      ◆
    </span>
  );
}

function LegendKey({ color, label, opacity }: { color: string; label: string; opacity?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <Swatch color={color} opacity={opacity} />
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
