-- =====================================================
-- Migration 017: Add hours of operation to facilities
-- =====================================================
-- Two nullable `time` columns so PMs can set when a
-- facility is open/closed. Rendered on mobile + admin.
-- Run in Supabase SQL editor.
-- =====================================================

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS open_time  time,
  ADD COLUMN IF NOT EXISTS close_time time;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'facilities'
ORDER BY ordinal_position;
