# Database Migrations

## Migration History

| Migration | Description | Status |
|-----------|-------------|--------|
| 001 | Original mobile app schema (communities, profiles, events, alerts, facilities, reservations) | APPLIED |
| 002 | _(Abandoned)_ Initial attempt at admin portal tables. Failed due to incorrect assumptions about the existing schema. Replaced by migration 003. | REMOVED |
| 003 | Admin portal tables and communities extension. Creates `property_managers`, `team_members`, `subscription_history`, and `analytics_events` tables. Extends the existing `communities` table with admin-specific columns (`property_manager_id`, `street_address`, `city`, `unit_count`, etc.). | APPLIED |
| 004 | Admin RLS policies. Adds SELECT policies on mobile app tables (`profiles`, `events`, `alerts`, `facilities`, `reservations`) so property managers can read data scoped to their managed communities. | APPLIED |

## Notes

- Migration 001 was applied as part of the original mobile app deployment and is managed outside this repository.
- Migration 002 was abandoned because it attempted to `CREATE TABLE communities` instead of altering the existing table. It was replaced by 003 which uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Migrations 003+ are managed from this admin portal repository.
