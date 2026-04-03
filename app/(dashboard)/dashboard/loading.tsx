import { SkeletonHeader, SkeletonCard, SkeletonPulse } from "@/components/dashboard/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col flex-1">
      <SkeletonHeader />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div
            className="xl:col-span-2 rounded-2xl border p-5 space-y-4"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonPulse className="w-9 h-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonPulse className="h-4 w-32" />
                  <SkeletonPulse className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
          <div
            className="xl:col-span-3 rounded-2xl border p-5 space-y-4"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonPulse className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonPulse className="h-4 w-48" />
                  <SkeletonPulse className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
