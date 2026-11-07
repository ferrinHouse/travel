<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project: Family Travel Adventures

A trip itinerary/logistics/packing/meal-planning app for the Ferrin household. Full feature and deployment docs live in [README.md](README.md) — read that for the product picture. This section covers what an agent needs to work in the code.

### Stack

- Next.js 16 (App Router), React 19, plain CSS (no Tailwind/CSS-in-JS)
- Prisma 7 + `better-sqlite3` via `@prisma/adapter-better-sqlite3`, SQLite storage (`dev.db` locally)
- Node's built-in test runner (`node --test`), not Jest/Vitest
- Deployed as a standalone Next.js build to a self-hosted k8s cluster via GitHub Actions (ARM64)

### Layout

- `src/app/` — App Router pages + `src/app/api/*` route handlers (REST-style, one folder per resource: activities, auth, checklist, grocery, logistics, meals)
- `src/components/trip/` — trip detail page: `TripDetailsClient` (tab shell + `useReducer` from `src/lib/trip-reducer.js`) with one folder per tab (`itinerary/`, `logistics/`, `checklist/`, `meals/`)
- `src/components/ui/` — shared UI kit: `Modal` (native `<dialog>`), `Toast`, `ConfirmDialog`, `Markdown` (the only `dangerouslySetInnerHTML`), `Skeleton`, `EmptyState`
- `src/lib/db.js` — Prisma client singleton (cached on `global.prisma` outside production to survive dev hot-reload)
- `src/lib/helpers.js` — time parsing, meal icons, date logic shared across pages; `src/lib/markdown.js` — safe markdown (http/https/mailto/tel links only)
- `prisma/schema.prisma` — models: Trip, ItineraryDay, ItineraryActivity, MealPlan, ChecklistItem, LogisticsCard, GroceryItem, all keyed off `Trip.id` (a slug like `"chicago"`)
- `prisma/seed.js` / `seed-meals.js` — the only way trips currently get created (no in-app trip creation UI yet)

### Auth model

Single shared admin passcode (`ADMIN_PASSCODE` env var) gates mutations via an HTTP-only `admin_authenticated` cookie set by `POST /api/auth`. Public/unauthenticated users can always view itineraries and toggle checklist/grocery checkboxes. Don't add per-user auth without checking with the user first — a rewrite to Auth.js/OAuth is on the roadmap in README.md but not started.

### Commands

```bash
npm run dev          # dev server
npm run build         # production build
npm test              # node --test over tests/**/*.test.mjs
npm run lint           # eslint
npx prisma db push     # sync schema.prisma to dev.db (no migrations dir — push-based workflow)
npm run seed:meals -- --force  # re-seed meal/grocery data (seed scripts wipe data; they refuse to run without --force)
```

### Conventions

- API routes return plain JSON, no shared response wrapper; follow the existing pattern in `src/app/api/*/route.js` for a new endpoint rather than introducing one.
- Mutating endpoints check the admin cookie inline at the top of the handler — mirror that rather than adding middleware.
- Client mutations go through `apiFetch` (`src/lib/api-client.js`) and report failures with `useToast()`; confirmations use `useConfirm()`, never `alert`/`confirm`.
- Pure logic goes in `src/lib/*.js` with relative imports (no `@/`, no `next/*`) so `node --test` can load it; add a test in `tests/`.
- Never enable SQLite WAL mode — production SQLite is on NFS.
- `Trip.id` is a human-readable slug, not a generated ID — keep using slugs if adding trip-scoped code.
