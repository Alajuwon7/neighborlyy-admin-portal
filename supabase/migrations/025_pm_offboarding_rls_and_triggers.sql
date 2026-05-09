-- =============================================================================
-- Migration: 025_pm_offboarding_rls_and_triggers
-- Description: RLS policies, audit-log immutability trigger, and realtime
--              publication membership for the offboarding request tables
--              created in 024.
-- =============================================================================

-- 1. Enable RLS
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

-- 2. SELECT policies — only the PM concerned can read their own request rows.
--    No INSERT/UPDATE/DELETE policies are added, so anon/authenticated cannot
--    write — all writes flow through server-side admin client (service role).

DROP POLICY IF EXISTS deletion_requests_select_own ON deletion_requests;
CREATE POLICY deletion_requests_select_own
  ON deletion_requests FOR SELECT
  USING (
    pm_id IN (
      SELECT id FROM property_managers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transfer_requests_select_own ON transfer_requests;
CREATE POLICY transfer_requests_select_own
  ON transfer_requests FOR SELECT
  USING (
    outgoing_pm_id IN (
      SELECT id FROM property_managers WHERE user_id = auth.uid()
    )
    OR
    incoming_pm_id IN (
      SELECT id FROM property_managers WHERE user_id = auth.uid()
    )
  );

-- 3. Audit-log immutability trigger.
--    Audit log entries can only be appended — never modified or removed.
--    Per 04-COMPLIANCE.md lines 105-122. Adapted to jsonb (not jsonb[]) so
--    jsonb_array_length() applies cleanly.
CREATE OR REPLACE FUNCTION prevent_audit_log_shrink()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.audit_log IS NULL THEN
    RAISE EXCEPTION 'audit_log cannot be null';
  END IF;

  IF jsonb_typeof(NEW.audit_log) <> 'array' THEN
    RAISE EXCEPTION 'audit_log must be a JSON array';
  END IF;

  IF OLD.audit_log IS NOT NULL
     AND jsonb_array_length(NEW.audit_log) < jsonb_array_length(OLD.audit_log) THEN
    RAISE EXCEPTION 'audit_log entries cannot be removed';
  END IF;

  -- Prevent in-place mutation: every existing entry must remain identical at
  -- its original index. New entries may only be appended.
  IF OLD.audit_log IS NOT NULL THEN
    FOR i IN 0 .. jsonb_array_length(OLD.audit_log) - 1 LOOP
      IF NEW.audit_log -> i IS DISTINCT FROM OLD.audit_log -> i THEN
        RAISE EXCEPTION 'audit_log entries are immutable (mismatch at index %)', i;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deletion_requests_audit_log_immutable ON deletion_requests;
CREATE TRIGGER deletion_requests_audit_log_immutable
  BEFORE UPDATE ON deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_shrink();

DROP TRIGGER IF EXISTS transfer_requests_audit_log_immutable ON transfer_requests;
CREATE TRIGGER transfer_requests_audit_log_immutable
  BEFORE UPDATE ON transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_shrink();

-- 4. Realtime — let the PM's status card subscribe to status changes on
--    their own deletion/transfer request rows. RLS still applies to
--    realtime payloads, so PMs only see their own.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'deletion_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE deletion_requests';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'transfer_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE transfer_requests';
  END IF;
END $$;
