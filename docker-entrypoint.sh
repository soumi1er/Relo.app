#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL est obligatoire}"
: "${POSTGRES_USER:?POSTGRES_USER est obligatoire}"
: "${POSTGRES_DB:?POSTGRES_DB est obligatoire}"

until pg_isready -h postgres -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  echo "PostgreSQL n’est pas encore prêt…"
  sleep 2
done

npx prisma db push --skip-generate
exec node dist/server.js
