"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AdminNotification } from "@/lib/notifications";

export async function getNotificationCount(
  communityCodes: string[],
): Promise<number> {
  if (communityCodes.length === 0) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .in("community_code", communityCodes)
    .eq("is_read", false);
  return count ?? 0;
}

export async function getRecentNotifications(
  communityCodes: string[],
  limit = 8,
): Promise<AdminNotification[]> {
  if (communityCodes.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_notifications")
    .select("*")
    .in("community_code", communityCodes)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AdminNotification[];
}

export async function getNotifications(
  communityCodes: string[],
  filter: string | null,
  offset = 0,
  limit = 20,
): Promise<{ notifications: AdminNotification[]; total: number }> {
  if (communityCodes.length === 0) return { notifications: [], total: 0 };
  const supabase = await createClient();

  let query = supabase
    .from("admin_notifications")
    .select("*", { count: "exact" })
    .in("community_code", communityCodes)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter && filter !== "all") {
    query = query.eq("type", filter);
  }

  const { data, count } = await query;
  return {
    notifications: (data ?? []) as AdminNotification[],
    total: count ?? 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", id);
  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsRead(
  communityCodes: string[],
): Promise<void> {
  if (communityCodes.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .in("community_code", communityCodes)
    .eq("is_read", false);
  revalidatePath("/dashboard", "layout");
}
