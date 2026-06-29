#!/bin/sh
set -e

# Ensure database directory exists
mkdir -p /app/database

# Verify and rebuild better-sqlite3 if there is an architecture mismatch
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  echo "Native better-sqlite3 addon is missing or incompatible. Rebuilding natively..."
  apk add --no-cache python3 make g++ gcc
  npm rebuild better-sqlite3
  apk del python3 make g++ gcc
fi

# Run Prisma schema push to ensure database structure is initialized/updated
echo "Running Prisma db push..."
npx prisma db push --accept-data-loss || echo "Prisma push warning (continuing...)"

# Start the standalone Next.js application
echo "Starting Next.js..."
exec node server.js
