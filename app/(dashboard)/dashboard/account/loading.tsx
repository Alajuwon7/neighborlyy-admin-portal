import { SkeletonHeader, SkeletonPulse } from "@/components/dashboard/Skeleton";

export default function AccountLoading() {
  return (
    <div className="flex flex-col flex-1">
      <SkeletonHeader />
      <main className="flex-1 p-6 space-y-6">
        {[1, 2].map((section) => (
          <div
            key={section}
            className="rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
          >
            <SkeletonPulse className="h-4 w-36" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: section === 1 ? 4 : 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <SkeletonPulse className="h-3 w-20" />
                  <SkeletonPulse className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
            <SkeletonPulse className="h-9 w-28 rounded-md" />
          </div>
        ))}
      </main>
    </div>
  );
}
