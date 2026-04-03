export function SkeletonPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ backgroundColor: "var(--nly-surface-hover)" }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div className="flex items-start justify-between">
        <SkeletonPulse className="h-4 w-28" />
        <SkeletonPulse className="h-9 w-9 rounded-xl" />
      </div>
      <div className="space-y-2">
        <SkeletonPulse className="h-8 w-16" />
        <SkeletonPulse className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <header
      className="h-16 flex items-center justify-between px-6 border-b shrink-0"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div className="space-y-2">
        <SkeletonPulse className="h-5 w-48" />
        <SkeletonPulse className="h-3 w-64" />
      </div>
      <SkeletonPulse className="h-8 w-8 rounded-xl" />
    </header>
  );
}

const COL_WIDTHS = ["w-24", "w-36", "w-20", "w-28", "w-16"];

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div className="px-5 py-3 border-b" style={{ borderColor: "var(--nly-border)" }}>
        <div className="flex gap-8">
          {COL_WIDTHS.map((w, i) => (
            <SkeletonPulse key={i} className={`h-3 ${w}`} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-5 py-3.5 flex gap-8 border-b last:border-0"
          style={{ borderColor: "var(--nly-divider)" }}
        >
          {COL_WIDTHS.map((w, j) => (
            <SkeletonPulse key={j} className={`h-4 ${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
