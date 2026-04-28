-- =============================================================================
-- Migration: 018_security_advisor_fixes
-- Description: Resolve two Supabase security advisor warnings:
--   1. public.organizations has RLS disabled (was enabled in 008, later
--      disabled — likely via the dashboard). Re-enable with the same
--      policies and grants that 010 set up, written idempotently so it's
--      safe to re-run.
--   2. public.user_rate_limit_status is treated as SECURITY DEFINER because
--      Postgres views default to security_invoker = false. Recreate the
--      view with security_invoker = true so it executes with the querying
--      user's privileges and respects RLS on rate_limits.
--
-- The view is originally defined in the mobile app repo
-- (neighborlyyV2.1/supabase/migrations/20240101010107_rate_limiting.sql).
-- Update that source as well so a fresh project setup doesn't reintroduce
-- the warning.
-- =============================================================================

-- 1. Re-enable RLS on organizations -----------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO anon;

DROP POLICY IF EXISTS org_read_own              ON public.organizations;
DROP POLICY IF EXISTS org_update_own            ON public.organizations;
DROP POLICY IF EXISTS org_insert_own            ON public.organizations;
DROP POLICY IF EXISTS org_insert_authenticated  ON public.organizations;

CREATE POLICY org_insert_authenticated ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY org_read_own ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.property_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY org_update_own ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.property_managers WHERE user_id = auth.uid()
    )
  );

-- 2. Recreate user_rate_limit_status with security_invoker -------------------

DROP VIEW IF EXISTS public.user_rate_limit_status;

CREATE VIEW public.user_rate_limit_status
  WITH (security_invoker = true) AS
SELECT
  user_id,
  action_type,
  SUM(action_count)   AS total_actions,
  MAX(window_start)   AS last_action_window,
  COUNT(*)            AS window_count
FROM public.rate_limits
WHERE window_start >= (now() - interval '1 day')
GROUP BY user_id, action_type;
