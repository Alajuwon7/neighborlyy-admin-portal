-- =====================================================
-- Migration 012: Enable Realtime on admin_notifications
-- =====================================================
-- Adds admin_notifications to the supabase_realtime
-- publication so clients can subscribe to changes.
-- Run in Supabase SQL Editor
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
