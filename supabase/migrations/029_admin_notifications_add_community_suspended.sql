-- =============================================================================
-- Migration: 029_admin_notifications_add_community_suspended
-- Description: Extend admin_notifications.type CHECK constraint to include
--              'community_suspended' — the offboarding suspend-disposition
--              signal that the mobile workstream consumes for resident push
--              notifications (CC-6 stub in Phase 3 spec).
-- =============================================================================

ALTER TABLE admin_notifications
  DROP CONSTRAINT admin_notifications_type_check;

ALTER TABLE admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'pending_resident',
    'event_rsvp',
    'facility_reservation',
    'help_request',
    'community_suspended'
  ]));
