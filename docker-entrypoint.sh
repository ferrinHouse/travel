#!/bin/sh
set -e

# Ensure database directory exists
mkdir -p /app/database

DB_FILE="${DATABASE_URL#file:}"
BACKUP_DIR="$(dirname "$DB_FILE")/backups"

# Back up the database before touching the schema; keep the 5 newest copies.
if [ -f "$DB_FILE" ]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP="$BACKUP_DIR/$(basename "$DB_FILE").bak-$(date +%Y%m%d%H%M%S)"
  cp "$DB_FILE" "$BACKUP"
  echo "Backed up database to $BACKUP"
  ls -1t "$BACKUP_DIR"/*.bak-* 2>/dev/null | tail -n +6 | xargs -r rm -f --
fi

# Sync the schema. No --accept-data-loss: a change that would drop data must
# fail the rollout (and keep the old pod's data intact) instead of silently
# deleting columns. set -e stops startup if the push fails.
echo "Running Prisma db push..."
npx prisma db push

# Start the standalone Next.js application
echo "Starting Next.js..."
exec node server.js
