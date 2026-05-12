-- 030_offboarding_audit_summary_null_status_fix.sql
--
-- Fix active_residents count in community_audit_summary view.
--
-- The previous definition (migration 027) used `IS DISTINCT FROM 'pending'`
-- and `IS DISTINCT FROM 'rejected'` to filter active profiles. IS DISTINCT
-- FROM treats NULL as a non-match -> NULL-status profiles were counted as
-- active. That would block the "Close" disposition forever for any community
-- with NULL-status profile rows (the gate requires active_residents = 0).
--
-- Fix: require status IS NOT NULL AND NOT IN ('pending','rejected').
--
-- Applied to live DB via mcp__supabase__apply_migration on 2026-05-11; this
-- file mirrors that change so the migration history on disk stays in sync.

DROP VIEW IF EXISTS community_audit_summary;

CREATE VIEW community_audit_summary
  WITH (security_invoker = true) AS
SELECT
  c.id              AS community_id,
  c.community_code,
  c.name,
  c.organization_id,
  COUNT(DISTINCT p.id) FILTER (
    WHERE p.status IS NOT NULL
      AND p.status NOT IN ('pending','rejected')
  ) AS active_residents,
  COUNT(DISTINCT pu.id)                                          AS pending_residents,
  COUNT(DISTINCT e.id)  FILTER (WHERE e.event_date >= now())     AS upcoming_events,
  COUNT(DISTINCT hr.id) FILTER (WHERE hr.status = 'open')        AS open_help_requests
FROM communities c
LEFT JOIN profiles       p  ON p.community_code = c.community_code
LEFT JOIN pending_users  pu ON pu.community_code = c.community_code
LEFT JOIN events         e  ON e.community_code = c.community_code
LEFT JOIN help_requests  hr ON hr.community_code = c.community_code
GROUP BY c.id, c.community_code, c.name, c.organization_id;
