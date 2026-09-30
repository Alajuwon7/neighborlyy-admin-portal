-- 035_audit_summary_resident_definition.sql
--
-- Align community_audit_summary.active_residents with the canonical resident
-- definition (lib/residents.ts filterResidents): any non-admin profiles row.
--
-- Migration 030 counted only profiles with status NOT NULL and NOT IN
-- ('pending','rejected'). But the mobile app's approval (UserService.approveUser)
-- inserts profiles without status, so app-approved residents keep the default
-- 'pending' — TREND1 counted 13 of its 38 residents on 2026-09-30. A community
-- whose residents were all app-approved counted 0 and passed the offboarding
-- "Close" gate (canCloseCommunity requires active_residents = 0) while live.
-- It also counted a PM's own role='admin' profile once that was 'approved'.
--
-- Applicants live in pending_users until decided and denied users never get a
-- profiles row (deny_pending_user / mobile reject_user), so no status filter is
-- needed. pending_residents now counts only undecided rows.
--
-- Shared DB with the mobile repo: apply via the Supabase SQL editor, not
-- `db push`. Column names/types are unchanged, so CREATE OR REPLACE is safe.

CREATE OR REPLACE VIEW community_audit_summary
  WITH (security_invoker = true) AS
SELECT
  c.id              AS community_id,
  c.community_code,
  c.name,
  c.organization_id,
  COUNT(DISTINCT p.id)  FILTER (WHERE p.role IS DISTINCT FROM 'admin') AS active_residents,
  COUNT(DISTINCT pu.id) FILTER (WHERE pu.status = 'pending')          AS pending_residents,
  COUNT(DISTINCT e.id)  FILTER (WHERE e.event_date >= now())          AS upcoming_events,
  COUNT(DISTINCT hr.id) FILTER (WHERE hr.status = 'open')             AS open_help_requests
FROM communities c
LEFT JOIN profiles       p  ON p.community_code = c.community_code
LEFT JOIN pending_users  pu ON pu.community_code = c.community_code
LEFT JOIN events         e  ON e.community_code = c.community_code
LEFT JOIN help_requests  hr ON hr.community_code = c.community_code
GROUP BY c.id, c.community_code, c.name, c.organization_id;
