import { SkeletonHeader, SkeletonPulse } from "@/components/dashboard/Skeleton";

export default function CommunitiesLoading() {
  return (
    <div className="flex flex-col flex-1">
      <SkeletonHeader />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-4 w-28" />
          <SkeletonPulse className="h-9 w-36 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-5 space-y-4"
              style={{
                backgroundColor: "var(--nly-surface)",
                borderColor: "var(--nly-border)",
              }}
            >
              <div className="flex items-start gap-3">
                <SkeletonPulse className="w-11 h-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonPulse className="h-4 w-40" />
                  <SkeletonPulse className="h-3 w-24" />
                </div>
              </div>
              <div className="flex gap-4 pt-3 border-t" style={{ borderColor: "var(--nly-divider)" }}>
                <SkeletonPulse className="h-3 w-16" />
                <SkeletonPulse className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
