-- =============================================================================
-- Migration: 031_pm_offboarding_completion
-- Description: Phase 4 of PM Account Offboarding. Adds the atomic completion
--              RPC (Gate 5 — PII wipe) and the cron hard-delete RPC (Gate 6),
--              plus a schema adjustment so subscription_history rows survive
--              a community hard-delete (financial-record retention), plus a
--              partial index for the cron query. Per the design at
--              docs/superpowers/specs/2026-05-14-offboarding-phase-4-design.md
-- =============================================================================

-- 0. subscription_history retention.
--    The column is currently NOT NULL with NO ACTION on delete, which would
--    cause community hard-deletes to fail and would force us to either delete
--    financial records (compliance violation) or leave communities forever
--    soft-deleted. Allow community_id to go NULL and have the FK SET NULL on
--    community deletion — preserves the financial row, just severs its link.
ALTER TABLE public.subscription_history
  ALTER COLUMN community_id DROP NOT NULL;

ALTER TABLE public.subscription_history
  DROP CONSTRAINT IF EXISTS subscription_history_community_id_fkey;

ALTER TABLE public.subscription_history
  ADD CONSTRAINT subscription_history_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;

-- 1. complete_pm_offboarding — atomic Gate 5 PII wipe.
--    Guarded by status='approved' so it cannot run out of order or twice.
--    Nulls PM PII, marks the org deleted, soft-deletes ONLY closed communities
--    of THIS PM's org, sets pii_wiped_at/soft_deleted_at/status='completed',
--    appends one audit row.
CREATE OR REPLACE FUNCTION public.complete_pm_offboarding(
  p_request_id uuid,
  p_audit      jsonb
)
RETURNS TABLE (out_request_id uuid, out_pm_id uuid, out_org_id uuid)
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

  -- NULL-safety guard: a malformed request with NULL pm_id or org_id would
  -- silently match zero rows below, leaving status='completed' without
  -- actually scrubbing anything. Refuse so the caller sees the error.
  IF v_pm_id IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'complete_pm_offboarding: request % has NULL pm_id or org_id',
      p_request_id;
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

  -- 2. Mark the organization deleted (soft).
  UPDATE public.organizations
     SET status     = 'deleted',
         deleted_at = now()
   WHERE id = v_org_id;

  -- 3. Soft-delete ONLY the closed communities, AND only those that belong to
  --    this org (defensive: prevents a malformed disposition entry from
  --    soft-deleting a community in another org).
  IF v_close_ids IS NOT NULL AND array_length(v_close_ids, 1) > 0 THEN
    UPDATE public.communities
       SET deleted_at = now()
     WHERE id = ANY(v_close_ids)
       AND organization_id = v_org_id
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
--    For each request past the 30-day soft-delete window:
--      - Hard-deletes the closed communities (after pre-clearing their
--        team_members + analytics_events; community_settings cascades and
--        subscription_history auto-NULLs via the FK change above).
--      - Nulls property_manager_id on the PM's surviving (suspended)
--        communities + team_members so the PM delete can succeed.
--      - Hard-deletes the PM row.
--      - Does NOT delete the organization — it survives while any community
--        (including suspended ones awaiting a new PM) still references it.
--        Reclamation of zero-community orgs is out of scope here.
--      - Stamps hard_deleted_at and appends a 'hard_deleted' audit entry.
--    The deletion_requests row itself is RETAINED (7-year compliance).
--    Per-request work runs in its own subtransaction (BEGIN…EXCEPTION) so a
--    single failing request does not poison the whole batch.
--    Cursor uses FOR UPDATE SKIP LOCKED so two concurrent invocations partition
--    the work rather than blocking on each other or double-processing.
--    Idempotent via the hard_deleted_at IS NULL guard in the cursor query.
CREATE OR REPLACE FUNCTION public.hard_delete_expired_offboarding()
RETURNS TABLE (
  processed   integer,
  errored     integer,
  request_ids uuid[],
  errored_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req         record;
  v_close_ids   uuid[];
  v_ids         uuid[] := '{}';
  v_err_ids     uuid[] := '{}';
  v_count       integer := 0;
  v_err_count   integer := 0;
  v_cron_audit  jsonb;
  v_err_audit   jsonb;
BEGIN
  FOR v_req IN
    SELECT id, pm_id, org_id
      FROM public.deletion_requests
     WHERE status = 'completed'
       AND soft_deleted_at IS NOT NULL
       AND soft_deleted_at < now() - interval '30 days'
       AND hard_deleted_at IS NULL
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Per-iteration subtransaction. If any statement below raises, the
      -- EXCEPTION handler rolls back this iteration's changes only and audits
      -- the failure on the request row; the loop continues with the next
      -- request.

      -- Identify the closed (soft-deleted) communities for this org.
      IF v_req.org_id IS NULL THEN
        v_close_ids := '{}';
      ELSE
        SELECT array_agg(id)
          INTO v_close_ids
          FROM public.communities
         WHERE organization_id = v_req.org_id
           AND deleted_at IS NOT NULL;
      END IF;

      -- 1. Pre-clear NO-ACTION children of the closed communities that we
      --    intend to delete with the parent.
      --      community_settings.community_code -> CASCADE (Postgres handles).
      --      subscription_history.community_id -> SET NULL (FK above; rows kept).
      --      team_members.community_id     -> NO ACTION; we delete explicitly.
      --      analytics_events.community_id -> NO ACTION; we delete explicitly.
      IF v_close_ids IS NOT NULL AND array_length(v_close_ids, 1) > 0 THEN
        DELETE FROM public.team_members
         WHERE community_id = ANY(v_close_ids);
        DELETE FROM public.analytics_events
         WHERE community_id = ANY(v_close_ids);

        -- 2. Hard-delete the closed communities.
        DELETE FROM public.communities
         WHERE id = ANY(v_close_ids);
      END IF;

      -- 3. Pre-clear PM references on SURVIVING (suspended) communities and
      --    on any team_members that still point at the PM. These FKs are
      --    NO ACTION, so without nulling them the PM delete below would fail.
      IF v_req.pm_id IS NOT NULL THEN
        UPDATE public.communities
           SET property_manager_id = NULL
         WHERE property_manager_id = v_req.pm_id;

        UPDATE public.team_members
           SET property_manager_id = NULL
         WHERE property_manager_id = v_req.pm_id;

        -- 4. Hard-delete the PM row.
        --    deletion_requests.pm_id is ON DELETE SET NULL (audit row survives).
        --    transfer_requests.{incoming,outgoing}_pm_id is ON DELETE SET NULL.
        DELETE FROM public.property_managers
         WHERE id = v_req.pm_id;
      END IF;

      -- 5. The organization is intentionally NOT deleted. Suspended communities
      --    still reference it; the org survives to receive a new PM.

      -- 6. Stamp the request row + append the 'hard_deleted' audit entry.
      v_cron_audit := jsonb_build_object(
        'actor',    'cron',
        'actor_id', 'cron',
        'action',   'hard_deleted',
        'at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
      UPDATE public.deletion_requests
         SET hard_deleted_at = now(),
             audit_log       = COALESCE(audit_log, '[]'::jsonb)
                              || jsonb_build_array(v_cron_audit)
       WHERE id = v_req.id;

      v_ids   := v_ids || v_req.id;
      v_count := v_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Per-request isolation: this iteration's mutations roll back. Log a
        -- warning (Vercel surfaces RAISE WARNING) and audit the failure on the
        -- request row in a fresh inner subtransaction so the failure note
        -- survives. The next nightly run retries (hard_deleted_at is still
        -- NULL); persistent failures will accumulate notes in audit_log.
        RAISE WARNING 'hard_delete_expired_offboarding: request % failed: %',
          v_req.id, SQLERRM;
        BEGIN
          v_err_audit := jsonb_build_object(
            'actor',    'cron',
            'actor_id', 'cron',
            'action',   'hard_delete_failed',
            'at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'note',     SQLERRM
          );
          UPDATE public.deletion_requests
             SET audit_log = COALESCE(audit_log, '[]'::jsonb)
                              || jsonb_build_array(v_err_audit)
           WHERE id = v_req.id;
        EXCEPTION
          WHEN OTHERS THEN
            -- Even the failure-audit append failed; nothing more we can do.
            NULL;
        END;
        v_err_ids   := v_err_ids || v_req.id;
        v_err_count := v_err_count + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_count, v_err_count, v_ids, v_err_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hard_delete_expired_offboarding()
  FROM anon, authenticated, public;

-- 3. Partial index supporting the cron query above.
CREATE INDEX IF NOT EXISTS deletion_requests_hard_delete_due_idx
  ON public.deletion_requests (soft_deleted_at)
  WHERE status = 'completed' AND hard_deleted_at IS NULL;
