import { getAuthenticatedPM } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { PostFormDialog } from "@/components/community/PostFormDialog";
import { PostCard } from "@/components/community/PostCard";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const { pm } = await getAuthenticatedPM();
  const supabase = await createClient();

  // Get first community
  const { data: communities } = await supabase
    .from("communities")
    .select("id, community_code, name")
    .eq("property_manager_id", pm.id)
    .limit(1);

  const community = (communities as { id: string; community_code: string; name: string }[] | null)?.[0];
  if (!community) redirect("/onboarding");

  // Fetch posts using mobile app schema
  const { data: postsRaw } = await supabase
    .from("posts")
    .select("id, community_code, user_id, content, image_url, is_hidden, created_at, updated_at")
    .eq("community_code", community.community_code)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  const posts = (postsRaw as {
    id: string;
    community_code: string;
    user_id: string;
    content: string;
    image_url: string | null;
    is_hidden: boolean;
    created_at: string;
    updated_at: string;
  }[]) ?? [];

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Community Feed"
        subtitle={`Posts and announcements for ${community.name}`}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-xs"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              {posts.length} post{posts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <PostFormDialog communityCode={community.community_code} />
          </div>
        </div>

        {posts.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center space-y-3"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
            }}
          >
            <p className="text-3xl">📢</p>
            <p className="text-sm font-medium" style={{ color: "var(--nly-text-primary)" }}>
              No announcements yet
            </p>
            <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              Post a welcome message to let residents know you&apos;re here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
