"use client";

import { Megaphone } from "lucide-react";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    user_id: string;
  };
}

export function PostCard({ post }: PostCardProps) {
  const date = new Date(post.created_at);

  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(47, 196, 211, 0.1)" }}
        >
          <Megaphone size={14} style={{ color: "var(--nly-brand)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: "rgba(47, 196, 211, 0.1)",
                color: "var(--nly-brand)",
              }}
            >
              Announcement
            </span>
            <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              {date.toLocaleDateString()} at{" "}
              {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            {post.content}
          </p>
          {post.image_url && (
            <img
              src={post.image_url}
              alt="Post attachment"
              className="mt-3 rounded-xl max-h-64 object-cover"
            />
          )}
        </div>
      </div>
    </div>
  );
}
