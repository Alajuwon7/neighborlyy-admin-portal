import { SkeletonHeader, SkeletonCard, SkeletonPulse } from "@/components/dashboard/Skeleton";

export default function BillingLoading() {
  return (
    <div className="flex flex-col flex-1">
      <SkeletonHeader />
      <main className="flex-1 p-6 space-y-6">
        <SkeletonPulse className="h-4 w-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonPulse className="h-4 w-36" />
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonPulse className="w-4 h-4 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <SkeletonPulse className="h-4 w-40" />
                <SkeletonPulse className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
