-- =====================================================
-- Migration 016: Facilities write access for PMs
-- =====================================================
-- Migration 004 only gave PMs SELECT on facilities.
-- This adds INSERT/UPDATE/DELETE scoped to communities
-- they (or their organization) manage. Mirrors the
-- org-aware pattern used by admin_notifications (011).
-- Run in Supabase SQL editor.
-- =====================================================

DO $$
BEGIN
  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'facilities' AND policyname = 'pm_insert_facilities'
  ) THEN
    CREATE POLICY "pm_insert_facilities"
      ON facilities FOR INSERT
      TO authenticated
      WITH CHECK (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      );
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'facilities' AND policyname = 'pm_update_facilities'
  ) THEN
    CREATE POLICY "pm_update_facilities"
      ON facilities FOR UPDATE
      TO authenticated
      USING (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      )
      WITH CHECK (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      );
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'facilities' AND policyname = 'pm_delete_facilities'
  ) THEN
    CREATE POLICY "pm_delete_facilities"
      ON facilities FOR DELETE
      TO authenticated
      USING (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      );
  END IF;
END $$;

-- Verify
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'facilities'
ORDER BY policyname;
