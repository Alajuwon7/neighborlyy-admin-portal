-- Edge cases for import_rent_roll (portal 036), the renewal snapshot (Miyora
-- 20261111120100: locked outcomes, monthly snapshot, one lease per unit, three
-- groups, rounded rates, size bands) and compute_community_metrics skipping
-- hidden content (Miyora 20261111120000). Run with scripts/test-renewal-sql.sh
-- — it loads stub.sql and the migrations into a throwaway local Postgres.
-- Every t_check raises on failure, and the script runs with ON_ERROR_STOP.
--
-- Community DEMO, created 2026-03-01. Most leases end Thu 2026-10-15, so the
-- lease-end week starts Mon 2026-10-12 and the 12-week window is the weeks
-- starting 2026-07-20 … 2026-10-05. Rolls are uploaded in October (test clock
-- 2026-10-20) and read in November: snapshot 2026-11-01, period
-- 2025-11-01 … 2026-10-31.

\set QUIET on
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

-- Test clock: internal.renewal_now() reads test.now (production: now()).
CREATE OR REPLACE FUNCTION internal.renewal_now() RETURNS timestamptz LANGUAGE sql STABLE AS
  $$ SELECT COALESCE(nullif(current_setting('test.now', true), '')::timestamptz, now()) $$;
CREATE FUNCTION public.t_clock(ts text) RETURNS text LANGUAGE sql AS $$ SELECT set_config('test.now', ts, false) $$;
GRANT EXECUTE ON FUNCTION public.t_clock(text) TO authenticated;
-- The snapshot without its dates, for "did anything change" comparisons.
CREATE FUNCTION public.t_key(c text) RETURNS text LANGUAGE sql AS $$
  SELECT row(s.leases_seen, s.in_period, s.repeats, s.pending, s.too_new,
             s.took_part_rate, s.others_rate, s.not_on_miyora_rate, s.size_band)::text
    FROM public.get_lease_renewal_snapshot(c) s $$;
GRANT EXECUTE ON FUNCTION public.t_key(text) TO authenticated;

SELECT t_check('old caller-chosen-dates summary is gone',
               to_regprocedure('public.get_lease_renewal_summary(text, date, date, integer, integer)') IS NULL);

INSERT INTO auth.users VALUES ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');
INSERT INTO public.property_managers VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Pat Manager');
INSERT INTO internal.pm_map VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'DEMO'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'FLOOR'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'PRO'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'BND'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'BAND'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'OTHER');
INSERT INTO public.communities VALUES ('DEMO', '2026-03-01T12:00Z'), ('FLOOR', '2026-03-01T12:00Z'), ('OTHER', '2026-03-01T12:00Z'),
  -- PRO launched Mon 2026-08-03: leases ending 10-15 have 10 weeks of history (need ceil(10*3/12) = 3).
  ('PRO', '2026-08-03T12:00Z'), ('BND', '2026-01-01Z'), ('BAND', '2026-01-01Z');

-- Residents. id = 00..0<unit><n> for readability.
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at) VALUES
  -- took part: units 201-205 and roommates in 101
  ('00000000-0000-4000-8000-000000201001', 'DEMO', 'resident', '201', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000202001', 'DEMO', 'resident', 'Apt 0202', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000203001', 'DEMO', 'resident', '203', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000204001', 'DEMO', 'resident', '204', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000205001', 'DEMO', 'resident', '205', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000101001', 'DEMO', 'resident', '101', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000101002', 'DEMO', 'resident', '101', '2026-01-01Z'),
  -- didn't: 301-305
  ('00000000-0000-4000-8000-000000301001', 'DEMO', 'resident', '301', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000302001', 'DEMO', 'resident', '302', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000303001', 'DEMO', 'resident', '303', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000304001', 'DEMO', 'resident', '304', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000305001', 'DEMO', 'resident', '305', '2026-01-01Z'),
  -- 401 joined Tue 2026-09-01 -> judged on the 5 full weeks from Mon 09-07 (prorated)
  ('00000000-0000-4000-8000-000000401001', 'DEMO', 'resident', '401', '2026-09-01Z'),
  -- 402: departed tenant (very active) still in the app; new tenant (silent) joined after the move-out
  ('00000000-0000-4000-8000-000000402001', 'DEMO', 'resident', '402', '2025-01-01Z'),
  ('00000000-0000-4000-8000-000000402002', 'DEMO', 'resident', '402', '2025-10-10Z'),
  -- 403 joined after its lease ended -> not on Miyora
  ('00000000-0000-4000-8000-000000403001', 'DEMO', 'resident', '403', '2026-10-20Z'),
  -- 501 pending
  ('00000000-0000-4000-8000-000000501001', 'DEMO', 'resident', '501', '2026-01-01Z'),
  -- 601 is management, not a resident -> not on Miyora
  ('00000000-0000-4000-8000-000000601001', 'DEMO', 'admin', '601', '2026-01-01Z'),
  -- FLOOR community: 4 took-part units (2 leases each) + 5 others
  ('00000000-0000-4000-8000-000000711001', 'FLOOR', 'resident', '11', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000712001', 'FLOOR', 'resident', '12', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000713001', 'FLOOR', 'resident', '13', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000714001', 'FLOOR', 'resident', '14', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000721001', 'FLOOR', 'resident', '21', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000722001', 'FLOOR', 'resident', '22', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000723001', 'FLOOR', 'resident', '23', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000724001', 'FLOOR', 'resident', '24', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000725001', 'FLOOR', 'resident', '25', '2026-01-01Z');

-- Activity. Took-part units: exactly 3 window weeks, including both edges.
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000' || u || '001')::uuid, 'DEMO', t::timestamptz
  FROM unnest(ARRAY['201','202','203','204','205']) u,
       unnest(ARRAY['2026-07-20T00:00Z',   -- first window week, first second
                    '2026-08-05T12:00Z',
                    '2026-10-11T23:59:59Z' -- last window week, last second
                   ]) t;
-- Others: 2 window weeks (one with two posts), plus activity just outside both ends.
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000' || u || '001')::uuid, 'DEMO', t::timestamptz
  FROM unnest(ARRAY['301','302','303','304','305']) u,
       unnest(ARRAY['2026-07-19T23:59:59Z', -- week before the window
                    '2026-08-05T12:00Z', '2026-08-06T12:00Z', -- same week twice
                    '2026-09-09T12:00Z',
                    '2026-10-12T00:00Z'      -- lease-end week itself
                   ]) t;
-- 101: roommates, 2 weeks + 1 different week = 3 between them.
INSERT INTO public.posts VALUES
  ('00000000-0000-4000-8000-000000101001', 'DEMO', '2026-08-03T12:00Z'),
  ('00000000-0000-4000-8000-000000101001', 'DEMO', '2026-08-10T12:00Z'),
  ('00000000-0000-4000-8000-000000101002', 'DEMO', '2026-09-14T12:00Z');
-- 402: the departed tenant posts every week; must not count for the new lease.
INSERT INTO public.posts
SELECT '00000000-0000-4000-8000-000000402001', 'DEMO', d FROM generate_series('2026-07-21'::timestamptz, '2026-10-06', '7 days') d;
-- 601 (admin) posts a lot; never counts.
INSERT INTO public.posts
SELECT '00000000-0000-4000-8000-000000601001', 'DEMO', d FROM generate_series('2026-07-21'::timestamptz, '2026-10-06', '7 days') d;
-- FLOOR: took-part units post every window week of both their leases.
INSERT INTO public.posts
SELECT ('00000000-0000-4000-8000-0000007' || u || '001')::uuid, 'FLOOR', d
  FROM unnest(ARRAY['11','12','13','14']) u, generate_series('2026-06-01'::timestamptz, '2026-10-06', '7 days') d;

SET ROLE authenticated;
SELECT set_config('test.uid', 'aaaaaaaa-0000-4000-8000-000000000001', false) \g /dev/null
SELECT t_clock('2026-10-20T12:00Z') \g /dev/null

-- October roll. 205 still pending. 991-994 have no resident.
SELECT public.import_rent_roll('DEMO', '2026-10-01', 'oct.csv', $j$[
  {"unit":"201","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"202","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"203","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"204","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"205","lease_end_date":"2026-10-15","outcome":"pending"},
  {"unit":"101","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"301","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"302","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"303","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"304","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"305","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"401","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"402","lease_end_date":"2025-09-30","outcome":"moved_out"},
  {"unit":"402","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"403","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"999","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"991","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"992","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"993","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"994","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"501","lease_end_date":"2026-10-15","outcome":"pending"},
  {"unit":"601","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 1) \g /dev/null
SELECT t_clock('2026-10-25T12:00Z') \g /dev/null

-- Read during October: nothing is in a snapshot yet.
SELECT t_check('uploads this month wait for the next monthly snapshot',
               (SELECT NOT leases_seen AND in_period = 0 AND took_part_rate IS NULL FROM public.get_lease_renewal_snapshot('DEMO')));

SELECT t_clock('2026-11-05T12:00Z') \g /dev/null
CREATE TEMP TABLE s AS SELECT * FROM public.get_lease_renewal_snapshot('DEMO');

-- Took part (3+ weeks): 201-204 + 101 decided = 5 households, 4 renewed; 205 pending.
-- Didn't: 301-305 + 402 + 401 (5 weeks of history, needs 2, has 0) = 7, 5 renewed.
-- Not on Miyora: 403, 999, 601, 991-994 = 7, 4 renewed.
SELECT t_check('snapshot is the 1st of this month; period is the 12 full months before it',
               (SELECT snapshot_date = '2026-11-01' AND period_from = '2025-11-01' AND period_to = '2026-10-31' FROM s));
SELECT t_check('21 leases in the period (402''s 2025 move-out is before it)',
               (SELECT leases_seen AND in_period = 21 AND repeats = 0 FROM s));
SELECT t_check('prorated: resident who joined mid-window is judged, not too new', (SELECT too_new FROM s) = 0);
SELECT t_check('pending excluded from rates (205, 501)', (SELECT pending FROM s) = 2);
SELECT t_check('took part 4/5 = 80', (SELECT took_part_rate FROM s) = 80);
SELECT t_check('didn''t 5/7 = 71.4 rounds to 70 (departed tenant not credited)', (SELECT others_rate FROM s) = 70);
SELECT t_check('not on Miyora (no resident, joined after lease end, management) 4/7 = 57.1 rounds to 55',
               (SELECT not_on_miyora_rate FROM s) = 55);
SELECT t_check('19 households -> band 15-29, no exact counts', (SELECT size_band FROM s) = '15-29');

-- ---------------------------------------------------------------
-- THE ATTACK: re-upload October with one unit's outcome flipped
-- (201 renewed -> moved_out) and one unit dropped (301).
-- ---------------------------------------------------------------
SELECT t_clock('2026-11-10T12:00Z') \g /dev/null
CREATE TEMP TABLE before_attack AS SELECT public.t_key('DEMO') AS k;
SELECT public.import_rent_roll('DEMO', '2026-10-01', 'oct-flipped.csv', $j$[
  {"unit":"201","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"202","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"203","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"204","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"205","lease_end_date":"2026-10-15","outcome":"pending"},
  {"unit":"101","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"302","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"303","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"304","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"305","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"401","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"402","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"403","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"999","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"991","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"992","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"993","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"994","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"501","lease_end_date":"2026-10-15","outcome":"pending"},
  {"unit":"601","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 0) \g /dev/null
SELECT t_check('the attack upload itself was saved (lease_records shows the flip)',
               (SELECT outcome FROM public.lease_records WHERE unit = '201' AND report_month = '2026-10-01') = 'moved_out'
               AND NOT EXISTS (SELECT 1 FROM public.lease_records WHERE unit = '301'));
-- Direct writes to lease_records are refused: import_rent_roll is the only path.
DO $$ BEGIN
  UPDATE public.lease_records SET outcome = 'moved_out' WHERE unit = '302';
  RAISE EXCEPTION 'FAIL: PM updated lease_records directly';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  PM can''t update lease_records directly';
END $$;
DO $$ BEGIN
  DELETE FROM public.lease_records WHERE unit = '303';
  RAISE EXCEPTION 'FAIL: PM deleted lease_records directly';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  PM can''t delete lease_records directly';
END $$;
-- Mid-month changes to live inputs (here: hiding 201's posts) don't move the
-- stored snapshot either.
RESET ROLE;
UPDATE public.posts SET is_hidden = true WHERE user_id = '00000000-0000-4000-8000-000000201001';
SET ROLE authenticated;
SELECT t_check('ATTACK, same month: tile output unchanged (also with content hidden mid-month)',
               public.t_key('DEMO') = (SELECT k FROM before_attack));
RESET ROLE;
UPDATE public.posts SET is_hidden = false WHERE user_id = '00000000-0000-4000-8000-000000201001';
SET ROLE authenticated;
SELECT t_clock('2026-12-05T12:00Z') \g /dev/null
SELECT t_check('ATTACK, next month''s snapshot: output still unchanged (outcomes locked, drops ignored)',
               public.t_key('DEMO') = (SELECT k FROM before_attack));
-- Displacing: a new, earlier "moved out" lease for 201 recorded now can't
-- replace the counted one, or detach 201's resident from it.
SELECT t_clock('2026-12-06T12:00Z') \g /dev/null
SELECT public.import_rent_roll('DEMO', '2026-01-01', 'jan.csv',
  '[{"unit":"201","lease_end_date":"2026-01-15","outcome":"moved_out"}]'::jsonb, 0) \g /dev/null
SELECT t_clock('2027-01-05T12:00Z') \g /dev/null
SELECT t_check('a later-recorded second lease for the same unit is a repeat, rates unchanged',
               (SELECT repeats = 1 AND took_part_rate = 80 AND others_rate = 70 AND not_on_miyora_rate = 55
                  FROM public.get_lease_renewal_snapshot('DEMO')));

-- Legitimate flow: pending resolves once, and shows from the next snapshot.
SELECT t_clock('2027-01-10T12:00Z') \g /dev/null
SELECT public.import_rent_roll('DEMO', '2026-12-01', 'dec.csv',
  '[{"unit":"205","lease_end_date":"2026-10-15","outcome":"moved_out"}]'::jsonb, 0) \g /dev/null
SELECT t_check('pending resolved mid-month: still pending in this month''s snapshot',
               (SELECT pending = 2 AND took_part_rate = 80 FROM public.get_lease_renewal_snapshot('DEMO')));
SELECT t_clock('2027-02-05T12:00Z') \g /dev/null
SELECT t_check('next snapshot: took part 4/6 = 66.7 rounds to 65',
               (SELECT pending = 1 AND took_part_rate = 65 FROM public.get_lease_renewal_snapshot('DEMO')));
SELECT public.import_rent_roll('DEMO', '2027-01-01', 'jan27.csv',
  '[{"unit":"205","lease_end_date":"2026-10-15","outcome":"renewed"}]'::jsonb, 0) \g /dev/null
SELECT t_clock('2027-03-05T12:00Z') \g /dev/null
SELECT t_check('a resolved outcome is locked too', (SELECT took_part_rate FROM public.get_lease_renewal_snapshot('DEMO')) = 65);
SELECT t_check('preview data: the PM gets their recorded leases back, locked outcomes included',
               (SELECT e->>'outcome' FROM jsonb_array_elements(public.get_recorded_leases('DEMO')) e
                 WHERE e->>'unit' = '201' AND e->>'lease_end_date' = '2026-10-15') = 'renewed'
               AND jsonb_array_length(public.get_recorded_leases('DEMO')) = 23);

-- PMs can't reach the ledger or the correction function.
DO $$ BEGIN
  PERFORM 1 FROM internal.lease_ledger;
  RAISE EXCEPTION 'FAIL: PM read the ledger';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  PM can''t read the ledger';
END $$;
DO $$ BEGIN
  PERFORM internal.correct_lease_outcome('DEMO', '201', '2026-10-15', 'moved_out', 'sneaky');
  RAISE EXCEPTION 'FAIL: PM corrected an outcome';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  PM can''t correct outcomes';
END $$;

-- Owner corrections: only through the function, always logged.
RESET ROLE;
SELECT t_check('every lease records which PM wrote it',
               (SELECT bool_and(recorded_by = 'aaaaaaaa-0000-4000-8000-000000000001' AND outcome_by IS NOT NULL)
                  FROM internal.lease_ledger WHERE community_code = 'DEMO'));
DO $$ BEGIN
  UPDATE internal.lease_ledger SET outcome = 'moved_out' WHERE community_code = 'DEMO' AND unit = '201';
  RAISE EXCEPTION 'FAIL: direct ledger update allowed';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  direct ledger update refused';
END $$;
DO $$ BEGIN
  DELETE FROM internal.lease_ledger WHERE community_code = 'DEMO' AND unit = '201';
  RAISE EXCEPTION 'FAIL: direct ledger delete allowed';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  direct ledger delete refused';
END $$;
DO $$ BEGIN
  PERFORM internal.correct_lease_outcome('DEMO', '201', '2026-10-15', 'moved_out', '  ');
  RAISE EXCEPTION 'FAIL: correction without a reason';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  correction needs a reason';
END $$;
SELECT t_clock('2027-03-10T12:00Z') \g /dev/null
SELECT internal.correct_lease_outcome('DEMO', 'Apt 201', '2026-10-15', 'moved_out', 'PM typo, confirmed by email') \g /dev/null
SELECT internal.correct_lease_outcome('DEMO', '991', '2026-10-15', NULL, 'not a real unit') \g /dev/null
SELECT t_check('corrections logged with old and new outcome, reason and who',
               (SELECT count(*) = 2
                       AND bool_and(corrected_by = current_user)
                       AND bool_or(unit = '201' AND old_outcome = 'renewed' AND new_outcome = 'moved_out' AND reason = 'PM typo, confirmed by email')
                       AND bool_or(unit = '991' AND new_outcome IS NULL)
                  FROM internal.lease_ledger_corrections));
SELECT t_check('flag is transaction-local: the lock is back on afterwards',
               COALESCE(current_setting('miyora.lease_correction', true), '') <> 'on');
SET ROLE authenticated;
SELECT t_clock('2027-04-05T12:00Z') \g /dev/null
-- Took part 3/6 = 50; not on Miyora with 991 removed: 3/6 = 50.
SELECT t_check('corrections show at the next snapshot',
               (SELECT took_part_rate = 50 AND not_on_miyora_rate = 50 FROM public.get_lease_renewal_snapshot('DEMO')));

-- Floor: 4 took-part households (8 leases) is under 5 -> all three hidden.
SELECT t_clock('2026-10-20T12:00Z') \g /dev/null
SELECT public.import_rent_roll('FLOOR', '2026-10-01', 'f.csv', $j$[
  {"unit":"11","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"11","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"12","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"12","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"13","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"13","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"14","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"14","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"21","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"22","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"23","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"24","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"25","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"N1","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"N2","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"N3","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"N4","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"N5","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 0) \g /dev/null
SELECT t_clock('2026-11-05T12:00Z') \g /dev/null
SELECT t_check('same upload, two leases per unit: earlier end date counts (4 repeats)',
               (SELECT in_period = 14 AND repeats = 4 FROM public.get_lease_renewal_snapshot('FLOOR')));
SELECT t_check('one group under 5 households: all three rates and the band hidden',
               (SELECT took_part_rate IS NULL AND others_rate IS NULL AND not_on_miyora_rate IS NULL AND size_band IS NULL
                  FROM public.get_lease_renewal_snapshot('FLOOR')));

-- PRO: which actions count, and proration edges. Window = weeks 08-03 .. 10-05 (10 weeks).
RESET ROLE;
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at) VALUES
  ('00000000-0000-4000-8000-000000801001', 'PRO', 'resident', 'E1', '2026-01-01Z'),  -- comments
  ('00000000-0000-4000-8000-000000802001', 'PRO', 'resident', 'E2', '2026-01-01Z'),  -- help requests
  ('00000000-0000-4000-8000-000000803001', 'PRO', 'resident', 'E3', '2026-01-01Z'),  -- RSVPs
  ('00000000-0000-4000-8000-000000804001', 'PRO', 'resident', 'E4', '2026-01-01Z'),  -- survey answers
  ('00000000-0000-4000-8000-000000805001', 'PRO', 'resident', 'E5', '2026-01-01Z'),  -- Connect requests
  ('00000000-0000-4000-8000-000000806001', 'PRO', 'resident', 'E6', '2026-09-14T00:00Z'), -- exactly 4 weeks, 1 post
  ('00000000-0000-4000-8000-000000901001', 'PRO', 'resident', 'O1', '2026-01-01Z'),  -- likes only
  ('00000000-0000-4000-8000-000000902001', 'PRO', 'resident', 'O2', '2026-01-01Z'),  -- hidden comments only
  ('00000000-0000-4000-8000-000000903001', 'PRO', 'resident', 'O3', '2026-01-01Z'),  -- 2 of 10 weeks
  ('00000000-0000-4000-8000-000000904001', 'PRO', 'resident', 'O4', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000905001', 'PRO', 'resident', 'O5', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000906001', 'PRO', 'resident', 'O6', '2026-09-16Z');     -- 3 weeks -> too new
INSERT INTO public.events (id, community_code) VALUES ('e0000000-0000-4000-8000-000000000001', 'PRO');
INSERT INTO public.surveys VALUES ('50000000-0000-4000-8000-000000000001', 'PRO');
INSERT INTO public.posts (user_id, community_code, created_at, id) VALUES
  ('00000000-0000-4000-8000-000000904001', 'PRO', '2026-07-01Z', 'f0000000-0000-4000-8000-000000000001');
INSERT INTO public.comments  SELECT '00000000-0000-4000-8000-000000801001', 'PRO', d FROM unnest(ARRAY['2026-08-03T00:00Z','2026-09-01Z','2026-10-11T23:59:59Z']::timestamptz[]) d;
INSERT INTO public.help_requests SELECT '00000000-0000-4000-8000-000000802001', 'PRO', d FROM unnest(ARRAY['2026-08-04Z','2026-08-12Z','2026-08-19Z']::timestamptz[]) d;
INSERT INTO public.event_rsvps (user_id, event_id, created_at) SELECT '00000000-0000-4000-8000-000000803001', 'e0000000-0000-4000-8000-000000000001', d FROM unnest(ARRAY['2026-08-04Z','2026-09-08Z','2026-10-06Z']::timestamptz[]) d;
INSERT INTO public.survey_responses SELECT '00000000-0000-4000-8000-000000804001', '50000000-0000-4000-8000-000000000001', d FROM unnest(ARRAY['2026-08-04Z','2026-09-08Z','2026-10-06Z']::timestamptz[]) d;
INSERT INTO public.connection_requests SELECT '00000000-0000-4000-8000-000000805001', 'PRO', d FROM unnest(ARRAY['2026-08-04Z','2026-09-08Z','2026-10-06Z']::timestamptz[]) d;
INSERT INTO public.posts (user_id, community_code, created_at) VALUES ('00000000-0000-4000-8000-000000806001', 'PRO', '2026-09-30Z');
INSERT INTO public.post_likes SELECT '00000000-0000-4000-8000-000000901001', 'f0000000-0000-4000-8000-000000000001', d FROM generate_series('2026-08-04'::timestamptz, '2026-10-06', '7 days') d;
INSERT INTO public.comments  SELECT '00000000-0000-4000-8000-000000902001', 'PRO', d, true FROM generate_series('2026-08-04'::timestamptz, '2026-10-06', '7 days') d;
INSERT INTO public.posts (user_id, community_code, created_at) VALUES
  ('00000000-0000-4000-8000-000000903001', 'PRO', '2026-07-28Z'),  -- before the community launched: doesn't count
  ('00000000-0000-4000-8000-000000903001', 'PRO', '2026-08-10Z'),
  ('00000000-0000-4000-8000-000000903001', 'PRO', '2026-09-10Z');
SET ROLE authenticated;
SELECT t_clock('2026-10-20T12:00Z') \g /dev/null
SELECT public.import_rent_roll('PRO', '2026-10-01', 'p.csv', $j$[
  {"unit":"E1","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"E2","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"E3","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"E4","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"E5","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"E6","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"O1","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"O2","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"O3","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"O4","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"O5","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"O6","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 0) \g /dev/null
SELECT t_clock('2026-11-05T12:00Z') \g /dev/null
SELECT t_check('no households off Miyora (0 < 5): all three hidden',
               (SELECT took_part_rate IS NULL AND others_rate IS NULL AND not_on_miyora_rate IS NULL
                  FROM public.get_lease_renewal_snapshot('PRO')));
SELECT t_clock('2026-11-10T12:00Z') \g /dev/null
SELECT public.import_rent_roll('PRO', '2026-09-01', 'p-sep.csv', $j$[
  {"unit":"N1","lease_end_date":"2026-09-15","outcome":"renewed"}, {"unit":"N2","lease_end_date":"2026-09-15","outcome":"renewed"},
  {"unit":"N3","lease_end_date":"2026-09-15","outcome":"moved_out"}, {"unit":"N4","lease_end_date":"2026-09-15","outcome":"moved_out"},
  {"unit":"N5","lease_end_date":"2026-09-15","outcome":"moved_out"}
]$j$::jsonb, 0) \g /dev/null
SELECT t_clock('2026-12-05T12:00Z') \g /dev/null
CREATE TEMP TABLE p AS SELECT * FROM public.get_lease_renewal_snapshot('PRO');
SELECT t_check('3 weeks of history is too new; exactly 4 is judged', (SELECT too_new FROM p) = 1);
SELECT t_check('comments, help, RSVPs, surveys, Connect, 1 post in 4 weeks all count: took part 5/6 = 83.3 rounds to 85',
               (SELECT took_part_rate FROM p) = 85);
SELECT t_check('likes only, hidden comments only, 2 of 10 weeks = didn''t: 1/5 = 20', (SELECT others_rate FROM p) = 20);
SELECT t_check('not on Miyora 2/5 = 40', (SELECT not_on_miyora_rate FROM p) = 40);

-- Same answer under a non-UTC session: every conversion is explicit UTC.
SET TimeZone = 'America/Los_Angeles';
SELECT t_check('session time zone does not change the result',
               (SELECT row(x.*)::text FROM public.get_lease_renewal_snapshot('PRO') x) = (SELECT row(p.*)::text FROM p));
RESET TimeZone;

-- BND: rounding at 5 weeks of history (needs ceil(5*3/12) = 2), negative history.
RESET ROLE;
-- B1-B5 and C1-C5 joined Mon 2026-09-07 00:00 -> exactly 5 weeks before the lease-end week (10-12).
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at)
SELECT ('00000000-0000-4000-8000-000000a' || g || n || '001')::uuid, 'BND', 'resident', g || n, '2026-09-07T00:00Z'
  FROM unnest(ARRAY['b','c']) g, generate_series(1, 5) n;
-- D1 joined Tue 10-13: after the lease-end Monday, before the lease ended -> negative history, too new.
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at) VALUES
  ('00000000-0000-4000-8000-000000ad1001', 'BND', 'resident', 'D1', '2026-10-13Z');
-- B: 2 active weeks (took part). C: 1 active week, posted twice (didn't).
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000ab' || n || '001')::uuid, 'BND', d
  FROM generate_series(1, 5) n, unnest(ARRAY['2026-09-08Z', '2026-10-06Z']::timestamptz[]) d;
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000ac' || n || '001')::uuid, 'BND', d
  FROM generate_series(1, 5) n, unnest(ARRAY['2026-09-08Z', '2026-09-09Z']::timestamptz[]) d;
SET ROLE authenticated;
SELECT t_clock('2026-10-20T12:00Z') \g /dev/null
-- B renewed, C moved out, N (no resident) renewed: the split shows in the rates.
SELECT public.import_rent_roll('BND', '2026-10-01', 'b.csv',
  (SELECT jsonb_agg(jsonb_build_object('unit', u, 'lease_end_date', '2026-10-15',
                                       'outcome', CASE WHEN u LIKE 'C%' THEN 'moved_out' ELSE 'renewed' END))
     FROM unnest(ARRAY['B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','N1','N2','N3','N4','N5']) u), 0) \g /dev/null
SELECT t_clock('2026-11-05T12:00Z') \g /dev/null
SELECT t_check('5 weeks of history: 2 active weeks = took part (100), 1 = didn''t (0)',
               (SELECT took_part_rate = 100 AND others_rate = 0 AND not_on_miyora_rate = 100
                  FROM public.get_lease_renewal_snapshot('BND')));
SELECT t_check('joined after the lease-end Monday: negative history clamped, too new',
               (SELECT too_new FROM public.get_lease_renewal_snapshot('BND')) = 1);

-- BAND: 5 took part, 5 didn't, and a growing number of households not on Miyora.
RESET ROLE;
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at)
SELECT ('00000000-0000-4000-8000-000000b' || CASE g WHEN 'e' THEN 'e' ELSE 'f' END || n || '001')::uuid, 'BAND', 'resident', upper(g) || n, '2026-01-01Z'
  FROM unnest(ARRAY['e','o']) g, generate_series(1, 5) n;
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000be' || n || '001')::uuid, 'BAND', d
  FROM generate_series(1, 5) n, generate_series('2026-07-21'::timestamptz, '2026-10-06', '7 days') d;
SET ROLE authenticated;
SELECT t_clock('2026-10-20T12:00Z') \g /dev/null
SELECT public.import_rent_roll('BAND', '2026-10-01', 'band.csv',
  (SELECT jsonb_agg(jsonb_build_object('unit', u, 'lease_end_date', '2026-10-15', 'outcome', 'renewed'))
     FROM (SELECT unnest(ARRAY['E1','E2','E3','E4','E5','O1','O2','O3','O4','O5']) u
           UNION ALL SELECT 'X' || n FROM generate_series(1, 19) n) x), 0) \g /dev/null
SELECT t_clock('2026-11-05T12:00Z') \g /dev/null
SELECT t_check('29 households -> 15-29', (SELECT size_band FROM public.get_lease_renewal_snapshot('BAND')) = '15-29');
SELECT t_clock('2026-11-10T12:00Z') \g /dev/null
SELECT public.import_rent_roll('BAND', '2026-09-01', 'band-sep.csv',
  '[{"unit":"X20","lease_end_date":"2026-09-15","outcome":"renewed"}]'::jsonb, 0) \g /dev/null
SELECT t_clock('2026-12-05T12:00Z') \g /dev/null
SELECT t_check('30 households -> 30-99', (SELECT size_band FROM public.get_lease_renewal_snapshot('BAND')) = '30-99');
SELECT t_clock('2026-12-10T12:00Z') \g /dev/null
SELECT public.import_rent_roll('BAND', '2026-08-01', 'band-aug.csv',
  (SELECT jsonb_agg(jsonb_build_object('unit', 'X' || n, 'lease_end_date', '2026-08-15', 'outcome', 'renewed'))
     FROM generate_series(21, 90) n), 0) \g /dev/null
SELECT t_clock('2027-01-05T12:00Z') \g /dev/null
SELECT t_check('100 households -> 100+', (SELECT size_band FROM public.get_lease_renewal_snapshot('BAND')) = '100+');

-- MOV: a pending earlier lease resolved to moved_out LATER must not detach
-- the current household from its counted lease (review finding).
RESET ROLE;
INSERT INTO internal.pm_map VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'MOV');
INSERT INTO public.communities VALUES ('MOV', '2026-01-01Z');
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at)
SELECT ('00000000-0000-4000-8000-000000d' || CASE g WHEN 'T' THEN 'a' ELSE 'b' END || n || '001')::uuid,
       'MOV', 'resident', g || n, '2025-01-01Z'
  FROM unnest(ARRAY['T','O']) g, generate_series(1, 5) n;
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000da' || n || '001')::uuid, 'MOV', d
  FROM generate_series(1, 5) n, generate_series('2026-07-21'::timestamptz, '2026-10-06', '7 days') d;
SET ROLE authenticated;
SELECT t_clock('2026-10-20T12:00Z') \g /dev/null
SELECT public.import_rent_roll('MOV', '2026-10-01', 'm.csv',
  (SELECT jsonb_agg(jsonb_build_object('unit', u, 'lease_end_date', '2026-10-15',
                                       'outcome', CASE WHEN u LIKE 'T%' THEN 'renewed' ELSE 'moved_out' END))
     FROM unnest(ARRAY['T1','T2','T3','T4','T5','O1','O2','O3','O4','O5','N1','N2','N3','N4','N5']) u)
  || '[{"unit":"T1","lease_end_date":"2025-06-30","outcome":"pending"}]'::jsonb, 0) \g /dev/null
SELECT t_clock('2026-11-05T12:00Z') \g /dev/null
CREATE TEMP TABLE mov_nov AS SELECT public.t_key('MOV') AS k;
SELECT t_check('MOV baseline: took part 100, others 0, not on Miyora 0',
               (SELECT took_part_rate = 100 AND others_rate = 0 AND not_on_miyora_rate = 0
                  FROM public.get_lease_renewal_snapshot('MOV')));
SELECT t_clock('2026-11-10T12:00Z') \g /dev/null
SELECT public.import_rent_roll('MOV', '2025-06-01', 'm-jun.csv',
  '[{"unit":"T1","lease_end_date":"2025-06-30","outcome":"moved_out"}]'::jsonb, 0) \g /dev/null
SELECT t_clock('2026-12-05T12:00Z') \g /dev/null
SELECT t_check('resolving an earlier pending lease to moved_out later doesn''t detach the household',
               public.t_key('MOV') = (SELECT k FROM mov_nov));

-- Atomic import: a bad unit aborts the whole save, leaving the previous version.
DO $$ BEGIN
  PERFORM public.import_rent_roll('DEMO', '2026-11-01', 'bad.csv', '[{"unit":"apt 4b","lease_end_date":"2026-10-15","outcome":"renewed"}]'::jsonb, 0);
  RAISE EXCEPTION 'FAIL: bad unit was accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok  bad unit rejected by CHECK';
END $$;
SELECT t_check('re-upload replaces exactly that month', (SELECT count(*) FROM public.lease_records WHERE community_code = 'DEMO' AND report_month = '2026-10-01') = 20);
SELECT t_check('upload log counts re-uploads',
               (SELECT upload_count FROM public.rent_roll_uploads WHERE community_code = 'DEMO' AND report_month = '2026-10-01') = 2);

-- Another PM: no reads, no writes, no snapshot, no recorded leases.
SELECT set_config('test.uid', 'bbbbbbbb-0000-4000-8000-000000000002', false) \g /dev/null
SELECT t_check('other PM sees no lease rows', (SELECT count(*) FROM public.lease_records) = 0);
SELECT t_check('other PM sees no uploads', (SELECT count(*) FROM public.rent_roll_uploads) = 0);
DO $$ BEGIN
  PERFORM * FROM public.get_lease_renewal_snapshot('DEMO');
  RAISE EXCEPTION 'FAIL: other PM got a snapshot';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  other PM refused the snapshot';
END $$;
DO $$ BEGIN
  PERFORM public.get_recorded_leases('DEMO');
  RAISE EXCEPTION 'FAIL: other PM got recorded leases';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  other PM refused recorded leases';
END $$;
DO $$ BEGIN
  PERFORM public.import_rent_roll('DEMO', '2026-12-01', 'x.csv', '[]'::jsonb, 0);
  RAISE EXCEPTION 'FAIL: other PM imported';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  other PM refused the import';
END $$;
DO $$ BEGIN
  INSERT INTO public.rent_roll_uploads (community_code, report_month, row_count) VALUES ('DEMO', '2026-12-01', 0);
  RAISE EXCEPTION 'FAIL: other PM inserted directly';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  RLS blocks a direct insert';
END $$;

-- ---------------------------------------------------------------
-- compute_community_metrics: hidden posts and comments never count.
-- ---------------------------------------------------------------
RESET ROLE;
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at) VALUES
  ('00000000-0000-4000-8000-000000c01001', 'MET', 'resident', '1', '2026-01-01Z'),  -- visible content
  ('00000000-0000-4000-8000-000000c02001', 'MET', 'resident', '2', '2026-01-01Z'),  -- hidden only
  ('00000000-0000-4000-8000-000000c03001', 'MET', 'resident', '3', '2026-01-01Z');  -- is_hidden NULL comment
INSERT INTO public.posts (user_id, community_code, created_at, is_hidden) VALUES
  ('00000000-0000-4000-8000-000000c01001', 'MET', '2026-10-06T12:00Z', false),
  ('00000000-0000-4000-8000-000000c01001', 'MET', '2026-10-07T12:00Z', false),
  ('00000000-0000-4000-8000-000000c02001', 'MET', '2026-10-07T12:00Z', true);
INSERT INTO public.comments (user_id, community_code, created_at, is_hidden) VALUES
  ('00000000-0000-4000-8000-000000c01001', 'MET', '2026-10-06T12:00Z', false),
  ('00000000-0000-4000-8000-000000c02001', 'MET', '2026-10-06T12:00Z', true),
  ('00000000-0000-4000-8000-000000c02001', 'MET', '2026-10-08T12:00Z', true),
  ('00000000-0000-4000-8000-000000c03001', 'MET', '2026-10-08T12:00Z', NULL);
SELECT t_check('metrics: hidden posts/comments skipped (NULL = visible); hidden-only author not active',
               (SELECT posts = 2 AND comments = 2 AND active_residents = 2
                  FROM internal.compute_community_metrics('MET', '2026-10-05', '2026-10-11')));

\echo 'ALL RENEWAL SQL CHECKS PASSED'
