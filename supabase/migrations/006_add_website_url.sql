-- =============================================================================
-- Migration: 006_add_website_url
-- Description: Add website_url column to communities table for property
--              manager to share their property's website.
-- =============================================================================

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS website_url text;
