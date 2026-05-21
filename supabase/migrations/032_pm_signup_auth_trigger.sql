-- =============================================================================
-- Migration: 032_pm_signup_auth_trigger
-- Description: Auto-create a property_managers row when a property-manager
--              account is created via the admin portal signup flow.
--
--              Fixes the signup 401: with "Confirm email" enabled, auth.signUp
--              returns a user object but NO session, so the previous
--              client-side `.from("property_managers").insert(...)` ran with
--              the anon key and failed RLS policy pm_insert_own
--              (user_id = auth.uid()).
--
--              Running the insert from an AFTER INSERT trigger (SECURITY
--              DEFINER) sidesteps the session/RLS problem entirely — the row
--              is created atomically with the auth user, server-side.
--
-- IMPORTANT — shared auth.users table:
--   The mobile app (Neighborlyy) shares this Supabase project and inserts into
--   auth.users on every RESIDENT signup. To avoid creating bogus
--   property_managers rows for residents (and breaking their signup on the
--   email UNIQUE constraint), the trigger is gated on:
--       raw_user_meta_data->>'account_type' = 'property_manager'
--   Only the admin portal sets that marker (see app/(auth)/signup/page.tsx).
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_property_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only act on admin-portal PM signups; ignore mobile resident signups.
  IF NEW.raw_user_meta_data->>'account_type' = 'property_manager' THEN
    INSERT INTO public.property_managers (user_id, full_name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_pm ON auth.users;
CREATE TRIGGER on_auth_user_created_create_pm
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_property_manager();
