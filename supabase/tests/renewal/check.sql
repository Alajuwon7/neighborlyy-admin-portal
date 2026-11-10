-- Edge cases for import_rent_roll (portal 036) and get_lease_renewal_summary
-- (Miyora 20261109120000, body replaced by 20261110120000: took part only,
-- prorated history, min 4 weeks). Run with scripts/test-renewal-sql.sh — it loads
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
  ('aaaaaaaa-0000-4000-8000-000000000001', 'PRO'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'OTHER');
INSERT INTO public.communities VALUES ('DEMO', '2026-03-01T12:00Z'), ('FLOOR', '2026-03-01T12:00Z'), ('OTHER', '2026-03-01T12:00Z'),
  -- PRO launched Mon 2026-08-03: leases ending 10-15 have 10 weeks of history (need ceil(10*3/12) = 3).
  ('PRO', '2026-08-03T12:00Z');

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
  -- 401 joined Tue 2026-09-01 -> judged on the 5 full weeks from Mon 09-07 (prorated)
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

-- Engaged (3+ weeks): 201-204 + 101 decided = 5 units; 205 pending.
-- Others: 301-305 + 402 + 401 (5 weeks of history, needs 2, has 0) = 7.
SELECT t_check('range keeps 17 leases (402''s March lease is outside it)', (SELECT total FROM s) = 17);
SELECT t_check('unmatched: joined after lease end, no resident, management', (SELECT unmatched FROM s) = 3);
SELECT t_check('prorated: resident who joined mid-window is judged, not too new', (SELECT too_new FROM s) = 0);
SELECT t_check('pending excluded from rates', (SELECT pending FROM s) = 2);
SELECT t_check('3 weeks incl. both window edges = engaged; roommates combine', (SELECT engaged_leases FROM s) = 5);
SELECT t_check('engaged rate 4/5', (SELECT engaged_rate FROM s) = 80);
SELECT t_check('2 weeks (outside-window and lease-end-week posts ignored) = others; departed tenant not credited',
               (SELECT others_leases FROM s) = 7);
SELECT t_check('others rate 5/7 rounds to 71', (SELECT others_rate FROM s) = 71);

-- Threshold edge: at 2 weeks the others become engaged too.
-- Engaged becomes 10 leases (7 renewed); others shrink to 402 + 401, so they
-- are suppressed and no counts are returned.
SELECT t_check('min_weeks 2 moves the 2-week units into engaged (7/10)',
               (SELECT engaged_rate = 70 AND others_rate IS NULL AND engaged_leases IS NULL
                  FROM public.get_lease_renewal_summary('DEMO', '2026-06-01', '2026-11-09', 12, 2)));

-- Range edges are inclusive.
SELECT t_check('range ending the day before the lease ends: none',
               (SELECT total FROM public.get_lease_renewal_summary('DEMO', '2026-06-01', '2026-10-14', 12, 3)) = 0);
SELECT t_check('range starting on the lease-end day: all', (SELECT total FROM public.get_lease_renewal_summary('DEMO', '2026-10-15', '2026-10-15', 12, 3)) = 17);
SELECT t_check('all time includes the March lease, judged on its 5 weeks since the community launched',
               (SELECT total = 18 AND too_new = 0 AND others_leases = 8
                  FROM public.get_lease_renewal_summary('DEMO', NULL, '2026-11-09', 12, 3)));

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
INSERT INTO public.events VALUES ('e0000000-0000-4000-8000-000000000001', 'PRO');
INSERT INTO public.surveys VALUES ('50000000-0000-4000-8000-000000000001', 'PRO');
INSERT INTO public.posts (user_id, community_code, created_at, id) VALUES
  ('00000000-0000-4000-8000-000000904001', 'PRO', '2026-07-01Z', 'f0000000-0000-4000-8000-000000000001');
INSERT INTO public.comments  SELECT '00000000-0000-4000-8000-000000801001', 'PRO', d FROM unnest(ARRAY['2026-08-03T00:00Z','2026-09-01Z','2026-10-11T23:59:59Z']::timestamptz[]) d;
INSERT INTO public.help_requests SELECT '00000000-0000-4000-8000-000000802001', 'PRO', d FROM unnest(ARRAY['2026-08-04Z','2026-08-12Z','2026-08-19Z']::timestamptz[]) d;
INSERT INTO public.event_rsvps SELECT '00000000-0000-4000-8000-000000803001', 'e0000000-0000-4000-8000-000000000001', d FROM unnest(ARRAY['2026-08-04Z','2026-09-08Z','2026-10-06Z']::timestamptz[]) d;
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
SELECT public.import_rent_roll('PRO', '2026-10-01', 'p.csv', $j$[
  {"unit":"E1","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"E2","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"E3","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"E4","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"E5","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"E6","lease_end_date":"2026-10-15","outcome":"renewed"},
  {"unit":"O1","lease_end_date":"2026-10-15","outcome":"renewed"}, {"unit":"O2","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"O3","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"O4","lease_end_date":"2026-10-15","outcome":"moved_out"},
  {"unit":"O5","lease_end_date":"2026-10-15","outcome":"moved_out"}, {"unit":"O6","lease_end_date":"2026-10-15","outcome":"renewed"}
]$j$::jsonb, 0) \g /dev/null
CREATE TEMP VIEW p AS SELECT * FROM public.get_lease_renewal_summary('PRO', '2025-11-09', '2026-11-09', 12, 3);
SELECT t_check('3 weeks of history is too new; exactly 4 is judged', (SELECT too_new FROM p) = 1);
SELECT t_check('comments, help, RSVPs, surveys, Connect all count; 1 post in 4 weeks counts (6 engaged)',
               (SELECT engaged_leases FROM p) = 6);
SELECT t_check('engaged rate 5/6 rounds to 83', (SELECT engaged_rate FROM p) = 83);
SELECT t_check('likes only, hidden comments only, 2 of 10 weeks = others (5)', (SELECT others_leases FROM p) = 5);
SELECT t_check('others rate 1/5', (SELECT others_rate FROM p) = 20);

-- Same answer under a non-UTC session: every conversion is explicit UTC.
SET TimeZone = 'America/Los_Angeles';
SELECT t_check('session time zone does not change the result',
               (SELECT row(x.*)::text FROM public.get_lease_renewal_summary('PRO', '2025-11-09', '2026-11-09', 12, 3) x)
             = (SELECT row(p.*)::text FROM p));
RESET TimeZone;

-- BND: rounding at 5 weeks of history (needs ceil(5*3/12) = 2), negative history,
-- (A missing communities row can't happen: rent_roll_uploads has an FK to communities.)
RESET ROLE;
INSERT INTO internal.pm_map VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'BND');
INSERT INTO public.communities VALUES ('BND', '2026-01-01Z');
-- B1-B5 and C1-C5 joined Mon 2026-09-07 00:00 -> exactly 5 weeks before the lease-end week (10-12).
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at)
SELECT ('00000000-0000-4000-8000-000000a' || g || n || '001')::uuid, 'BND', 'resident', g || n, '2026-09-07T00:00Z'
  FROM unnest(ARRAY['b','c']) g, generate_series(1, 5) n;
-- D1 joined Tue 10-13: after the lease-end Monday, before the lease ended -> negative history, too new.
INSERT INTO public.profiles (id, community_code, role, unit_number, created_at) VALUES
  ('00000000-0000-4000-8000-000000ad1001', 'BND', 'resident', 'D1', '2026-10-13Z');
-- B: 2 active weeks (engaged). C: 1 active week, posted twice (others).
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000ab' || n || '001')::uuid, 'BND', d
  FROM generate_series(1, 5) n, unnest(ARRAY['2026-09-08Z', '2026-10-06Z']::timestamptz[]) d;
INSERT INTO public.posts (user_id, community_code, created_at)
SELECT ('00000000-0000-4000-8000-000000ac' || n || '001')::uuid, 'BND', d
  FROM generate_series(1, 5) n, unnest(ARRAY['2026-09-08Z', '2026-09-09Z']::timestamptz[]) d;
SET ROLE authenticated;
SELECT public.import_rent_roll('BND', '2026-10-01', 'b.csv',
  (SELECT jsonb_agg(jsonb_build_object('unit', u, 'lease_end_date', '2026-10-15', 'outcome', 'renewed'))
     FROM unnest(ARRAY['B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1']) u), 0) \g /dev/null
SELECT t_check('5 weeks of history: 2 active weeks = engaged, 1 = others',
               (SELECT engaged_leases = 5 AND others_leases = 5
                  FROM public.get_lease_renewal_summary('BND', '2025-11-09', '2026-11-09', 12, 3)));
SELECT t_check('joined after the lease-end Monday: negative history clamped, too new',
               (SELECT too_new FROM public.get_lease_renewal_summary('BND', '2025-11-09', '2026-11-09', 12, 3)) = 1);

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
