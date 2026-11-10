#!/usr/bin/env bash
# Runs supabase/tests/renewal/check.sql against a THROWAWAY local Postgres
# (needs initdb/pg_ctl/psql on PATH). Never touches a real database.
#   scripts/test-renewal-sql.sh            # Miyora repo at ../Miyora
#   MIYORA_DIR=/path/to/Miyora scripts/test-renewal-sql.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIYORA_DIR="${MIYORA_DIR:-$ROOT/../Miyora}"
SUMMARY_SQL="$MIYORA_DIR/supabase/migrations/20261109120000_lease_renewal_summary.sql"
[ -f "$SUMMARY_SQL" ] || { echo "Can't find $SUMMARY_SQL (set MIYORA_DIR)"; exit 1; }

WORK="$(mktemp -d /tmp/renewal-sql.XXXX)"   # short path: unix socket limit
PORT="${PGPORT_TEST:-54391}"
cleanup() { pg_ctl -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres -A trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)

# CTE MATERIALIZED is PG12+; older servers always materialise, so strip it there.
SUMMARY_RUN="$WORK/summary.sql"
if [ "$("${PSQL[@]}" -tAc 'show server_version_num')" -lt 120000 ]; then
  sed 's/ AS MATERIALIZED (/ AS (/' "$SUMMARY_SQL" > "$SUMMARY_RUN"
else
  cp "$SUMMARY_SQL" "$SUMMARY_RUN"
fi

"${PSQL[@]}" -f "$ROOT/supabase/tests/renewal/stub.sql"
for pass in 1 2; do   # twice: both migrations must be idempotent
  "${PSQL[@]}" -f "$ROOT/supabase/migrations/036_lease_records.sql" 2>/dev/null
  "${PSQL[@]}" -f "$SUMMARY_RUN" 2>/dev/null
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/renewal/check.sql" 2>&1 | sed 's/^psql:.*NOTICE:  //'
