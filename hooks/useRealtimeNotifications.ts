"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminNotification } from "@/lib/notifications";
import { NOTIFICATION_META } from "@/lib/notifications";
import { toast } from "sonner";

interface UseRealtimeNotificationsOptions {
  communityCodes: string[];
  initialCount: number;
  onNewNotification?: (notification: AdminNotification) => void;
}

export function useRealtimeNotifications({
  communityCodes,
  initialCount,
  onNewNotification,
}: UseRealtimeNotificationsOptions) {
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const supabaseRef = useRef(createClient());
  const callbackRef = useRef(onNewNotification);
  useEffect(() => {
    callbackRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    setUnreadCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (communityCodes.length === 0) return;

    const supabase = supabaseRef.current;
    const channels = communityCodes.map((code) =>
      supabase
        .channel(`notif-${code}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "admin_notifications",
            filter: `community_code=eq.${code}`,
          },
          (payload) => {
            const notification = payload.new as AdminNotification;
            setUnreadCount((prev) => prev + 1);

            const meta = NOTIFICATION_META[notification.type];
            toast(notification.title, {
              description: meta?.label,
              duration: 5000,
            });

            callbackRef.current?.(notification);
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [communityCodes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const decrementCount = useCallback((amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, decrementCount, resetCount };
}
