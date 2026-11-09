FROM node:22-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++ gcc
WORKDIR /app

COPY package*.json ./
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install Prisma CLI to run migrations on startup
# We do this early so it caches effectively
RUN npm install prisma@7.8.0

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/database/travel.db"

# Create a system user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
# Lockout recovery: kubectl exec deploy/travel-site-deployment -- node scripts/admin-reset.mjs <username>
COPY --from=builder --chown=nextjs:nodejs /app/scripts/admin-reset.mjs ./scripts/admin-reset.mjs



RUN chmod +x docker-entrypoint.sh

# SQLite database and photo upload folders (both NFS mounts in production)
RUN mkdir -p /app/database /app/uploads && chown -R nextjs:nodejs /app/database /app/uploads

# Photos are resized with sharp: fail the build, not the first upload, if its
# native binary didn't make it into the standalone output.
RUN node -e "require('sharp'); console.log('sharp OK')"

# Ensure everything inside /app is owned by nextjs
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
