-- Edge cases for import_rent_roll (portal 036) and get_lease_renewal_summary
-- (Miyora 20261109120000). Run with scripts/test-renewal-sql.sh — it loads
-- stub.sql and both migrations into a throwaway local Postgres first.
-- Every t_check raises on failure, and the script runs with ON_ERROR_STOP.
--
-- Community DEMO, created 2026-03-01. Most leases end Thu 2026-10-15, so the
-- lease-end week starts Mon 2026-10-12 and the 12-week window is the weeks
-- starting 2026-07-20 … 2026-10-05.

\set QUIET on
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

INSERT INTO auth.users VALUES ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');
INSERT INTO public.property_managers VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Pat Manager');
INSERT INTO internal.pm_map VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'DEMO'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'FLOOR'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'OTHER');
INSERT INTO public.communities VALUES ('DEMO', '2026-03-01T12:00Z'), ('FLOOR', '2026-03-01T12:00Z'), ('OTHER', '2026-03-01T12:00Z');

-- Residents. id = 00..0<unit><n> for readability.
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at) VALUES
  -- engaged units 201-205 and roommates in 101
  ('00000000-0000-4000-8000-000000201001', 'DEMO', 'resident', '201', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000202001', 'DEMO', 'resident', 'Apt 0202', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000203001', 'DEMO', 'resident', '203', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000204001', 'DEMO', 'resident', '204', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000205001', 'DEMO', 'resident', '205', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000101001', 'DEMO', 'resident', '101', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000101002', 'DEMO', 'resident', '101', '2026-01-01Z'),
  -- others 301-305
  ('00000000-0000-4000-8000-000000301001', 'DEMO', 'resident', '301', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000302001', 'DEMO', 'resident', '302', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000303001', 'DEMO', 'resident', '303', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000304001', 'DEMO', 'resident', '304', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000305001', 'DEMO', 'resident', '305', '2026-01-01Z'),
  -- 401 joined mid-window -> too new
  ('00000000-0000-4000-8000-000000401001', 'DEMO', 'resident', '401', '2026-09-01Z'),
  -- 402: departed tenant (very active) still in the app; new tenant (silent) joined after the move-out
  ('00000000-0000-4000-8000-000000402001', 'DEMO', 'resident', '402', '2025-01-01Z'),
  ('00000000-0000-4000-8000-000000402002', 'DEMO', 'resident', '402', '2026-04-10Z'),
  -- 403 joined after its lease ended -> unmatched
  ('00000000-0000-4000-8000-000000403001', 'DEMO', 'resident', '403', '2026-10-20Z'),
  -- 501 pending
  ('00000000-0000-4000-8000-000000501001', 'DEMO', 'resident', '501', '2026-01-01Z'),
  -- 601 is management, not a resident -> unmatched
  ('00000000-0000-4000-8000-000000601001', 'DEMO', 'admin', '601', '2026-01-01Z'),
  -- FLOOR community: 4 engaged units (2 leases each) + 5 others
  ('00000000-0000-4000-8000-000000711001', 'FLOOR', 'resident', '11', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000712001', 'FLOOR', 'resident', '12', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000713001', 'FLOOR', 'resident', '13', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000714001', 'FLOOR', 'resident', '14', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000721001', 'FLOOR', 'resident', '21', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000722001', 'FLOOR', 'resident', '22', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000723001', 'FLOOR', 'resident', '23', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000724001', 'FLOOR', 'resident', '24', '2026-01-01Z'),
  ('00000000-0000-4000-8000-000000725001', 'FLOOR', 'resident', '25', '2026-01-01Z');

-- Activity. Engaged units: exactly 3 window weeks, including both edges.
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
-- FLOOR: engaged units post every window week of both their leases.
INSERT INTO public.posts
SELECT ('00000000-0000-4000-8000-0000007' || u || '001')::uuid, 'FLOOR', d
  FROM unnest(ARRAY['11','12','13','14']) u, generate_series('2026-06-01'::timestamptz, '2026-10-06', '7 days') d;

SET ROLE authenticated;
SELECT set_config('test.uid', 'aaaaaaaa-0000-4000-8000-000000000001', false) \g /dev/null

-- October roll: everything; 205 still pending. 402 also has an earlier lease.
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
  {"unit":"402","lease_end_date":"2026-03-31","outcome":"moved_out"},
  {"unit":"402","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"403","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"999","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"501","lease_end_date":"2026-10-15","outcome":"pending"},
  {"unit":"601","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 1) \g /dev/null

CREATE TEMP VIEW s AS SELECT * FROM public.get_lease_renewal_summary('DEMO', '2026-06-01', '2026-11-09', 12, 3);

-- Engaged (3+ weeks): 201-204 + 101 decided = 5 units; 205 pending. Others: 301-305 + 402 = 6.
SELECT t_check('range keeps 17 leases (402''s March lease is outside it)', (SELECT total FROM s) = 17);
SELECT t_check('unmatched: joined after lease end, no resident, management', (SELECT unmatched FROM s) = 3);
SELECT t_check('too new: resident joined mid-window', (SELECT too_new FROM s) = 1);
SELECT t_check('pending excluded from rates', (SELECT pending FROM s) = 2);
SELECT t_check('3 weeks incl. both window edges = engaged; roommates combine', (SELECT engaged_leases FROM s) = 5);
SELECT t_check('engaged rate 4/5', (SELECT engaged_rate FROM s) = 80);
SELECT t_check('2 weeks (outside-window and lease-end-week posts ignored) = others; departed tenant not credited',
               (SELECT others_leases FROM s) = 6);
SELECT t_check('others rate 4/6 rounds to 67', (SELECT others_rate FROM s) = 67);

-- Threshold edge: at 2 weeks the others become engaged too.
-- Engaged becomes 10 leases (7 renewed); others shrink to 402 alone, so they
-- are suppressed and no counts are returned.
SELECT t_check('min_weeks 2 moves the 2-week units into engaged (7/10)',
               (SELECT engaged_rate = 70 AND others_rate IS NULL AND engaged_leases IS NULL
                  FROM public.get_lease_renewal_summary('DEMO', '2026-06-01', '2026-11-09', 12, 2)));

-- Range edges are inclusive.
SELECT t_check('range ending the day before the lease ends: none',
               (SELECT total FROM public.get_lease_renewal_summary('DEMO', '2026-06-01', '2026-10-14', 12, 3)) = 0);
SELECT t_check('range starting on the lease-end day: all', (SELECT total FROM public.get_lease_renewal_summary('DEMO', '2026-10-15', '2026-10-15', 12, 3)) = 17);
SELECT t_check('all time includes the March lease (too new: before the community''s first window)',
               (SELECT total = 18 AND too_new = 2 FROM public.get_lease_renewal_summary('DEMO', NULL, '2026-11-09', 12, 3)));

-- November roll settles 205; newest month wins.
SELECT public.import_rent_roll('DEMO', '2026-11-01', 'nov.csv',
  '[{"unit":"205","lease_end_date":"2026-10-15","outcome":"moved_out"}]'::jsonb, 0) \g /dev/null
SELECT t_check('newer month updates the outcome', (SELECT engaged_leases = 6 AND pending = 1 FROM public.get_lease_renewal_summary('DEMO', '2026-06-01', '2026-11-09', 12, 3)));
-- Re-uploading October again doesn't override November.
SELECT public.import_rent_roll('DEMO', '2026-10-01', 'oct-again.csv',
  '[{"unit":"205","lease_end_date":"2026-10-15","outcome":"pending"}, {"unit":"201","lease_end_date":"2026-10-15","outcome":"renewed"}]'::jsonb, 0) \g /dev/null
SELECT t_check('re-uploading an older month never overrides a newer one',
               (SELECT outcome FROM (SELECT DISTINCT ON (unit) unit, outcome FROM public.lease_records
                                      WHERE unit = '205' ORDER BY unit, report_month DESC) x) = 'moved_out');
SELECT t_check('re-upload replaces exactly that month', (SELECT count(*) FROM public.lease_records WHERE report_month = '2026-10-01') = 2);
-- Re-uploading November without 205 falls back to October's row (nothing lost).
SELECT public.import_rent_roll('DEMO', '2026-11-01', 'nov-v2.csv',
  '[{"unit":"999","lease_end_date":"2026-10-15","outcome":"moved_out"}]'::jsonb, 0) \g /dev/null
SELECT t_check('dropping a lease from a month falls back to the earlier month',
               (SELECT outcome FROM (SELECT DISTINCT ON (unit) unit, outcome FROM public.lease_records
                                      WHERE unit = '205' ORDER BY unit, report_month DESC) x) = 'pending');
SELECT t_check('upload log counts re-uploads',
               (SELECT upload_count FROM public.rent_roll_uploads WHERE community_code = 'DEMO' AND report_month = '2026-11-01') = 2);

-- Atomic: a bad unit aborts the whole save, leaving the previous version.
DO $$ BEGIN
  PERFORM public.import_rent_roll('DEMO', '2026-11-01', 'bad.csv', '[{"unit":"apt 4b","lease_end_date":"2026-10-15","outcome":"renewed"}]'::jsonb, 0);
  RAISE EXCEPTION 'FAIL: bad unit was accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok  bad unit rejected by CHECK';
END $$;
SELECT t_check('failed save left the month unchanged',
               (SELECT file_name FROM public.rent_roll_uploads WHERE community_code = 'DEMO' AND report_month = '2026-11-01') = 'nov-v2.csv');

-- Floor: 4 engaged units with 8 leases between them is still under 5 units.
SELECT public.import_rent_roll('FLOOR', '2026-10-01', 'f.csv', $j$[
  {"unit":"11","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"11","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"12","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"12","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"13","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"13","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"14","lease_end_date":"2026-09-30","outcome":"renewed"}, {"unit":"14","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"21","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"22","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"23","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"24","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"25","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 0) \g /dev/null
CREATE TEMP VIEW f AS SELECT * FROM public.get_lease_renewal_summary('FLOOR', '2026-06-01', '2026-11-09', 12, 3);
SELECT t_check('4 distinct units (8 leases): engaged rate suppressed', (SELECT engaged_rate IS NULL FROM f));
SELECT t_check('5 distinct units: others rate shown (3/5)', (SELECT others_rate FROM f) = 60);
SELECT t_check('one group suppressed: no group counts at all',
               (SELECT engaged_leases IS NULL AND engaged_renewed IS NULL AND others_leases IS NULL AND others_renewed IS NULL FROM f));

-- Guards.
DO $$ BEGIN
  PERFORM * FROM public.get_lease_renewal_summary('DEMO', NULL, '2026-11-09', 1, 1);
  RAISE EXCEPTION 'FAIL: 1-week window accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  window under 8 weeks refused';
END $$;
DO $$ BEGIN
  PERFORM * FROM public.get_lease_renewal_summary('DEMO', NULL, '2026-11-09', 12, 0);
  RAISE EXCEPTION 'FAIL: min_weeks 0 accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  min_weeks 0 refused';
END $$;

-- Another PM: no reads, no writes, no summary.
SELECT set_config('test.uid', 'bbbbbbbb-0000-4000-8000-000000000002', false) \g /dev/null
SELECT t_check('other PM sees no lease rows', (SELECT count(*) FROM public.lease_records) = 0);
SELECT t_check('other PM sees no uploads', (SELECT count(*) FROM public.rent_roll_uploads) = 0);
DO $$ BEGIN
  PERFORM * FROM public.get_lease_renewal_summary('DEMO', NULL, '2026-11-09', 12, 3);
  RAISE EXCEPTION 'FAIL: other PM got a summary';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  other PM refused the summary';
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

RESET ROLE;
\echo 'ALL RENEWAL SQL CHECKS PASSED'
