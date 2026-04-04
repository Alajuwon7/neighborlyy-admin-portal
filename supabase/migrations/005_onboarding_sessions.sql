-- =============================================================================
-- Migration: 005_onboarding_sessions
-- Description: Temporary storage for onboarding data during Stripe checkout.
--              Sessions expire after 1 hour and are deleted after use.
-- =============================================================================

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  data        jsonb NOT NULL,
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz DEFAULT (now() + interval '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user
  ON onboarding_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_expires
  ON onboarding_sessions(expires_at);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_session_own" ON onboarding_sessions FOR ALL
  USING (user_id = auth.uid());
