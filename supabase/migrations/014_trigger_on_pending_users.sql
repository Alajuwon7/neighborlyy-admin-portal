-- =====================================================
-- Migration 014: Notification trigger on pending_users
-- =====================================================
-- The profiles trigger never fires because residents
-- go into pending_users first. Move the trigger there.
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Drop the old profiles trigger (it was on the wrong table)
DROP TRIGGER IF EXISTS trg_notify_pending_resident ON profiles;

-- 2. Create trigger on pending_users
CREATE OR REPLACE FUNCTION fn_notify_pending_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO admin_notifications (community_code, type, title, body, actor_name, reference_id, reference_table)
    VALUES (
      NEW.community_code,
      'pending_resident',
      'New join request',
      NEW.full_name || COALESCE(' — Unit ' || NEW.unit_number, ''),
      NEW.full_name,
      NEW.id,
      'pending_users'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pending_user ON pending_users;
CREATE TRIGGER trg_notify_pending_user
  AFTER INSERT ON pending_users
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_pending_user();

-- 3. Verify
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_notify_pending_user';
