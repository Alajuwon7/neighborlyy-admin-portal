-- =====================================================
-- Migration 015: RPC functions for approve/deny
-- =====================================================
-- SECURITY DEFINER functions to bypass RLS when
-- property managers approve or deny pending users.
-- Run in Supabase SQL Editor
-- =====================================================

-- Approve: move pending_user → profiles, mark approved
CREATE OR REPLACE FUNCTION approve_pending_user(p_pending_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending pending_users%ROWTYPE;
BEGIN
  SELECT * INTO v_pending FROM pending_users WHERE id = p_pending_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending user not found';
  END IF;

  -- Upsert into profiles
  INSERT INTO profiles (id, full_name, email, unit_number, community_code, status)
  VALUES (v_pending.id, v_pending.full_name, v_pending.email, v_pending.unit_number, v_pending.community_code, 'approved')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    unit_number = EXCLUDED.unit_number,
    community_code = EXCLUDED.community_code,
    status = 'approved';

  -- Mark pending_users as approved
  UPDATE pending_users SET status = 'approved' WHERE id = p_pending_user_id;
END;
$$;

-- Deny: update pending_users status + store reason
CREATE OR REPLACE FUNCTION deny_pending_user(p_pending_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pending_users
  SET status = 'rejected'
  WHERE id = p_pending_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending user not found';
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION approve_pending_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION deny_pending_user(uuid, text) TO authenticated;
