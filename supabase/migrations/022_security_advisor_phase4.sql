-- =============================================================================
-- Migration: 022_security_advisor_phase4
-- Description: Final cleanup pass on Supabase security advisor warnings.
--
--   1. Properly revoke anon access on RPCs. The previous migration (021)
--      ran REVOKE EXECUTE FROM anon, but Supabase grants EXECUTE to
--      PUBLIC by default — and revoking from anon does NOT remove the
--      inherited PUBLIC grant. The correct pattern is:
--          REVOKE EXECUTE ... FROM PUBLIC;
--          GRANT  EXECUTE ... TO authenticated;
--      That removes the inherited grant for anon while preserving
--      explicit access for signed-in users.
--
--   2. Drop the dead `service_insert_notifications` policy on
--      admin_notifications. The only writer is fn_notify_admin (a
--      SECURITY DEFINER trigger function that bypasses RLS), so the
--      WITH CHECK (true) policy serves no purpose.
--
--   3. Drop the abandoned `notifications_old` table — leftover from a
--      RENAME TO in mobile migration 20260411000004 when the new
--      notifications schema landed.
--
-- After this migration the only remaining advisor warnings will be the
-- accepted/intentional ones:
--   - create_pending_user / create_admin_profile (signup needs anon).
--   - The 11 authenticated_security_definer warnings on legitimate
--     authenticated APIs.
--   - 2 dashboard auth-config items (HIBP + MFA, user action).
-- =============================================================================

-- 1. Proper REVOKE/GRANT pattern on authenticated-only RPCs ------------------

-- approve / deny pending user (admin RPCs, admin-portal-defined)
REVOKE EXECUTE ON FUNCTION public.approve_pending_user(uuid)                         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_pending_user(uuid)                         TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.deny_pending_user(uuid, text, uuid)                FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deny_pending_user(uuid, text, uuid)                TO   authenticated;

-- approve / deny reservation (admin RPCs, mobile-defined)
REVOKE EXECUTE ON FUNCTION public.approve_reservation(uuid, uuid, text)              FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_reservation(uuid, uuid, text)              TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.deny_reservation(uuid, uuid, text, text)           FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deny_reservation(uuid, uuid, text, text)           TO   authenticated;

-- messaging / notifications RPCs
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid)                           FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_messages_read(uuid)                           TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid)                  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid)                  TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(uuid)                FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_unread_notification_count(uuid)                TO   authenticated;

-- moderation RPC
REVOKE EXECUTE ON FUNCTION public.get_pending_reports(text)                          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_pending_reports(text)                          TO   authenticated;

-- rate-limit RPCs (called server-side from authenticated app code)
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, interval)    FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, interval)    TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.record_action(uuid, text)                          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_action(uuid, text)                          TO   authenticated;

-- 2. Drop the dead admin_notifications policy --------------------------------

DROP POLICY IF EXISTS service_insert_notifications ON public.admin_notifications;

-- 3. Drop the abandoned notifications_old table ------------------------------

DROP TABLE IF EXISTS public.notifications_old;
