#!/usr/bin/env bash
# Runs supabase/tests/renewal/check.sql against a THROWAWAY local Postgres
# (needs initdb/pg_ctl/psql on PATH). Never touches a real database.
#   scripts/test-renewal-sql.sh            # Miyora repo at ../Miyora
#   MIYORA_DIR=/path/to/Miyora scripts/test-renewal-sql.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIYORA_DIR="${MIYORA_DIR:-$ROOT/../Miyora}"
# Applied in order: v1, then v2 (took part + prorated) replaces its body.
SUMMARY_FILES=(
  "$MIYORA_DIR/supabase/migrations/20261109120000_lease_renewal_summary.sql"
  "$MIYORA_DIR/supabase/migrations/20261110120000_lease_renewal_took_part_prorated.sql"
)
for f in "${SUMMARY_FILES[@]}"; do [ -f "$f" ] || { echo "Can't find $f (set MIYORA_DIR)"; exit 1; }; done

WORK="$(mktemp -d /tmp/renewal-sql.XXXX)"   # short path: unix socket limit
PORT="${PGPORT_TEST:-54391}"
cleanup() { pg_ctl -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres -A trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)

# CTE MATERIALIZED is PG12+; older servers always materialise, so strip it there.
OLD_PG=0; [ "$("${PSQL[@]}" -tAc 'show server_version_num')" -lt 120000 ] && OLD_PG=1
SUMMARY_RUNS=()
for i in "${!SUMMARY_FILES[@]}"; do
  out="$WORK/summary$i.sql"
  if [ "$OLD_PG" = 1 ]; then sed 's/ AS MATERIALIZED (/ AS (/' "${SUMMARY_FILES[$i]}" > "$out"; else cp "${SUMMARY_FILES[$i]}" "$out"; fi
  SUMMARY_RUNS+=("$out")
done

"${PSQL[@]}" -f "$ROOT/supabase/tests/renewal/stub.sql"
for pass in 1 2; do   # twice: both migrations must be idempotent
  "${PSQL[@]}" -f "$ROOT/supabase/migrations/036_lease_records.sql" 2>/dev/null
  for f in "${SUMMARY_RUNS[@]}"; do "${PSQL[@]}" -f "$f" 2>/dev/null; done
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/renewal/check.sql" 2>&1 | sed 's/^psql:.*NOTICE:  //'
