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

- `src/app/` — App Router pages + `src/app/api/*` route handlers (REST-style, one folder per resource: activities, auth, checklist, grocery, health, logistics, meals). Route files are thin: `export const POST = route(handler)` via `src/lib/api/next-route.js`
- `src/lib/api/` — framework-free API handlers (`({ db, isAdmin, body }) => { status, body }`) holding the validation and auth checks; `run.js` has the result helpers and maps Prisma not-found errors to 404
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
npm test              # unit + API handler + script tests (node --test "tests/**/*.test.mjs")
npm run test:e2e      # next build, then browser/HTTP tests against next start (tests/e2e/*.e2e.mjs)
npm run test:all      # both
npm run lint           # eslint
npx prisma db push     # sync schema.prisma to dev.db (no migrations dir — push-based workflow)
npm run seed:meals -- --force  # re-seed meal/grocery data (seed scripts wipe data; they refuse to run without --force)
```

### Conventions

- API routes return plain JSON, no shared response wrapper; follow the existing pattern in `src/app/api/*/route.js` for a new endpoint rather than introducing one.
- Mutating endpoints check `isAdmin` at the top of the handler function in `src/lib/api/*` — mirror that rather than adding middleware. New endpoints: write the handler in `src/lib/api/`, wire it with `route()`, and test it in `tests/api/`.
- Client mutations go through `apiFetch` (`src/lib/api-client.js`) and report failures with `useToast()`; confirmations use `useConfirm()`, never `alert`/`confirm`.
- Pure logic goes in `src/lib/*.js` with relative imports (no `@/`, no `next/*`) so `node --test` can load it; add a test in `tests/`.
- Never enable SQLite WAL mode — production SQLite is on NFS.
- `Trip.id` is a human-readable slug, not a generated ID — keep using slugs if adding trip-scoped code.

### Testing (test-first)

Work TDD: write or extend a failing test, run it and watch it fail for the right reason, then implement until it passes. Every change ships with tests at the lowest layer that can catch the bug:

| Layer | Where | What it covers |
|---|---|---|
| Unit | `tests/*.test.mjs` | Pure modules in `src/lib` (markdown, reducer, meals, timeline, categories, apiFetch) |
| API handler | `tests/api/*.test.mjs` | `src/lib/api/*` against a real throwaway SQLite DB (`tests/support/test-db.mjs`, fixtures in `tests/support/fixtures.mjs`) |
| Scripts/config | `tests/scripts/*.test.mjs` | `docker-entrypoint.sh` (stubbed npx/node), seed `--force` guards, k8s/Dockerfile invariants |
| End-to-end | `tests/e2e/*.e2e.mjs` | Playwright (driven from `node --test`) against `next start` on a throwaway DB: HTTP auth wiring and real browser flows |

- Test files import source with relative paths; `src/lib` modules used by tests must not import `@/` or `next/*`.
- Never point tests at `dev.db`; always use `createTestDb()` / `createDbFile()`.
- e2e tests need a production build (`npm run test:e2e` builds first) and Chromium (`npx playwright install chromium`).
- CI (`.github/workflows/test.yml`) runs lint, `npm test` and `npm run test:e2e` on every PR, and the deploy workflow only runs after it passes.
- Keep `loading.js` out of routes that call `notFound()`: streaming locks the status at 200 (see the e2e 404 tests).
