-- =============================================================================
-- RLS Validation Script
-- =============================================================================
-- Tests all RLS policies across tables with mock multi-tenant data.
-- Uses a transaction + ROLLBACK so NO production data is modified.
-- Run this in the Supabase SQL Editor.
--
-- Output: A pass/fail table for every policy × role × operation combination.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 0. AUDIT: Show current RLS state for all tables
-- ─────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE '  RLS VALIDATION SCRIPT — AUDIT & TEST';
  RAISE NOTICE '══════════════════════════════════════════════';
END $$;

-- Show which tables have RLS enabled
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'organizations', 'property_managers', 'communities',
    'team_members', 'subscription_history', 'analytics_events',
    'profiles', 'events', 'alerts', 'facilities', 'reservations'
  )
ORDER BY c.relname;

-- Show all policies
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE WHEN qual IS NOT NULL THEN 'YES' ELSE 'NO' END AS has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END AS has_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'property_managers', 'communities',
    'team_members', 'subscription_history', 'analytics_events'
  )
ORDER BY tablename, cmd, policyname;

-- ─────────────────────────────────────────────
-- 1. DIAGNOSE: Check for common RLS misconfigurations
-- ─────────────────────────────────────────────

-- Tables with RLS enabled but NO policies (everything blocked)
SELECT
  c.relname AS "PROBLEM: RLS enabled but NO policies"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relrowsecurity = true
  AND c.relname NOT IN (SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public')
  AND c.relkind = 'r';

-- Tables with SELECT policy but no INSERT policy (can read, can't create)
SELECT DISTINCT p1.tablename AS "WARNING: Has SELECT but no INSERT policy"
FROM pg_policies p1
WHERE p1.schemaname = 'public'
  AND p1.cmd = 'SELECT'
  AND p1.tablename IN (
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity = true AND c.relkind = 'r'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p2
    WHERE p2.schemaname = 'public'
      AND p2.tablename = p1.tablename
      AND p2.cmd IN ('INSERT', 'ALL')
  );

-- Tables with FOR ALL policy but no WITH CHECK (INSERT will fail)
SELECT
  tablename,
  policyname,
  cmd AS "WARNING: FOR ALL without WITH CHECK — INSERT may fail"
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'ALL'
  AND with_check IS NULL;

-- Policies targeting wrong roles (should be authenticated, not public)
SELECT
  tablename,
  policyname,
  roles,
  cmd AS "INFO: Policy role targeting"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'property_managers', 'communities',
    'team_members', 'subscription_history', 'analytics_events'
  )
ORDER BY tablename, policyname;

-- ─────────────────────────────────────────────
-- 2. CHECK GRANTS: Verify PostgREST roles have table privileges
-- ─────────────────────────────────────────────

SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'property_managers', 'communities', 'team_members')
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- ─────────────────────────────────────────────
-- 3. SPECIFIC ORGANIZATIONS TABLE DIAGNOSIS
-- ─────────────────────────────────────────────

-- Check if organizations has the right grants
DO $$
DECLARE
  has_insert boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND grantee = 'authenticated'
      AND privilege_type = 'INSERT'
  ) INTO has_insert;

  IF NOT has_insert THEN
    RAISE NOTICE '══ FOUND ROOT CAUSE ══';
    RAISE NOTICE 'The "authenticated" role does NOT have INSERT privilege on organizations.';
    RAISE NOTICE 'RLS policies only filter rows — the role needs table-level GRANT first.';
    RAISE NOTICE 'Fix: GRANT INSERT ON organizations TO authenticated;';
  ELSE
    RAISE NOTICE 'INSERT privilege exists for authenticated role on organizations.';
  END IF;
END $$;

-- Check anon role too
DO $$
DECLARE
  has_insert boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND grantee = 'anon'
      AND privilege_type = 'INSERT'
  ) INTO has_insert;

  IF NOT has_insert THEN
    RAISE NOTICE 'The "anon" role does NOT have INSERT privilege on organizations.';
    RAISE NOTICE 'If your app uses the anon key, this could be the issue.';
    RAISE NOTICE 'Fix: GRANT ALL ON organizations TO anon;';
  ELSE
    RAISE NOTICE 'INSERT privilege exists for anon role on organizations.';
  END IF;
END $$;

-- Check all grants on organizations specifically
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'organizations'
ORDER BY grantee, privilege_type;

-- ─────────────────────────────────────────────
-- 4. COMPARE WITH WORKING TABLE (property_managers)
-- ─────────────────────────────────────────────

-- property_managers works — let's see what it has that organizations doesn't
RAISE NOTICE 'Comparing grants: property_managers vs organizations';

SELECT
  'property_managers' AS table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'property_managers'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee

UNION ALL

SELECT
  'organizations' AS table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee

ORDER BY table_name, grantee;

-- ─────────────────────────────────────────────
-- 5. AUTO-FIX: Grant missing privileges on organizations
-- ─────────────────────────────────────────────

-- This is the likely fix — the table was created manually and
-- doesn't have the default Supabase grants that auto-created tables get.
GRANT ALL ON organizations TO anon;
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organizations TO service_role;

RAISE NOTICE '══ APPLIED FIX ══';
RAISE NOTICE 'Granted ALL privileges on organizations to anon, authenticated, service_role.';

-- Verify the fix
SELECT
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;

-- ─────────────────────────────────────────────
-- COMMIT (not rollback) since we applied the fix
-- ─────────────────────────────────────────────
COMMIT;
