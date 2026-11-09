<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project: Family Travel Adventures

A trip itinerary/logistics/packing/meal-planning app for the Ferrin household. Full feature and deployment docs live in [README.md](README.md) — read that for the product picture. This section covers what an agent needs to work in the code.

### Stack

- Next.js 16 (App Router), React 19, plain CSS with design tokens (no Tailwind/CSS-in-JS); Fraunces + Inter via `next/font/google`
- Prisma 7 + `better-sqlite3` via `@prisma/adapter-better-sqlite3`, SQLite storage (`dev.db` locally)
- Node's built-in test runner (`node --test`), not Jest/Vitest
- Deployed as a standalone Next.js build to a self-hosted k8s cluster via GitHub Actions (ARM64)

### Layout

- `src/app/` — App Router pages + `src/app/api/*` route handlers (REST-style, one folder per resource: account, activities, auth, checklist, grocery, health, logistics, meals, users). Route files are thin: `export const POST = route(handler)` via `src/lib/api/next-route.js`, which resolves the session cookie to `ctx.user`, blocks cross-site writes, parses the body (query string for GET) and applies `result.cookies`
- `src/lib/api/` — framework-free API handlers (`(ctx) => { status, body, cookies? }`, ctx = `{ db, user, body, sessionToken, request, config, limiter?, webauthn?, now? }`) holding the validation and permission checks; `run.js` has the result helpers and maps Prisma not-found errors to 404; `guard.js` has `deny(ctx, action)`; `request-context.js` turns env + headers into `config`/`request`
- `src/lib/auth/` — pure auth pieces (password hashing, tokens, roles/`can()`, session policy, rate limiter, origin check, safe redirects, proxy rules) plus `current-user.js` (server-only: `getCurrentUser()`, `requirePageUser(path, action)` for pages)
- `src/proxy.js` — optimistic redirect to `/login` when there is no session cookie (API routes are excluded and return 401 themselves)
- `src/components/trip/` — trip detail page: `TripDetailsClient` (tab shell + `useReducer` from `src/lib/trip-reducer.js`) with one folder per tab (`itinerary/`, `logistics/`, `checklist/`, `meals/`)
- `src/components/ui/` — shared UI kit: `Modal` (native `<dialog>`), `Toast`, `ConfirmDialog`, `Markdown`, `Skeleton`, `EmptyState`. `Markdown` and the theme script in `layout.js` are the only `dangerouslySetInnerHTML` uses
- `src/components/site/` — `SiteHeader` (sticky bar on every page), `ThemeToggle` (System/Light/Dark) and `UserMenu`; `src/components/trips/` — server-rendered `TripHero`, `TripCard`, `FeaturedTrip`; `src/components/auth/`, `account/`, `admin/` — sign-in, setup, invite, account and People pages
- `src/styles/` — `tokens.css` (semantic colour roles for light and `[data-theme='dark']`, type/spacing/radius/shadow/motion scales, legacy aliases), `base.css`, `components.css`, `utilities.css`, imported once in `layout.js`
- `src/lib/db.js` — Prisma client singleton (cached on `global.prisma` outside production to survive dev hot-reload)
- `src/lib/helpers.js` — time parsing, meal icons, date logic shared across pages; `src/lib/markdown.js` — safe markdown (http/https/mailto/tel links only)
- `src/lib/color.js` — `tripTheme(trip)` turns a trip's colours into AA-checked `--trip-*` CSS variables; `src/lib/theme.js` — theme preference + the inline no-flash `<head>` script; `src/lib/trip-status.js` — `tripPhase` (upcoming / Day N of M / past) and labels
- `prisma/schema.prisma` — trip models: Trip, ItineraryDay, ItineraryActivity, MealPlan, ChecklistItem, LogisticsCard, GroceryItem, all keyed off `Trip.id` (a slug like `"chicago"`); auth models: User, Session, Passkey, Invite, AuthChallenge
- `scripts/admin-reset.mjs` — lockout recovery (prints a one-time reset link); self-contained better-sqlite3, copied into the image
- `prisma/seed.js` / `seed-meals.js` — the only way trips currently get created (no in-app trip creation UI yet)

### Auth model

Per-person accounts; **everything requires sign-in** (the proxy redirects pages to `/login`, API handlers return 401). Sign-in is username + password (scrypt) or a passkey (`@simplewebauthn/server`, injected as `ctx.webauthn` so tests use a fake). Sessions are a random token in the HTTP-only `travel_session` cookie (SameSite=Lax, 90-day max, 30 days idle); the DB stores only its SHA-256. Invite/reset links work the same way (single use, hashed).

Roles in `src/lib/auth/roles.js` via `can(user, action)`: `viewer` → view; `member` → also `toggle` and `add-item` (checklist/grocery); `admin` → also `edit` and `manage-users`. On the trip page admins edit only with "Edit mode" on (`src/lib/trip-permissions.js`).

First admin: set `SETUP_TOKEN` and use `/setup` (404 once any user exists). Production needs `APP_ORIGIN` (k8s `travel-config`); passkeys are bound to its hostname. Don't add OAuth/third-party identity without checking with the user first.

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
- Every handler starts with `const denied = deny(ctx, '<action>'); if (denied) return denied;` (401 signed out, 403 wrong role) — mirror that rather than adding middleware, and add the endpoint to `tests/api/permissions.test.mjs` if it touches trip data. New endpoints: write the handler in `src/lib/api/`, wire it with `route()`, and test it in `tests/api/` (use `ctx()`/`createUser()`/`actor()` from `tests/support/users.mjs`).
- Server pages call `requirePageUser(path, action?)` before loading data; the proxy alone is not a security check.
- After sign-in/out, navigate with `window.location.assign()` (a full load) so the header and server components see the new session.
- Client mutations go through `apiFetch` (`src/lib/api-client.js`) and report failures with `useToast()`; confirmations use `useConfirm()`, never `alert`/`confirm`.
- Pure logic goes in `src/lib/*.js` with relative imports (no `@/`, no `next/*`) so `node --test` can load it; add a test in `tests/`.
- Never enable SQLite WAL mode — production SQLite is on NFS.
- `Trip.id` is a human-readable slug, not a generated ID — keep using slugs if adding trip-scoped code.

### Testing (test-first)

Work TDD: write or extend a failing test, run it and watch it fail for the right reason, then implement until it passes. Every change ships with tests at the lowest layer that can catch the bug:

| Layer | Where | What it covers |
|---|---|---|
| Unit | `tests/*.test.mjs` | Pure modules in `src/lib` (markdown, reducer, meals, timeline, color contrast, theme script, trip status, apiFetch) |
| API handler | `tests/api/*.test.mjs` | `src/lib/api/*` against a real throwaway SQLite DB (`tests/support/test-db.mjs`, fixtures in `tests/support/fixtures.mjs`) |
| Scripts/config | `tests/scripts/*.test.mjs` | `docker-entrypoint.sh` (stubbed npx/node), seed `--force` guards, k8s/Dockerfile invariants, design tokens in sync with `color.js` and passing contrast |
| End-to-end | `tests/e2e/*.e2e.mjs` | Playwright (driven from `node --test`) against `next start` on a throwaway DB: HTTP auth wiring, real browser flows, themes, and axe-core WCAG 2.1 AA scans of every page/tab in light and dark |

- Test files import source with relative paths; `src/lib` modules used by tests must not import `@/` or `next/*`.
- Never point tests at `dev.db`; always use `createTestDb()` / `createDbFile()`.
- e2e tests need a production build (`npm run test:e2e` builds first) and Chromium (`npx playwright install chromium`).
- CI (`.github/workflows/test.yml`) runs lint, `npm test` and `npm run test:e2e` on every PR, and the deploy workflow only runs after it passes.
- Keep `loading.js` out of routes that call `notFound()`: streaming locks the status at 200 (see the e2e 404 tests).
- Styling: use the semantic tokens in `src/styles/tokens.css` (`--text`, `--surface`, `--accent`, `--trip-ink`, ...), never raw hex in components. New colour pairs must pass the axe e2e scan in both themes. Trip colours only reach CSS through `tripTheme()`.
