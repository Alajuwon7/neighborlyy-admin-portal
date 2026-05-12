-- =============================================================================
-- Migration: 027_offboarding_helper_views
-- Description: Phase 3 foundation — Stripe webhook idempotency table,
--              per-community subscription state mirror, per-community audit
--              summary view for Screen 4.
-- =============================================================================

-- 1. Webhook idempotency. Stripe retries on non-2xx; INSERT-on-conflict gives
--    us first-writer-wins dedup keyed by Stripe's event id.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id           text        PRIMARY KEY,
  type         text        NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb       NOT NULL
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service-role only. No policies = no anon/authenticated access.

-- 2. Per-community Stripe state mirror. Lets the billing UI render without
--    hitting Stripe on every load and gives the webhook a clear write target.
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_cancel_at           timestamptz;

-- 3. Per-community audit summary for Screen 4 cards.
--    "Active resident" = approved profile (per design).
--    security_invoker=true => RLS on underlying tables runs as the querying
--    role (not the view owner), avoiding the 0010_security_definer_view lint.
DROP VIEW IF EXISTS community_audit_summary;
CREATE VIEW community_audit_summary
  WITH (security_invoker = true) AS
SELECT
  c.id              AS community_id,
  c.community_code,
  c.name,
  c.organization_id,
  COUNT(DISTINCT p.id)  FILTER (WHERE p.status IS DISTINCT FROM 'pending'
                                  AND p.status IS DISTINCT FROM 'rejected') AS active_residents,
  COUNT(DISTINCT pu.id)                                                     AS pending_residents,
  COUNT(DISTINCT e.id)  FILTER (WHERE e.event_date >= now())                AS upcoming_events,
  COUNT(DISTINCT hr.id) FILTER (WHERE hr.status = 'open')                   AS open_help_requests
FROM communities c
LEFT JOIN profiles       p  ON p.community_code = c.community_code
LEFT JOIN pending_users  pu ON pu.community_code = c.community_code
LEFT JOIN events         e  ON e.community_code = c.community_code
LEFT JOIN help_requests  hr ON hr.community_code = c.community_code
GROUP BY c.id, c.community_code, c.name, c.organization_id;

-- 4. Realtime: BillingClient needs to react to community status changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='communities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE communities';
  END IF;
END $$;
