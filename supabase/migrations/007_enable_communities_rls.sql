-- Enable RLS on communities table.
-- The policy comm_all_own already exists from migration 003 but RLS was never enabled,
-- so the policy had no effect. This activates it.
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
