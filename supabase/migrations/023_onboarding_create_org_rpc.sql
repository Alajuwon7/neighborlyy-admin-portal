-- =============================================================================
-- Migration: 023_onboarding_create_org_rpc
-- Description: Replace the client-side INSERT organizations + UPDATE
--   property_managers pair with a single SECURITY DEFINER RPC.
--
--   Root cause this fixes: PostgREST's `.insert(...).select("id").single()`
--   compiles to `INSERT ... RETURNING id`, which makes Postgres evaluate the
--   SELECT policy on the just-inserted row in addition to the INSERT WITH
--   CHECK. The only SELECT policy on `organizations` is `org_read_own`, which
--   requires the org's id to already be in the calling PM's
--   `organization_id`. The link UPDATE happens in the *next* statement, so
--   RETURNING never sees a row the SELECT policy will release — and the
--   client gets `42501 new row violates row-level security policy`.
--
--   A SECURITY DEFINER function runs as the function owner (postgres),
--   bypassing RLS. Auth is enforced explicitly via auth.uid() inside the
--   function body, and EXECUTE is granted only to `authenticated`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.onboarding_create_org_and_link(
  p_org_name     text,
  p_org_type     text,
  p_company_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid;
  v_pm_id  uuid;
  v_org_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_org_name IS NULL OR length(trim(p_org_name)) = 0 THEN
    RAISE EXCEPTION 'org name is required' USING ERRCODE = '22023';
  END IF;
  IF p_org_type IS NULL OR length(trim(p_org_type)) = 0 THEN
    RAISE EXCEPTION 'org type is required' USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO   v_pm_id
  FROM   public.property_managers
  WHERE  user_id = v_uid;

  IF v_pm_id IS NULL THEN
    RAISE EXCEPTION 'Property manager profile not found for user %', v_uid
      USING ERRCODE = '42704';
  END IF;

  INSERT INTO public.organizations (name, type)
  VALUES (p_org_name, p_org_type)
  RETURNING id INTO v_org_id;

  UPDATE public.property_managers
  SET    organization_id = v_org_id,
         company_name    = p_company_name
  WHERE  id = v_pm_id;

  RETURN v_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.onboarding_create_org_and_link(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.onboarding_create_org_and_link(text, text, text) TO   authenticated;
