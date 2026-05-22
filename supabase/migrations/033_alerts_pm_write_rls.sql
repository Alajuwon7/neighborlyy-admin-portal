-- =====================================================
-- Migration 033: Alerts write access for PMs
-- =====================================================
-- Migration 004 only gave PMs SELECT on alerts, so the
-- portal's "Send Alert" insert was blocked by RLS
-- (42501: new row violates row-level security policy).
-- This adds INSERT/UPDATE/DELETE scoped to communities
-- they (or their organization) manage. Mirrors the
-- facilities pattern (016).
--
-- NOTE: alerts.created_by FKs to profiles.id. Property
-- managers are NOT in profiles, so PM-authored alerts are
-- inserted with created_by = NULL (column is nullable).
-- These policies intentionally do not constrain created_by.
--
-- Run in Supabase SQL editor (shared project — do not db push).
-- =====================================================

DO $$
BEGIN
  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alerts' AND policyname = 'pm_insert_alerts'
  ) THEN
    CREATE POLICY "pm_insert_alerts"
      ON alerts FOR INSERT
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
    WHERE tablename = 'alerts' AND policyname = 'pm_update_alerts'
  ) THEN
    CREATE POLICY "pm_update_alerts"
      ON alerts FOR UPDATE
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
    WHERE tablename = 'alerts' AND policyname = 'pm_delete_alerts'
  ) THEN
    CREATE POLICY "pm_delete_alerts"
      ON alerts FOR DELETE
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
WHERE tablename = 'alerts'
ORDER BY policyname;
