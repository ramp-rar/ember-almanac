#!/bin/sh
# Apply database migrations to the production database (Neon) configured in Vercel.
# Reads .env.vercel.production (from `vercel env pull`, never committed) and uses the direct
# (non-pooled) connection that migrations require. Migrations only ever add; see db/migrations.
# Run from PowerShell:  & "C:\Program Files\Git\bin\bash.exe" scripts/migrate-prod.sh
set -u
cd "$(dirname "$0")/.."
# Git Bash started directly from PowerShell lacks /usr/bin; add it and Node explicitly.
export PATH="/usr/bin:/bin:/c/Users/Abubakr Damonov/AppData/Roaming/fnm/node-versions/v24.21.0/installation:$PATH"

if [ ! -f .env.vercel.production ]; then
  echo "Missing .env.vercel.production: pnpm dlx vercel env pull .env.vercel.production --environment=production" >&2
  exit 1
fi
set -a
. ./.env.vercel.production
set +a
export DATABASE_URL_UNPOOLED="${POSTGRES_URL_NON_POOLING:-${DATABASE_URL_UNPOOLED:-}}"
if [ -z "$DATABASE_URL_UNPOOLED" ]; then
  echo "No direct database URL in .env.vercel.production" >&2
  exit 1
fi
# Neon accepts only TLS connections; postgres.js needs sslmode in the URL to use TLS.
case "$DATABASE_URL_UNPOOLED" in
  *sslmode=*) ;;
  *\?*) DATABASE_URL_UNPOOLED="$DATABASE_URL_UNPOOLED&sslmode=require" ;;
  *) DATABASE_URL_UNPOOLED="$DATABASE_URL_UNPOOLED?sslmode=require" ;;
esac
export DATABASE_URL_UNPOOLED
echo "Target host: $(printf '%s' "$DATABASE_URL_UNPOOLED" | sed -E 's|^[a-z]+://[^@]*@([^/:?]+).*|\1|')"

node node_modules/drizzle-kit/bin.cjs migrate > .migrate.log 2>&1
status=$?
# The spinner rewrites one line with carriage returns; show the readable lines.
tr '\r' '\n' < .migrate.log | grep -v 'applying migrations' | grep -v '^[[:space:]]*$' | tail -n 25
if [ "$status" -eq 0 ]; then
  echo "RESULT: OK, migrations applied."
else
  echo "RESULT: FAILED (exit $status). Copy the lines above."
fi
exit "$status"
