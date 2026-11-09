#!/bin/sh
set -e

DATABASE_URL="${DATABASE_URL:-file:/app/database/travel.db}"
DB_FILE="${DATABASE_URL#file:}"
DB_DIR="$(dirname "$DB_FILE")"
BACKUP_DIR="$DB_DIR/backups"

# Ensure database directory exists
mkdir -p "$DB_DIR"

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

# Photos (scrapbook): the site works without them, so warn loudly instead of
# failing when the uploads volume can't be written (usually the NFS export
# isn't owned by the container's nextjs user, uid 1001).
if [ -n "$UPLOADS_DIR" ]; then
  if ! { mkdir -p "$UPLOADS_DIR/photos" 2>/dev/null && [ -w "$UPLOADS_DIR/photos" ]; }; then
    echo "WARNING: $UPLOADS_DIR is not writable, so photo uploads will fail. On the NAS: chown -R 1001:1001 <the travel-uploads export>" >&2
  fi
fi

# Start the standalone Next.js application
echo "Starting Next.js..."
exec node server.js
