-- =============================================================================
-- Migration: 026_pm_offboarding_hardening
-- Description: Address findings from Phase 2 code review:
--              (Critical 1) audit-log shape check on INSERT, not just UPDATE.
--              (Critical 2) current_approval_jti for single-use JWT enforcement.
--              (Critical 3) atomic append_audit_entry RPC to prevent race
--                           conditions in read-modify-write audit appends.
-- =============================================================================

-- 1. Single-use JWT support: track the currently-valid approval token's jti.
--    On token issue/resend the action persists the jti here; verify rejects
--    any token whose jti differs.
ALTER TABLE deletion_requests
  ADD COLUMN IF NOT EXISTS current_approval_jti uuid;

ALTER TABLE transfer_requests
  ADD COLUMN IF NOT EXISTS current_approval_jti uuid;

-- 2. Strengthen audit-log trigger to also fire on INSERT.
--    BEFORE INSERT runs the shape checks; immutability checks are UPDATE-only.
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

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.audit_log IS NOT NULL
     AND jsonb_array_length(NEW.audit_log) < jsonb_array_length(OLD.audit_log) THEN
    RAISE EXCEPTION 'audit_log entries cannot be removed';
  END IF;

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
  BEFORE INSERT OR UPDATE ON deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_shrink();

DROP TRIGGER IF EXISTS transfer_requests_audit_log_immutable ON transfer_requests;
CREATE TRIGGER transfer_requests_audit_log_immutable
  BEFORE INSERT OR UPDATE ON transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_shrink();

-- 3. Atomic audit append. Prior implementation did SELECT + UPDATE in JS,
--    which silently dropped entries under concurrency. Postgres-side
--    `audit_log = audit_log || jsonb_build_array(...)` is atomic.
--    Table name is restricted to the two known tables to prevent injection.
CREATE OR REPLACE FUNCTION public.append_audit_entry(
  p_table       text,
  p_request_id  uuid,
  p_entry       jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'append_audit_entry: entry must be a non-null JSON object';
  END IF;

  IF p_table = 'deletion_requests' THEN
    UPDATE public.deletion_requests
       SET audit_log = COALESCE(audit_log, '[]'::jsonb) || jsonb_build_array(p_entry)
     WHERE id = p_request_id;
  ELSIF p_table = 'transfer_requests' THEN
    UPDATE public.transfer_requests
       SET audit_log = COALESCE(audit_log, '[]'::jsonb) || jsonb_build_array(p_entry)
     WHERE id = p_request_id;
  ELSE
    RAISE EXCEPTION 'append_audit_entry: invalid table %', p_table;
  END IF;
END;
$$;

-- Trigger-/admin-only helper. Should never be callable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.append_audit_entry(text, uuid, jsonb)
  FROM anon, authenticated, public;
