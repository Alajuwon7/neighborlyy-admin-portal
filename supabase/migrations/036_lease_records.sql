-- =====================================================
-- 036: Rent-roll uploads + lease records (renewal KPI, part 1)
-- =====================================================
-- A PM uploads a monthly rent-roll CSV per community. The portal keeps only
-- unit, lease end date and renewal outcome — no tenant names, rents or
-- contact details. The Insights "Renewal rate by engagement" tile joins these
-- rows to resident activity through get_lease_renewal_summary (Miyora migration
-- 20261109120000_lease_engagement.sql), which must be applied AFTER this file.
--
-- lease_records holds one row per lease PER REPORT MONTH (an observation):
-- unique (community_code, unit, lease_end_date, report_month). Re-uploading a
-- month replaces exactly that month's rows; other months are untouched. When a
-- lease appears in several monthly rolls, readers use the newest month's row
-- (get_lease_renewal_summary does DISTINCT ON ... ORDER BY report_month DESC),
-- so pending -> renewed updates the lease and re-uploading an old month can't
-- overwrite a newer outcome.
--
-- RLS: a PM reads and writes only the communities they manage, via
-- internal.auth_user_manages_community (same helper the digest tables use).
--
-- APPLY via the Supabase SQL editor (shared project; no `db push`).
-- Idempotent: safe to paste more than once.

-- -----------------------------------------------------
-- 1. Unit normalisation (shared with the profile match)
-- -----------------------------------------------------
-- "Apt 04B" / "Unit #4b" / "4-B" -> "4B". The prefix must be a whole word
-- (\M), which also makes the function idempotent: the table CHECK below
-- requires unit = normalize_unit(unit).
-- KEEP IN SYNC with normalizeUnit() in lib/rent-roll.ts.
CREATE OR REPLACE FUNCTION internal.normalize_unit(p_unit text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(upper(btrim(p_unit)), '^(APARTMENT|APT|UNIT|SUITE|STE)\M\.?\s*', ''),
             '[^A-Z0-9]', '', 'g'),
           '^0+(?=.)', '');
$function$;

GRANT EXECUTE ON FUNCTION internal.normalize_unit(text) TO authenticated;

-- -----------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rent_roll_uploads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_code   text NOT NULL REFERENCES public.communities(community_code) ON DELETE CASCADE,
  -- First day of the month the rent roll describes.
  report_month     date NOT NULL CHECK (extract(day FROM report_month) = 1),
  file_name        text,
  row_count        integer NOT NULL CHECK (row_count >= 0),
  rows_rejected    integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  uploaded_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name text,
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  -- How many times this month has been uploaded (1 = first upload).
  upload_count     integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_code, report_month)
);

CREATE TABLE IF NOT EXISTS public.lease_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_code   text NOT NULL REFERENCES public.communities(community_code) ON DELETE CASCADE,
  unit             text NOT NULL CHECK (unit <> '' AND unit = internal.normalize_unit(unit)),
  lease_end_date   date NOT NULL,
  outcome          text NOT NULL CHECK (outcome IN ('renewed', 'moved_out', 'pending')),
  report_month     date NOT NULL,
  source_upload_id uuid NOT NULL REFERENCES public.rent_roll_uploads(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_code, unit, lease_end_date, report_month)
);

CREATE INDEX IF NOT EXISTS idx_lease_records_community_end
  ON public.lease_records (community_code, lease_end_date);
-- The UNIQUE above also serves the newest-month DISTINCT ON read.
CREATE INDEX IF NOT EXISTS idx_lease_records_source_upload
  ON public.lease_records (source_upload_id);

-- -----------------------------------------------------
-- 3. RLS — PMs, their own communities only
-- -----------------------------------------------------
ALTER TABLE public.rent_roll_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rent_roll_uploads, public.lease_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_roll_uploads, public.lease_records TO authenticated;

DROP POLICY IF EXISTS pm_select_rent_roll_uploads ON public.rent_roll_uploads;
CREATE POLICY pm_select_rent_roll_uploads ON public.rent_roll_uploads
  FOR SELECT TO authenticated
  USING (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_insert_rent_roll_uploads ON public.rent_roll_uploads;
CREATE POLICY pm_insert_rent_roll_uploads ON public.rent_roll_uploads
  FOR INSERT TO authenticated
  WITH CHECK (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_update_rent_roll_uploads ON public.rent_roll_uploads;
CREATE POLICY pm_update_rent_roll_uploads ON public.rent_roll_uploads
  FOR UPDATE TO authenticated
  USING (internal.auth_user_manages_community(community_code))
  WITH CHECK (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_delete_rent_roll_uploads ON public.rent_roll_uploads;
CREATE POLICY pm_delete_rent_roll_uploads ON public.rent_roll_uploads
  FOR DELETE TO authenticated
  USING (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_select_lease_records ON public.lease_records;
CREATE POLICY pm_select_lease_records ON public.lease_records
  FOR SELECT TO authenticated
  USING (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_insert_lease_records ON public.lease_records;
CREATE POLICY pm_insert_lease_records ON public.lease_records
  FOR INSERT TO authenticated
  WITH CHECK (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_update_lease_records ON public.lease_records;
CREATE POLICY pm_update_lease_records ON public.lease_records
  FOR UPDATE TO authenticated
  USING (internal.auth_user_manages_community(community_code))
  WITH CHECK (internal.auth_user_manages_community(community_code));

DROP POLICY IF EXISTS pm_delete_lease_records ON public.lease_records;
CREATE POLICY pm_delete_lease_records ON public.lease_records
  FOR DELETE TO authenticated
  USING (internal.auth_user_manages_community(community_code));

-- -----------------------------------------------------
-- 4. Save one upload atomically
-- -----------------------------------------------------
-- SECURITY INVOKER: every statement runs under the caller's RLS, so the
-- policies above stay the only gate. The explicit check gives a clear error.
-- p_rows: [{ "unit": "4B", "lease_end_date": "2026-03-31", "outcome": "renewed" }, ...]
-- already normalised and validated by the portal (lib/rent-roll.ts); the
-- table CHECKs reject anything that slips through, which aborts the whole save.
CREATE OR REPLACE FUNCTION public.import_rent_roll(
  p_community_code text,
  p_report_month   date,
  p_file_name      text,
  p_rows           jsonb,
  p_rows_rejected  integer
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_upload   uuid;
  v_replaced integer := 0;
  v_saved    integer := 0;
  v_total    integer;
  v_name     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT internal.auth_user_manages_community(p_community_code) THEN
    RAISE EXCEPTION 'Not authorised for %', p_community_code;
  END IF;
  IF p_report_month IS NULL OR extract(day FROM p_report_month) <> 1 THEN
    RAISE EXCEPTION 'Report month must be the first day of a month';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows must be a JSON array';
  END IF;
  v_total := jsonb_array_length(p_rows);
  IF v_total > 5000 THEN
    RAISE EXCEPTION 'Too many rows (max 5000)';
  END IF;

  SELECT pm.full_name INTO v_name FROM public.property_managers pm WHERE pm.user_id = auth.uid() LIMIT 1;

  INSERT INTO public.rent_roll_uploads AS u
    (community_code, report_month, file_name, row_count, rows_rejected, uploaded_by, uploaded_by_name, uploaded_at)
  VALUES
    (p_community_code, p_report_month, p_file_name, v_total, GREATEST(COALESCE(p_rows_rejected, 0), 0),
     auth.uid(), v_name, now())
  ON CONFLICT (community_code, report_month) DO UPDATE
    SET file_name        = EXCLUDED.file_name,
        row_count        = EXCLUDED.row_count,
        rows_rejected    = EXCLUDED.rows_rejected,
        uploaded_by      = EXCLUDED.uploaded_by,
        uploaded_by_name = EXCLUDED.uploaded_by_name,
        uploaded_at      = now(),
        upload_count     = u.upload_count + 1
  RETURNING u.id INTO v_upload;

  -- Re-upload of this month: replace exactly this month's rows.
  DELETE FROM public.lease_records WHERE source_upload_id = v_upload;
  GET DIAGNOSTICS v_replaced = ROW_COUNT;

  -- A duplicate (unit, lease_end_date) inside one file violates the UNIQUE and
  -- aborts the whole save; the portal removes duplicates before sending.
  INSERT INTO public.lease_records
    (community_code, unit, lease_end_date, outcome, report_month, source_upload_id)
  SELECT p_community_code, r.unit, r.lease_end_date, r.outcome, p_report_month, v_upload
    FROM jsonb_to_recordset(p_rows) AS r(unit text, lease_end_date date, outcome text);
  GET DIAGNOSTICS v_saved = ROW_COUNT;

  RETURN jsonb_build_object('upload_id', v_upload, 'saved', v_saved, 'replaced', v_replaced);
END;
$function$;

REVOKE ALL ON FUNCTION public.import_rent_roll(text, date, text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_rent_roll(text, date, text, jsonb, integer) TO authenticated;

COMMENT ON TABLE public.lease_records IS
  'One row per lease per report month from PM rent-roll uploads (portal 036); newest month wins on read. No tenant PII. Read by get_lease_renewal_summary.';
COMMENT ON TABLE public.rent_roll_uploads IS
  'One row per community per report month; re-uploads update it (upload_count). Portal 036.';
