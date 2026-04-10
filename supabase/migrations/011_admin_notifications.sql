-- =====================================================
-- Migration 011: Admin Notifications System
-- =====================================================
-- Creates admin_notifications table with triggers on
-- profiles, event_rsvps, reservations, help_requests
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_code text NOT NULL,
  type text NOT NULL CHECK (type IN ('pending_resident', 'event_rsvp', 'facility_reservation', 'help_request')),
  title text NOT NULL,
  body text,
  actor_name text,
  reference_id uuid,
  reference_table text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_admin_notif_unread
  ON admin_notifications (community_code, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notif_timeline
  ON admin_notifications (community_code, created_at DESC);

-- 3. GRANTs (required for tables created via raw SQL)
GRANT ALL ON admin_notifications TO anon, authenticated, service_role;

-- 4. Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_notifications'
    AND policyname = 'pm_read_notifications'
  ) THEN
    CREATE POLICY "pm_read_notifications"
      ON admin_notifications FOR SELECT
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_notifications'
    AND policyname = 'pm_update_notifications'
  ) THEN
    CREATE POLICY "pm_update_notifications"
      ON admin_notifications FOR UPDATE
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
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_notifications'
    AND policyname = 'service_insert_notifications'
  ) THEN
    CREATE POLICY "service_insert_notifications"
      ON admin_notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- 6. Trigger function
CREATE OR REPLACE FUNCTION fn_notify_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title text;
  v_body text;
  v_actor text;
  v_type text;
  v_community_code text;
  v_reference_id uuid;
  v_profile_name text;
  v_event_title text;
  v_facility_name text;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    v_type := 'pending_resident';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    v_actor := NEW.full_name;
    v_title := 'New join request';
    v_body := NEW.full_name || COALESCE(' — Unit ' || NEW.unit_number, '');

  ELSIF TG_TABLE_NAME = 'event_rsvps' THEN
    v_type := 'event_rsvp';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    SELECT full_name INTO v_profile_name
      FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    SELECT title INTO v_event_title
      FROM events WHERE id = NEW.event_id LIMIT 1;
    v_actor := COALESCE(v_profile_name, 'A resident');
    v_title := 'New event RSVP';
    v_body := v_actor || ' responded to ' || COALESCE(v_event_title, 'an event');

  ELSIF TG_TABLE_NAME = 'reservations' THEN
    v_type := 'facility_reservation';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    SELECT full_name INTO v_profile_name
      FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    SELECT name INTO v_facility_name
      FROM facilities WHERE id = NEW.facility_id LIMIT 1;
    v_actor := COALESCE(v_profile_name, 'A resident');
    v_title := 'Reservation request';
    v_body := v_actor || ' — ' || COALESCE(v_facility_name, 'a facility');

  ELSIF TG_TABLE_NAME = 'help_requests' THEN
    v_type := 'help_request';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    SELECT full_name INTO v_profile_name
      FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    v_actor := COALESCE(v_profile_name, 'A resident');
    v_title := 'Help request';
    v_body := v_actor;
    BEGIN
      EXECUTE format('SELECT ($1).%I', 'request_type') INTO v_facility_name USING NEW;
      IF v_facility_name IS NOT NULL THEN
        v_body := v_actor || ' — ' || v_facility_name;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO admin_notifications (community_code, type, title, body, actor_name, reference_id, reference_table)
  VALUES (v_community_code, v_type, v_title, v_body, v_actor, v_reference_id, TG_TABLE_NAME);

  RETURN NEW;
END;
$$;

-- 7. Attach triggers
DROP TRIGGER IF EXISTS trg_notify_pending_resident ON profiles;
CREATE TRIGGER trg_notify_pending_resident
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_notify_admin();

DROP TRIGGER IF EXISTS trg_notify_reservation ON reservations;
CREATE TRIGGER trg_notify_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_notify_admin();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_rsvps') THEN
    DROP TRIGGER IF EXISTS trg_notify_event_rsvp ON event_rsvps;
    CREATE TRIGGER trg_notify_event_rsvp
      AFTER INSERT ON event_rsvps
      FOR EACH ROW
      EXECUTE FUNCTION fn_notify_admin();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'help_requests') THEN
    DROP TRIGGER IF EXISTS trg_notify_help_request ON help_requests;
    CREATE TRIGGER trg_notify_help_request
      AFTER INSERT ON help_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_notify_admin();
  END IF;
END $$;

-- 8. Verification
SELECT 'admin_notifications table' AS item, count(*) AS rows FROM admin_notifications
UNION ALL
SELECT 'triggers', count(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trg_notify_%'
UNION ALL
SELECT 'policies', count(*) FROM pg_policies WHERE tablename = 'admin_notifications';
