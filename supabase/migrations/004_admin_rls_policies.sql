-- =============================================================================
-- Migration: 004_admin_rls_policies
-- Description: Add RLS SELECT policies so property managers can read data from
--              mobile app tables (profiles, events, alerts, facilities,
--              reservations) scoped to their managed communities.
--              These are additive — existing mobile app policies are unaffected.
-- =============================================================================

-- 1. Profiles — property managers can view residents in their communities
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

-- 2. Events — property managers can view events in their communities
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

-- 3. Alerts — property managers can view alerts in their communities
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

-- 4. Facilities — property managers can view facilities in their communities
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

-- 5. Reservations — property managers can view reservations in their communities
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
