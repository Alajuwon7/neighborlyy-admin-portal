-- =============================================================================
-- Migration: 019_function_search_path
-- Description: Pin search_path = public on every public SECURITY DEFINER
--              function that doesn't already have it set. Resolves Supabase's
--              "Function Search Path Mutable" advisor warning.
--
-- Uses pg_proc introspection rather than enumerating signatures because
-- some live functions (e.g. deny_pending_user) have been redefined outside
-- of this repo's migrations and the in-repo signature is stale. The
-- introspective form is signature-agnostic and idempotent — re-runs and
-- overlap with the mobile-repo equivalent are no-ops.
-- =============================================================================

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname                          AS schema_name,
      p.proname                          AS func_name,
      oidvectortypes(p.proargtypes)      AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
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
    RAISE NOTICE 'Pinned search_path on %.%(%)', fn.schema_name, fn.func_name, fn.arg_types;
  END LOOP;
END $$;
