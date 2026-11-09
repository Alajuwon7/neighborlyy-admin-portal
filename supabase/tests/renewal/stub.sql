-- Stand-ins for the shared Supabase objects 036 and get_lease_renewal_summary
-- depend on, so both migrations can be tested on a throwaway local Postgres.
-- NEVER run against a real project. Used by scripts/test-renewal-sql.sh.
-- resident_action_user_ids is reduced to posts only; the real one unions nine
-- tables with the same (community, window, current-resident) filter.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth; CREATE SCHEMA internal;
GRANT USAGE ON SCHEMA public, internal, auth TO authenticated;
CREATE TABLE auth.users (id uuid primary key);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.communities (community_code text unique not null, created_at timestamptz not null);
CREATE TABLE public.property_managers (user_id uuid, full_name text);
GRANT SELECT ON public.property_managers TO authenticated;
CREATE TABLE public.profiles (id uuid primary key, community_code text, role text, exclude_from_leaderboard boolean default false, unit_number text, created_at timestamptz, is_platform_owner boolean default false);
CREATE TABLE public.posts (user_id uuid, community_code text, created_at timestamptz);
-- PM -> communities they manage
CREATE TABLE internal.pm_map (user_id uuid, community_code text);
CREATE FUNCTION internal.auth_user_manages_community(c text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM internal.pm_map WHERE user_id = auth.uid() AND community_code = c) $$;
CREATE FUNCTION internal.auth_user_is_admin_in(c text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated;
CREATE FUNCTION internal.resident_action_user_ids(p_community_code text, p_start timestamptz, p_end timestamptz) RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT DISTINCT x.user_id FROM public.posts x JOIN public.profiles pr ON pr.id = x.user_id
   WHERE x.community_code = p_community_code AND x.created_at >= p_start AND x.created_at < p_end
     AND pr.role = 'resident' AND NOT pr.exclude_from_leaderboard $$;

CREATE FUNCTION public.t_check(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'ok  %', label;
END $$;
GRANT EXECUTE ON FUNCTION public.t_check(text, boolean) TO authenticated;
