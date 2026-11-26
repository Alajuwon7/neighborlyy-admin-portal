-- =====================================================
-- Migration 037: events.hosted_by
-- =====================================================
-- Who put an event on: 'management' or 'resident'.
-- created_by can't say this: management often posts
-- resident-run events from its own app account (role
-- 'admin'). NULL = not set; the portal then derives it
-- from created_by (null or an admin creator = management,
-- anyone else = resident). See lib/event-host.ts.
--
-- Additive and nullable: the mobile app is unaffected.
-- PMs set it through the existing pm_update_events /
-- pm_insert_events policies (migration 034).
--
-- Run in Supabase SQL editor (shared project — do not db push).
-- =====================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS hosted_by text
  CHECK (hosted_by IN ('management', 'resident'));

COMMENT ON COLUMN events.hosted_by IS
  'management | resident. NULL = derive from created_by (portal: lib/event-host.ts).';

-- Backfill: TREND1 events, as confirmed by the property manager on 2026-11-25.
UPDATE events SET hosted_by = 'resident' WHERE id IN (
  '0682ce55-c46a-45a7-9974-826ac495073b', -- Tammy & Toya's Costume Party
  'f6fe99ba-0bdb-4acf-b785-668b62d7b4e5', -- Doughnut Day Delight
  'ea45fa5c-fe12-42a4-9a1a-157bc0a10710', -- Labor Day Cookout
  '08bb79d4-21d3-4d61-95f8-20256d76c080', -- Club Room Game Night - Aug 7
  '99b2dc22-a824-42c2-b68a-478b2f1fcc1d', -- Spades Game Night
  'ab6190ce-b512-4501-aef0-20d326e18d41'  -- Game Faces On - Resident Game Night
);

UPDATE events SET hosted_by = 'management' WHERE id IN (
  '7e376ab0-6135-4422-a30f-b6c97585d825', -- Community Brunch
  '68148e92-2142-4e38-9f7e-e4951221c4df', -- Sip & Paint
  '1d8a661c-2e30-48e1-b2c8-667a2ee53ac4'  -- Pool Party
);
