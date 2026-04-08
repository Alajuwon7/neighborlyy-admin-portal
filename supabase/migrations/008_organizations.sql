-- =============================================================================
-- Migration: 008_organizations
-- Description: Add organizations table to support corporations managing
--              multiple properties. Links property_managers and communities
--              to an organization.
-- =============================================================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'company')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 2. Add organization_id FK to property_managers and communities
ALTER TABLE property_managers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;

-- 3. Backfill: create an individual organization for each existing PM
-- and link their communities
DO $$
DECLARE
  pm RECORD;
  org_id uuid;
BEGIN
  FOR pm IN SELECT id, full_name, company_name FROM property_managers LOOP
    INSERT INTO organizations (name, type)
    VALUES (
      COALESCE(pm.company_name, pm.full_name),
      CASE WHEN pm.company_name IS NOT NULL THEN 'company' ELSE 'individual' END
    )
    RETURNING id INTO org_id;

    UPDATE property_managers SET organization_id = org_id WHERE id = pm.id;
    UPDATE communities SET organization_id = org_id WHERE property_manager_id = pm.id;
  END LOOP;
END $$;

-- 4. Enable RLS on organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_read_own ON organizations FOR SELECT USING (
  id IN (
    SELECT organization_id FROM property_managers WHERE user_id = auth.uid()
  )
);

CREATE POLICY org_update_own ON organizations FOR UPDATE USING (
  id IN (
    SELECT organization_id FROM property_managers WHERE user_id = auth.uid()
  )
);

-- 5. Update communities RLS policy to allow org-level access
-- Drop old PM-only policy and replace with org-based policy
DROP POLICY IF EXISTS comm_all_own ON communities;

CREATE POLICY comm_all_own ON communities FOR ALL USING (
  organization_id IN (
    SELECT organization_id FROM property_managers WHERE user_id = auth.uid()
  )
);

-- 6. Updated_at trigger for organizations
CREATE OR REPLACE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
