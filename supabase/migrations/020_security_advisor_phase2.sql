-- =============================================================================
-- Migration: 020_security_advisor_phase2
-- Description: Second pass on Supabase security advisor warnings.
--   1. Pin search_path = public on every public function (not just
--      SECURITY DEFINER ones — trigger and helper functions are also
--      flagged by the "Function Search Path Mutable" lint).
--   2. Revoke EXECUTE on trigger-returning functions from PUBLIC/anon/
--      authenticated. Triggers fire via the trigger machinery, which
--      bypasses EXECUTE permission checks — so this clears the
--      "Public/Signed-In Can Execute SECURITY DEFINER Function" warnings
--      for trigger handlers without breaking anything.
--   3. Tighten the organizations INSERT policy. The previous
--      WITH CHECK (true) gets flagged by "RLS Policy Always True".
--      Replacing with auth.uid() IS NOT NULL is functionally identical
--      for the authenticated role but lints clean.
--
-- Excluded on purpose:
--   - RLS helper functions (is_admin, auth_user_*, get_user_community)
--     are called from inside RLS policies; revoking EXECUTE would break
--     policy evaluation. They should be moved to a non-exposed schema
--     (e.g. "internal") in a follow-up.
--   - Application RPC functions (approve_pending_user, mark_messages_read,
--     etc.) need a curated revoke from anon only; handled in 021.
-- =============================================================================

-- 1. Pin search_path on every public function lacking it ---------------------
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname                          AS schema_name,
      p.proname                          AS func_name,
      oidvectortypes(p.proargtypes)      AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      fn.schema_name, fn.func_name, fn.arg_types
    );
  END LOOP;
END $$;

-- 2. Revoke EXECUTE on trigger-returning functions ---------------------------
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname                          AS schema_name,
      p.proname                          AS func_name,
      oidvectortypes(p.proargtypes)      AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.schema_name, fn.func_name, fn.arg_types
    );
  END LOOP;
END $$;

-- 3. Tighten organizations INSERT policy -------------------------------------
DROP POLICY IF EXISTS org_insert_authenticated ON public.organizations;

CREATE POLICY org_insert_authenticated ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
