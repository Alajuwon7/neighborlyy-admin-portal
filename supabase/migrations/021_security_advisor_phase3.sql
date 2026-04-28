-- =============================================================================
-- Migration: 021_security_advisor_phase3
-- Description: Third pass on Supabase security advisor warnings.
--   1. Move RLS helper functions from public to a private "internal"
--      schema. PostgREST only exposes public, so this un-exposes them
--      via /rest/v1/rpc/* without breaking the ~30 RLS policies that
--      call them — those policies resolve the function by OID, and OID
--      survives a schema move.
--   2. Revoke EXECUTE from anon on the application RPCs that should
--      only be called by authenticated users. These functions remain
--      callable by `authenticated`; the advisor still flags that as a
--      warning, which is accepted (these are intentional public
--      authenticated APIs).
--
-- Functions intentionally NOT touched:
--   - create_pending_user, create_admin_profile: signup flows that need
--     anon access by design.
--   - cleanup_rate_limits: cron-only maintenance — revoked from BOTH
--     anon and authenticated.
-- =============================================================================

-- 1. Move RLS helpers to internal schema -------------------------------------

CREATE SCHEMA IF NOT EXISTS internal;

-- Policies need to reach the function during evaluation; that requires
-- USAGE on the schema for the calling roles.
GRANT USAGE ON SCHEMA internal TO authenticated, anon;

ALTER FUNCTION public.is_admin(uuid)                  SET SCHEMA internal;
ALTER FUNCTION public.get_user_community(uuid)        SET SCHEMA internal;
ALTER FUNCTION public.auth_user_community_code()      SET SCHEMA internal;
ALTER FUNCTION public.auth_user_is_admin()            SET SCHEMA internal;
ALTER FUNCTION public.auth_user_is_admin_in(text)     SET SCHEMA internal;

-- 2. Revoke anon access on authenticated-only RPCs ---------------------------

REVOKE EXECUTE ON FUNCTION public.approve_pending_user(uuid)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.deny_pending_user(uuid, text, uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_reservation(uuid, uuid, text)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.deny_reservation(uuid, uuid, text, text)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid)                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pending_reports(text)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, interval)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_action(uuid, text)                                    FROM anon;

-- cleanup_rate_limits is a maintenance cron — no end user should call it.
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM anon, authenticated, PUBLIC;
