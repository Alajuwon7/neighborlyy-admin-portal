import { SkeletonHeader, SkeletonTable } from "@/components/dashboard/Skeleton";

export default function TeamLoading() {
  return (
    <div className="flex flex-col flex-1">
      <SkeletonHeader />
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <SkeletonTable rows={5} />
      </main>
    </div>
  );
}
