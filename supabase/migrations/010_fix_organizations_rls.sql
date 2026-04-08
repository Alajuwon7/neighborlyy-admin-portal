-- =============================================================================
-- Migration: 010_fix_organizations_rls
-- Description: Fix the "new row violates row-level security policy" error
--              when inserting into the organizations table.
--
-- ROOT CAUSE:
--   The organizations table (created in 008) has RLS enabled and an INSERT
--   policy (added in 009), but the `authenticated` and `anon` PostgreSQL
--   roles were never granted INSERT privilege on the table itself.
--
--   In Supabase, PostgREST connects as the `anon` or `authenticated` role.
--   RLS policies control *which rows* a role can access, but the role must
--   first have the base table-level privilege (GRANT INSERT) to attempt the
--   operation at all. Without the GRANT, PostgreSQL rejects the INSERT with
--   an RLS violation error (not a "permission denied" error), which is
--   misleading.
--
--   Other tables like property_managers and communities work because they
--   received their GRANTs via the Supabase dashboard or initial project
--   setup. The organizations table, created purely via migration SQL,
--   never got those GRANTs.
--
-- TWO APPROACHES BELOW — pick one:
--   Approach A (recommended): Disable RLS entirely. This table is only
--     accessed by the admin portal, never by the mobile app. Application-
--     level auth (Supabase auth + server-side checks) is sufficient.
--   Approach B: Keep RLS enabled and fix the GRANTs + policies properly.
-- =============================================================================


-- =========================================================
-- APPROACH A: Disable RLS (simplest, recommended for admin-only tables)
-- =========================================================
-- Uncomment the lines below and comment out Approach B.

-- DROP POLICY IF EXISTS org_read_own   ON organizations;
-- DROP POLICY IF EXISTS org_update_own ON organizations;
-- DROP POLICY IF EXISTS org_insert_own ON organizations;
-- ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;


-- =========================================================
-- APPROACH B: Keep RLS and fix grants + policies (belt-and-suspenders)
-- =========================================================

-- Step 1: Grant table-level privileges to the authenticated role.
-- This is the critical missing piece. Without this, no RLS policy can
-- authorize an INSERT because the role lacks the base privilege.
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;

-- Also grant to anon in case the insert happens before the session is
-- fully promoted to authenticated (e.g., during signup flows).
-- Remove this line if you're certain all org inserts happen post-login.
GRANT SELECT, INSERT, UPDATE ON organizations TO anon;

-- Step 2: Recreate the INSERT policy with explicit role targeting.
-- The existing policy from 009 targets `public` (the default). We replace
-- it with one explicitly targeting `authenticated` for clarity.
DROP POLICY IF EXISTS org_insert_own ON organizations;

CREATE POLICY org_insert_authenticated ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- Any authenticated user can create an organization. The org is linked to
-- their property_manager record in application code, and subsequent reads
-- are scoped by the org_read_own SELECT policy.

-- Step 3: Ensure the SELECT and UPDATE policies also target authenticated.
-- These already work (meaning the role has SELECT/UPDATE grants from
-- somewhere), but let's be explicit for consistency.
DROP POLICY IF EXISTS org_read_own ON organizations;
CREATE POLICY org_read_own ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM property_managers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS org_update_own ON organizations;
CREATE POLICY org_update_own ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM property_managers WHERE user_id = auth.uid()
    )
  );
