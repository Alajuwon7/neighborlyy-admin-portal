import { SkeletonHeader, SkeletonTable } from "@/components/dashboard/Skeleton";

export default function TeamLoading() {
  return (
    <div className="flex flex-col flex-1">
      <SkeletonHeader />
      <main className="flex-1 p-6 space-y-6">
        <SkeletonTable rows={5} />
      </main>
    </div>
  );
}
