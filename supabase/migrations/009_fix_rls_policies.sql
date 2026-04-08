-- =============================================================================
-- Migration: 009_fix_rls_policies
-- Description: Fix RLS policies for organizations and communities.
--   - Add INSERT policy on organizations (was missing — users couldn't create orgs)
--   - Fix communities policy to also allow access via property_manager_id
--     (for PMs who don't have an organization yet)
-- =============================================================================

-- 1. Allow authenticated users to INSERT into organizations
CREATE POLICY org_insert_own ON organizations FOR INSERT
  WITH CHECK (true);
-- Any authenticated user can create an org. The org gets linked to their PM record
-- in the application layer, and subsequent reads are scoped by org_read_own.

-- 2. Fix communities policy to handle both org-based and PM-based access
DROP POLICY IF EXISTS comm_all_own ON communities;

CREATE POLICY comm_all_own ON communities FOR ALL USING (
  -- Org-based access: PM's org matches the community's org
  organization_id IN (
    SELECT organization_id FROM property_managers WHERE user_id = auth.uid()
  )
  OR
  -- Direct PM access: fallback for PMs without an org or communities without an org
  property_manager_id IN (
    SELECT id FROM property_managers WHERE user_id = auth.uid()
  )
);
