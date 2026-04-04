import { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accentColor?: string;
}

export function SummaryCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  accentColor = "var(--nly-brand)",
}: SummaryCardProps) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-200 hover:translate-y-[-1px]"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
        boxShadow: "var(--nly-shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
          {label}
        </p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Icon size={18} style={{ color: accentColor }} />
        </div>
      </div>

      <div>
        <p className="text-3xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          {value}
        </p>
        {subtext && (
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {subtext}
          </p>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold"
            style={{
              color: trend.positive ? "var(--nly-success)" : "var(--nly-error)",
            }}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
          <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            vs last month
          </span>
        </div>
      )}
    </div>
  );
}
