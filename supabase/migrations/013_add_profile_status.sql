-- =====================================================
-- Migration 013: Add status column to profiles
-- =====================================================
-- Adds pending/approved/rejected status to profiles
-- so admins can approve residents before they get access.
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Add the column with default 'pending'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2. Set all existing residents to 'approved' so they're not locked out
UPDATE profiles SET status = 'approved' WHERE status = 'pending';

-- 3. Verify
SELECT status, count(*) FROM profiles GROUP BY status;
