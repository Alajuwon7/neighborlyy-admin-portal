-- =============================================================================
-- Migration: 031_pm_offboarding_completion
-- Description: Phase 4 of PM Account Offboarding. Adds the atomic completion
--              RPC (Gate 5 — PII wipe) and the cron hard-delete RPC (Gate 6),
--              plus a partial index for the cron query. Per the design at
--              docs/superpowers/specs/2026-05-14-offboarding-phase-4-design.md
-- =============================================================================

-- 1. complete_pm_offboarding — atomic Gate 5 PII wipe.
--    Guarded by status='approved' so it cannot run out of order or twice.
--    Nulls PM PII, marks the org deleted, soft-deletes ONLY closed communities,
--    sets pii_wiped_at/soft_deleted_at/status='completed', appends one audit row.
CREATE OR REPLACE FUNCTION public.complete_pm_offboarding(
  p_request_id uuid,
  p_audit      jsonb
)
RETURNS TABLE (request_id uuid, pm_id uuid, org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pm_id     uuid;
  v_org_id    uuid;
  v_close_ids uuid[];
BEGIN
  IF p_audit IS NULL OR jsonb_typeof(p_audit) <> 'object' THEN
    RAISE EXCEPTION 'complete_pm_offboarding: p_audit must be a non-null JSON object';
  END IF;

  -- Lock the request row and confirm it is exactly at the Phase 4 entry point.
  SELECT dr.pm_id, dr.org_id
    INTO v_pm_id, v_org_id
    FROM public.deletion_requests dr
   WHERE dr.id = p_request_id
     AND dr.status = 'approved'
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Wrong id, or status already advanced. The caller treats an empty result
    -- set as a retryable no-op (already completed / concurrent run).
    RETURN;
  END IF;

  -- Community ids whose disposition action is 'close' (from the jsonb array
  -- written in Phase 3). Suspended communities are intentionally left alone --
  -- they survive and await a new PM.
  SELECT array_agg((elem->>'community_id')::uuid)
    INTO v_close_ids
    FROM public.deletion_requests dr
         CROSS JOIN LATERAL jsonb_array_elements(dr.community_disposition) elem
   WHERE dr.id = p_request_id
     AND elem->>'action' = 'close';

  -- 1. Null the PM's personal data.
  --    full_name is NOT NULL  -> set to the '[deleted]' sentinel.
  --    email is NOT NULL UNIQUE -> set to a per-row-unique sentinel so multiple
  --    deletions never collide AND the real address is freed for re-signup.
  UPDATE public.property_managers
     SET full_name    = '[deleted]',
         phone        = NULL,
         avatar_url   = NULL,
         company_name = NULL,
         email        = '[deleted]-' || id::text
   WHERE id = v_pm_id;

  -- 2. Mark the organization deleted.
  UPDATE public.organizations
     SET status     = 'deleted',
         deleted_at = now()
   WHERE id = v_org_id;

  -- 3. Soft-delete ONLY the closed communities.
  IF v_close_ids IS NOT NULL AND array_length(v_close_ids, 1) > 0 THEN
    UPDATE public.communities
       SET deleted_at = now()
     WHERE id = ANY(v_close_ids)
       AND deleted_at IS NULL;
  END IF;

  -- 4. Advance the request to completed, stamp the wipe timestamps, append audit.
  UPDATE public.deletion_requests
     SET pii_wiped_at    = now(),
         soft_deleted_at = now(),
         status          = 'completed',
         audit_log       = COALESCE(audit_log, '[]'::jsonb) || jsonb_build_array(p_audit)
   WHERE id = p_request_id
     AND status = 'approved';

  RETURN QUERY SELECT p_request_id, v_pm_id, v_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_pm_offboarding(uuid, jsonb)
  FROM anon, authenticated, public;

-- 2. hard_delete_expired_offboarding — Gate 6 cron job.
--    Hard-deletes org / closed communities / PM row for requests whose 30-day
--    soft-delete window has elapsed. The deletion_requests row itself is
--    RETAINED (7-year compliance retention). Idempotent via the
--    hard_deleted_at IS NULL guard.
CREATE OR REPLACE FUNCTION public.hard_delete_expired_offboarding()
RETURNS TABLE (processed integer, request_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req        record;
  v_ids        uuid[] := '{}';
  v_count      integer := 0;
  v_cron_audit jsonb;
BEGIN
  FOR v_req IN
    SELECT id, pm_id, org_id
      FROM public.deletion_requests
     WHERE status = 'completed'
       AND soft_deleted_at IS NOT NULL
       AND soft_deleted_at < now() - interval '30 days'
       AND hard_deleted_at IS NULL
     FOR UPDATE
  LOOP
    -- Delete the closed communities (suspended ones were never soft-deleted,
    -- so deleted_at IS NULL for them and they are skipped).
    DELETE FROM public.communities
     WHERE organization_id = v_req.org_id
       AND deleted_at IS NOT NULL;

    -- Delete the organization (only if Gate 5 marked it deleted).
    DELETE FROM public.organizations
     WHERE id = v_req.org_id
       AND status = 'deleted';

    -- Delete the PM row. deletion_requests.pm_id is ON DELETE SET NULL, so the
    -- audit row survives; audit_log entries store actor_id as plain text.
    DELETE FROM public.property_managers
     WHERE id = v_req.pm_id;

    v_cron_audit := jsonb_build_object(
      'actor',    'cron',
      'actor_id', 'cron',
      'action',   'hard_deleted',
      'at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    UPDATE public.deletion_requests
       SET hard_deleted_at = now(),
           audit_log       = COALESCE(audit_log, '[]'::jsonb) || jsonb_build_array(v_cron_audit)
     WHERE id = v_req.id;

    v_ids   := v_ids || v_req.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count, v_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hard_delete_expired_offboarding()
  FROM anon, authenticated, public;

-- 3. Partial index supporting the cron query above.
CREATE INDEX IF NOT EXISTS deletion_requests_hard_delete_due_idx
  ON public.deletion_requests (soft_deleted_at)
  WHERE status = 'completed' AND hard_deleted_at IS NULL;
