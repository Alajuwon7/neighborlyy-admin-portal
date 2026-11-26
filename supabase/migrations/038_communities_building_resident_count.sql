-- =====================================================
-- Migration 038: communities.building_resident_count
-- =====================================================
-- How many people live in the building (from the PM's own
-- records), so the portal can show adoption: residents on
-- the app out of everyone who lives there. Units (unit_count)
-- stay separate. NULL = not set yet.
--
-- Additive and nullable: the mobile app is unaffected. PMs
-- write it through their existing communities UPDATE access
-- (the same path the complete-setup page uses).
--
-- Run in Supabase SQL editor (shared project — do not db push).
-- =====================================================

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS building_resident_count integer
  CHECK (building_resident_count IS NULL OR building_resident_count BETWEEN 1 AND 100000);

COMMENT ON COLUMN communities.building_resident_count IS
  'People living in the building per the PM (not app users). NULL = not set.';

-- Circle-75, as given by the property manager on 2026-11-25.
UPDATE communities SET building_resident_count = 521 WHERE community_code = 'TREND1';
