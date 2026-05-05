#!/usr/bin/env bash
set -euo pipefail
source scripts/secrets.local.env
URL="$NEON_DATABASE_URL_DIRECT"

echo "=== Resetting public schema ==="
psql -d "$URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO neondb_owner;
GRANT ALL ON SCHEMA public TO public;
SQL

restore() {
  local file="$1"
  echo "=== Restoring $file ==="
  # 1) tr -d '\r' to fix CRLF
  # 2) strip ALTER OWNER and GRANT/REVOKE TO postgres
  tr -d '\r' < "$file" \
    | sed -E '/^(ALTER (TABLE|SEQUENCE|TYPE|FUNCTION|VIEW|INDEX) .* OWNER TO postgres;|GRANT [A-Z, ]+ ON .* TO postgres;|REVOKE [A-Z, ]+ ON .* FROM postgres;)/d' \
    | psql -d "$URL" --quiet -v ON_ERROR_STOP=0 -X 2>&1 \
    | grep -E '(ERROR|invalid command)' | head -20 || true
  echo "  done."
}

restore 01_base_tables.sql
restore 02_arts.sql
restore 03_art_related.sql
restore 04_other_tables.sql

echo ""
echo "=== Final row counts ==="
psql -d "$URL" -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
echo ""
echo "=== arts row count (live query) ==="
psql -d "$URL" -c "SELECT COUNT(*) AS arts_count FROM public.arts;"
