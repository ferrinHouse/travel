#!/bin/sh
set -e

# Ensure database directory exists
mkdir -p /app/database

# Run Prisma schema push to ensure database structure is initialized/updated
echo "Running Prisma db push..."
npx prisma db push --accept-data-loss || echo "Prisma push warning (continuing...)"

# Start the standalone Next.js application
echo "Starting Next.js..."
exec node server.js
