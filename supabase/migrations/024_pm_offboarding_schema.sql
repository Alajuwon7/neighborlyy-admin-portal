-- =============================================================================
-- Migration: 024_pm_offboarding_schema
-- Description: Schema foundation for PM Account Offboarding (deletion + transfer).
--              Per spec at neighborlyyV2.1/docs/PM Account Offboarding —
--              Overview & Decision Framework/. Adds two request tables, audit
--              columns on organizations/communities, avatar_url on PM. RLS,
--              triggers, and realtime are configured in 025.
-- =============================================================================

-- 1. Extend organizations with offboarding-related columns
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS corporation_contact_email text,
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'active'
    CHECK (status IN ('active','deleted')),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Extend communities for suspension/closure metadata
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz;

-- 3. Add avatar_url to property_managers (referenced by the PII wipe)
ALTER TABLE property_managers
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 4. Deletion requests
CREATE TABLE IF NOT EXISTS deletion_requests (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pm_id                       uuid REFERENCES property_managers(id) ON DELETE SET NULL,
  org_id                      uuid REFERENCES organizations(id)     ON DELETE SET NULL,
  reason                      text,
  requested_at                timestamptz NOT NULL DEFAULT now(),
  corporation_approval_at     timestamptz,
  corporation_approver_name   text,
  corporation_approver_email  text,
  community_disposition       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  stripe_resolved_at          timestamptz,
  pii_wiped_at                timestamptz,
  soft_deleted_at             timestamptz,
  hard_deleted_at             timestamptz,
  status                      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'awaiting_corp_approval',
      'in_review',
      'billing_blocked',
      'approved',
      'completed',
      'blocked',
      'cancelled'
    )),
  audit_log                   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deletion_requests_pm_status_idx
  ON deletion_requests(pm_id, status);

-- One open deletion request per PM (idempotency at the DB level)
CREATE UNIQUE INDEX IF NOT EXISTS deletion_requests_one_open_per_pm_idx
  ON deletion_requests(pm_id)
  WHERE status NOT IN ('completed', 'blocked', 'cancelled');

CREATE OR REPLACE TRIGGER set_deletion_requests_updated_at
  BEFORE UPDATE ON deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. Transfer requests
CREATE TABLE IF NOT EXISTS transfer_requests (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outgoing_pm_id              uuid REFERENCES property_managers(id) ON DELETE SET NULL,
  incoming_pm_email           text NOT NULL,
  incoming_pm_id              uuid REFERENCES property_managers(id) ON DELETE SET NULL,
  org_id                      uuid REFERENCES organizations(id)     ON DELETE SET NULL,
  reason                      text,
  effective_date              date,
  notes                       text,
  community_ids               uuid[]      NOT NULL DEFAULT '{}',
  requested_at                timestamptz NOT NULL DEFAULT now(),
  corporation_approval_at     timestamptz,
  corporation_approver_name   text,
  corporation_approver_email  text,
  stripe_reassigned_at        timestamptz,
  completed_at                timestamptz,
  status                      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'awaiting_corp_approval',
      'incoming_pm_invited',
      'incoming_pm_accepted',
      'stripe_pending',
      'completed',
      'blocked',
      'cancelled'
    )),
  audit_log                   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transfer_requests_outgoing_pm_status_idx
  ON transfer_requests(outgoing_pm_id, status);

CREATE INDEX IF NOT EXISTS transfer_requests_incoming_email_idx
  ON transfer_requests(incoming_pm_email);

-- One open transfer request per outgoing PM
CREATE UNIQUE INDEX IF NOT EXISTS transfer_requests_one_open_per_outgoing_idx
  ON transfer_requests(outgoing_pm_id)
  WHERE status NOT IN ('completed', 'blocked', 'cancelled');

CREATE OR REPLACE TRIGGER set_transfer_requests_updated_at
  BEFORE UPDATE ON transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
