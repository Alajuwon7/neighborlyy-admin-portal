-- =====================================================
-- Migration 004: Admin RLS Policies (Idempotent)
-- =====================================================
-- Allows property managers to read mobile app tables
-- Safe to run multiple times
-- =====================================================

-- Policy for profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Property managers can view community residents'
  ) THEN
    CREATE POLICY "Property managers can view community residents"
      ON profiles FOR SELECT
      USING (
        community_code IN (
          SELECT community_code FROM communities
          WHERE property_manager_id IN (
            SELECT id FROM property_managers WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Policy for events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'events'
    AND policyname = 'Property managers can view community events'
  ) THEN
    CREATE POLICY "Property managers can view community events"
      ON events FOR SELECT
      USING (
        community_code IN (
          SELECT community_code FROM communities
          WHERE property_manager_id IN (
            SELECT id FROM property_managers WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Policy for alerts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alerts'
    AND policyname = 'Property managers can view community alerts'
  ) THEN
    CREATE POLICY "Property managers can view community alerts"
      ON alerts FOR SELECT
      USING (
        community_code IN (
          SELECT community_code FROM communities
          WHERE property_manager_id IN (
            SELECT id FROM property_managers WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Policy for facilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'facilities'
    AND policyname = 'Property managers can view community facilities'
  ) THEN
    CREATE POLICY "Property managers can view community facilities"
      ON facilities FOR SELECT
      USING (
        community_code IN (
          SELECT community_code FROM communities
          WHERE property_manager_id IN (
            SELECT id FROM property_managers WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Policy for reservations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reservations'
    AND policyname = 'Property managers can view community reservations'
  ) THEN
    CREATE POLICY "Property managers can view community reservations"
      ON reservations FOR SELECT
      USING (
        community_code IN (
          SELECT community_code FROM communities
          WHERE property_manager_id IN (
            SELECT id FROM property_managers WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Verification query (optional - shows all new policies)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE policyname LIKE 'Property managers can view%'
ORDER BY tablename, policyname;
