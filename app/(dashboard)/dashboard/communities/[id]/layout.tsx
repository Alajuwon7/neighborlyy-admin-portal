import { getCommunityWithAuth } from "@/lib/queries";
import { CommunitySubNav } from "@/components/community/CommunitySubNav";

export const dynamic = "force-dynamic";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { community } = await getCommunityWithAuth(id);

  return (
    <div className="flex flex-col flex-1">
      {/* Community header */}
      <div
        className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b relative overflow-hidden"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        {/* Subtle accent gradient */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            background: `radial-gradient(ellipse 60% 100% at 0% 50%, ${community.primary_color ?? "var(--nly-brand)"} 0%, transparent 70%)`,
          }}
        />
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 relative"
          style={{ backgroundColor: community.primary_color ?? "var(--nly-brand)" }}
        >
          {community.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1
            className="text-base font-semibold truncate"
            style={{ color: "var(--nly-text-primary)" }}
          >
            {community.name}
          </h1>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {community.city && community.state
              ? `${community.city}, ${community.state} · `
              : ""}
            {community.unit_count != null
              ? `${community.unit_count} units · `
              : ""}
            Code: {community.community_code}
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            backgroundColor:
              community.status === "active"
                ? "rgba(16, 185, 129, 0.1)"
                : community.status === "trial"
                ? "rgba(245, 158, 11, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color:
              community.status === "active"
                ? "var(--nly-success)"
                : community.status === "trial"
                ? "var(--nly-warning)"
                : "var(--nly-error)",
          }}
        >
          {community.status}
        </span>
      </div>

      {/* Sub-navigation */}
      <CommunitySubNav communityId={id} />

      {/* Page content */}
      {children}
    </div>
  );
}
