-- =============================================================================
-- Migration: 003_admin_portal_alter_and_create
-- Description: Create admin portal tables and extend existing communities table.
--              The communities table already exists from the mobile app with
--              columns: id, building_name, community_code, admin_code, active,
--              created_at, updated_at
-- =============================================================================

-- 1. Create property_managers table
CREATE TABLE IF NOT EXISTS property_managers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL UNIQUE,
  full_name     text NOT NULL,
  email         text NOT NULL UNIQUE,
  phone         text,
  company_name  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. Extend communities table with admin portal columns
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS property_manager_id uuid REFERENCES property_managers,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS unit_count integer,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#E65C4F',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#78A6C8',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_tier text;

-- Backfill name from building_name for existing rows
UPDATE communities SET name = building_name WHERE name IS NULL AND building_name IS NOT NULL;

-- 3. Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id        uuid REFERENCES communities NOT NULL,
  property_manager_id uuid REFERENCES property_managers,
  email               text NOT NULL,
  full_name           text NOT NULL,
  role                text NOT NULL CHECK (role IN ('owner','manager','assistant_manager','leasing_agent')),
  status              text NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited','active','deactivated')),
  invited_at          timestamptz DEFAULT now(),
  joined_at           timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(community_id, email)
);

-- 4. Create subscription_history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    uuid REFERENCES communities NOT NULL,
  event_type      text NOT NULL CHECK (event_type IN ('created','upgraded','downgraded','cancelled','reactivated')),
  from_tier       text,
  to_tier         text,
  amount          decimal(10,2),
  stripe_event_id text,
  metadata        jsonb,
  created_at      timestamptz DEFAULT now()
);

-- 5. Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities NOT NULL,
  event_type   text NOT NULL,
  user_id      uuid REFERENCES auth.users,
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_communities_pm     ON communities(property_manager_id);
CREATE INDEX IF NOT EXISTS idx_communities_code   ON communities(community_code);
CREATE INDEX IF NOT EXISTS idx_communities_stripe ON communities(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_team_community     ON team_members(community_id);
CREATE INDEX IF NOT EXISTS idx_analytics_comm_dt  ON analytics_events(community_id, created_at DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE property_managers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events      ENABLE ROW LEVEL SECURITY;

-- property_managers
CREATE POLICY "pm_select_own" ON property_managers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pm_update_own" ON property_managers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pm_insert_own" ON property_managers FOR INSERT WITH CHECK (user_id = auth.uid());

-- communities (add admin portal policies — existing RLS may already be enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'communities' AND policyname = 'comm_all_own'
  ) THEN
    EXECUTE 'CREATE POLICY comm_all_own ON communities FOR ALL USING (
      property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )';
  END IF;
END
$$;

-- team_members
CREATE POLICY "team_select_own" ON team_members FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "team_all_own" ON team_members FOR ALL
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );

-- subscription_history (read-only for property managers)
CREATE POLICY "subhist_select_own" ON subscription_history FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );

-- analytics_events
CREATE POLICY "analytics_select_own" ON analytics_events FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================================================
-- Updated_at triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pm_updated_at') THEN
    CREATE TRIGGER trg_pm_updated_at
      BEFORE UPDATE ON property_managers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_team_updated_at') THEN
    CREATE TRIGGER trg_team_updated_at
      BEFORE UPDATE ON team_members
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;
