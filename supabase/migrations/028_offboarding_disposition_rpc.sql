-- =============================================================================
-- Migration: 028_offboarding_disposition_rpc
-- Description: Atomic per-community disposition update for the disposition
--              gate. Replaces any existing entry for the same community_id,
--              then appends the new entry. Prevents the same race-condition
--              class fixed for audit_log in migration 026.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_community_disposition(
  p_request_id   uuid,
  p_community_id uuid,
  p_entry        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'set_community_disposition: entry must be a non-null JSON object';
  END IF;

  UPDATE public.deletion_requests
     SET community_disposition = COALESCE(
       (
         SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(community_disposition) AS elem
          WHERE elem->>'community_id' IS DISTINCT FROM p_community_id::text
       ),
       '[]'::jsonb
     ) || jsonb_build_array(p_entry)
   WHERE id = p_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_community_disposition(uuid, uuid, jsonb)
  FROM anon, authenticated, public;
