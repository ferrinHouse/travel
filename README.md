# ✈️ Family Travel Adventures

A modern, responsive travel companion and itinerary management web application built for the Ferrin household adventures. Designed for seamless mobile and desktop use, it centralizes trip schedules, travel logistics, packing checklists, meal plans, and categorized grocery lists into a unified dashboard.

---

## ✨ Features

- **Dynamic Trip Dashboard**:
  - Automatically categorizes adventures into **Upcoming Trips** and **Past Adventures** based on calendar end-dates.
  - Custom color palettes and themes per trip (e.g., Chicago, Boston, Hawaii), automatically adjusted to stay readable (WCAG AA).
  - Light and dark mode (follows the device, or pick one), with no flash on load.
  - Trip hero with a countdown, or "Day 3 of 6" while you're there, with today's plan highlighted and the next activity marked.
  - Phone-friendly bottom tab bar.
  - Quick metadata overview (dates, travel group, tags, descriptions).
  - Archived trips are tucked into a collapsed **Archived** section.

- **Planning Trips in the App** (admins):
  - **Plan a trip** (`/trips/new`): name, web address, trip type, who's going, dates and colours, with a live preview card. One itinerary day is created per date, plus a starter checklist (or one copied from another trip, or none).
  - **Trip settings** (`/trips/<id>/edit`, from the trip page): change any detail. New dates add days at the end, or remove empty ones; a day that already has activities or meals is never removed (the save is refused and says which day). Auto-generated day labels follow the new dates; hand-written ones are kept.
  - Rename a day in Edit mode, archive/restore a trip, or delete it (type the trip name to confirm).

- **Unified Day-by-Day Itinerary**:
  - Chronologically interweaves scheduled activities and meals (Breakfast, Lunch, Dinner).
  - Custom alert callouts for critical reservations, showtimes, and sporting events (e.g., Red Sox games, spa times).
  - Inline Markdown support for rich notes, maps, tickets, and hyperlinks.

- **Trip Logistics & Bookings**:
  - Markdown-enabled info cards for flights, hotels, VRBO rentals, confirmation codes, and transit schedules.
  - Direct links to live bus/train trackers, Google Maps routes, and booking portals.

- **Collaborative Packing & Pre-Trip Checklists**:
  - Categorized task lists: **Pre-Trip To-Do**, **Packing List**, and **Travel Apps**.
  - Members can check off items and add new ones from their phones.
  - Admins rename and delete items.

- **Meal Planner & Master Grocery Shopping List**:
  - Day-by-day breakfast, lunch, and dinner scheduling with optional specific times.
  - Automatically sorts meals directly into each day's timeline.
  - Master grocery shopping checklist categorized by meal, store, or section (e.g., Trader Joe's, Costco, Taco Bar, Essentials).

- **Scrapbook** (photos from the trip):
  - **Photos** tab on every trip (past trips open on it). Members add photos from their phone; each lands on the itinerary day it was taken (from the camera's date), or under "Other photos".
  - Photos are shrunk in the browser before upload (saves data on the road; iPhone HEIC becomes JPEG), then stored as three sizes with location and camera data removed.
  - Tap a photo for the full-screen viewer: swipe or use the arrow keys, download the original, and (for your own photos, or admins in Edit mode) add a caption, move it to another day, or delete it. Admins pick the **trip cover**, shown on the trip header and the dashboard card.
  - **Trip story** (`/trips/<id>/story`): the trip as a printable scrapbook, with each day's plans and photos. "Print or save as PDF" makes a keepsake.
  - **Share link** (off by default): from Trip settings, admins can make a read-only link to the story for people without an account. It shows only the story and photos (no logistics, checklists or meals), is hidden from search engines, and can be turned off or replaced any time.

- **Family Accounts**:
  - Everyone signs in with their own username and a password or a **passkey** (Face ID, Touch ID, Windows Hello, Android screen lock). Nothing is visible without signing in.
  - **Viewer** sees everything; **Member** also ticks off and adds packing and grocery items and adds photos; **Admin** plans trips (behind an "Edit mode" switch) and manages people.
  - Admins add people at **People** (`/admin/users`) and text them a one-time invite link; forgotten passwords get a one-time reset link the same way.
  - **Your account** (`/account`) manages passkeys, password and signed-in devices.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) with Standalone Output |
| **UI & Components** | [React 19](https://react.dev/) |
| **Styling** | Vanilla CSS with custom properties (CSS variables), responsive cards, tabs, and modals |
| **Database & ORM** | [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-better-sqlite3` and `better-sqlite3` |
| **Storage Engine** | [SQLite](https://www.sqlite.org/) (`dev.db` locally, persistent NFS storage in production) |
| **Testing** | Native Node.js test runner (`node --test`) |
| **Containerization** | Multi-stage [Docker](https://www.docker.com/) (`node:22-alpine` with native build tools) |
| **Orchestration** | [Kubernetes](https://kubernetes.io/) with [Kustomize](https://kustomize.io/) |
| **CI / CD** | [GitHub Actions](https://github.com/features/actions) with native ARM64 runners & [GHCR](https://github.com/features/packages) |

---

## 📁 Project Structure

```text
travel/
├── .github/
│   └── workflows/
│       ├── ci.yml               # Tests ∥ ARM64 build, promote to :latest, K8s rollout
│       └── test.yml             # Lint + all tests on every pull request
├── k8s/                         # Kubernetes deployment manifests
│   ├── base/                    # Base Deployment, Service, and PVC definitions
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── storage.yaml         # Database volume
│   │   └── uploads-storage.yaml # Photo volume (20Gi)
│   ├── patches/                 # Environment patches (NFS server IP & export path)
│   │   └── nfs-server.yaml
│   └── kustomization.yaml
├── prisma/                      # Database schema and seed data
│   ├── schema.prisma            # Prisma schema (Trips, Itineraries, Meals, Groceries, Checklists)
│   ├── seed.js                  # Master seed script (Chicago, Boston, Hawaii, Sioux Falls, Southwest)
│   └── seed-meals.js            # Detailed meal schedules and grocery lists
├── public/                      # Static assets & favicon
├── src/
│   ├── app/
│   │   ├── api/                 # Next.js Route Handlers (REST endpoints)
│   │   │   ├── activities/      # Itinerary activity CRUD
│   │   │   ├── trips/           # Create / edit / delete trips, archive (trips/archive), share links (trips/share)
│   │   │   ├── photos/          # Upload / caption / delete; photos/[id]/[size] serves the files
│   │   │   ├── share/           # Photo files for share links (no sign-in, token-checked)
│   │   │   ├── days/            # Day titles
│   │   │   ├── auth/            # Sign in/out, first-run setup, invites, passkey sign-in
│   │   │   ├── account/         # Own password, passkeys and sessions
│   │   │   ├── users/           # Admin user management
│   │   │   ├── checklist/       # Packing & pre-trip checklist items
│   │   │   ├── grocery/         # Master grocery items
│   │   │   ├── logistics/       # Logistics info cards
│   │   │   └── meals/           # Meal planner upserts
│   │   ├── trips/new/           # Plan a new trip (admins)
│   │   ├── trips/[id]/          # Dynamic trip detail page with tabbed view; edit/ = trip settings; story/ = scrapbook
│   │   ├── share/[token]/       # Read-only shared trip story
│   │   ├── layout.js            # Root HTML shell, fonts, metadata, no-flash theme script
│   │   └── page.js              # Dashboard homepage (Upcoming & Past trips)
│   ├── components/
│   │   ├── site/                # Sticky site header + System/Light/Dark theme switch
│   │   ├── trip/                # Trip detail page: tab shell + itinerary/logistics/checklist/meals/photos tabs
│   │   ├── story/               # Trip story (scrapbook) used by the story and share pages
│   │   ├── trips/               # Trip hero, dashboard cards, featured "next adventure", trip form, archive/delete
│   │   └── ui/                  # Shared UI kit: Modal, Toast, ConfirmDialog, Markdown, Skeleton
│   ├── styles/                  # Design tokens (light/dark), base, components, utilities
│   └── lib/
│       ├── db.js                # PrismaClient singleton with better-sqlite3 adapter
│       ├── helpers.js           # Time parsing, meal icons, and date checks
│       ├── markdown.js          # Safe markdown renderer (escapes HTML, safe link schemes only)
│       ├── color.js             # Per-trip colours → contrast-checked CSS variables
│       ├── theme.js             # Theme preference + inline no-flash script
│       ├── trip-status.js       # Countdown / "Day N of M" / past
│       ├── trip-reducer.js      # Pure reducer for trip page state
│       ├── trips/               # Trip dates, day scaffolding/reconciling, slugs, form validation, starter checklist
│       ├── photos/              # EXIF dates, day matching, upload checks, sharp resizing, file storage, view helpers
│       └── api-client.js        # fetch wrapper that throws on API errors
├── tests/
│   ├── *.test.mjs               # Unit tests for pure modules in src/lib
│   ├── api/                     # API handler tests against a throwaway SQLite DB
│   ├── scripts/                 # Entrypoint, seed guard and deploy-config tests
│   ├── e2e/                     # Playwright browser + HTTP tests against next start
│   └── support/                 # Test DB helper and fixtures
├── Dockerfile                   # Multi-stage optimized Alpine Docker build
├── docker-entrypoint.sh         # Startup script running prisma db push before server.js
├── next.config.mjs              # Next.js config (output: "standalone")
├── package.json
└── prisma.config.ts             # Prisma CLI configuration
```

---

## 🗄️ Database Models

Defined in [`prisma/schema.prisma`](prisma/schema.prisma):

- **`Trip`**: Primary trip entity (`id`, `name`, `dates`, `travelers`, `status`, `startDate`, `endDate`, `tag`, `primaryColor`, `accentColor`, `archivedAt`). `id` is the web address (`/trips/<id>`) and never changes; `dates` is display text derived from the dates.
- **`ItineraryDay`**: Calendar days assigned to a trip (`dayNumber`, `dateLabel`, `title`). A day's date is the trip start plus its position.
- **`ItineraryActivity`**: Timed or untimed activities for a day (`time`, `description`, `details`, `isAlert`, `order`).
- **`MealPlan`**: Meal scheduling per day (`dayNumber`, `mealType`, `mealName`, `details`, `time`).
- **`ChecklistItem`**: Shared tasks and packing requirements (`text`, `category`, `isCompleted`).
- **`LogisticsCard`**: Markdown travel details and confirmations (`title`, `content`, `order`).
- **`GroceryItem`**: Master shopping checklist (`name`, `category`, `isBought`).
- **`Photo`**: Scrapbook photos (`dayNumber`, `caption`, `takenAt`, `width`, `height`, `bytes`, `isCover`, `uploadedById`). Files live on the uploads volume at `photos/<tripId>/<storageKey>/` as `orig.jpg` (≤4096px), `lg.webp` (1600px) and `sm.webp` (480px).
- **`TripShareLink`**: Optional read-only story links; stores only a SHA-256 of the token, and `revokedAt` when turned off.
- **`User`**, **`Session`**, **`Passkey`**, **`Invite`**, **`AuthChallenge`**: accounts and sign-in. Session and invite rows store only a SHA-256 of the cookie/link token; passwords are scrypt hashes.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v22.0.0 or later
- **npm**: v10.0.0 or later

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/ferrinHouse/travel.git
cd travel
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
# One-time code for creating the first admin at /setup (any random string).
SETUP_TOKEN="make-up-a-long-random-string"
# Optional locally (defaults to the request's own address); required in production.
# APP_ORIGIN="http://localhost:3000"
```

Then open `/setup`, enter the setup code and create your admin account. `/setup` disappears as soon as one user exists. From there, add everyone else at **People**.

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file |
| `SETUP_TOKEN` | First run only | Code required by `/setup` to create the first admin |
| `APP_ORIGIN` | Production | Public `https://` address: passkey origin, `Secure` cookies and the cross-site write check |
| `WEBAUTHN_RP_ID` | No | Passkey domain; defaults to `APP_ORIGIN`'s hostname |
| `WEBAUTHN_RP_NAME` | No | Name shown in passkey prompts (default "Family Travel Adventures") |
| `UPLOADS_DIR` | No | Where photo files go (default `./uploads`, git-ignored; `/app/uploads` in production) |
| `MAX_UPLOAD_MB` | No | Largest accepted photo upload (default 25) |

### 3. Initialize & Seed Database

Generate Prisma client artifacts, create the SQLite database schema, and seed the initial trip catalog:

```bash
# Push schema to SQLite
npx prisma db push

# Seed trips, logistics, checklists, and days (wipes existing data, hence --force)
node prisma/seed.js --force

# Seed detailed meal planning and grocery items
npm run seed:meals -- --force
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Quality

Tests use Node's built-in test runner, with Playwright for browser tests:

```bash
npm test            # unit, API handler and script tests (throwaway SQLite DBs, ~10s)
npm run test:e2e    # production build + browser/HTTP tests against `next start`
npm run test:all    # everything
```

First-time setup for browser tests: `npx playwright install chromium`. Tests never touch `dev.db`; each test file gets its own temporary database. CI runs lint and both suites on every pull request, and deploys from `main` only after they pass.

Run ESLint:

```bash
npm run lint
```

---

## 🔌 API Endpoints Reference

All API routes are located in `src/app/api/`:

Handlers live in `src/lib/api/` and check permissions with `deny(ctx, action)`: no session is `401`, a role that is too low is `403`. Writes with a foreign `Origin` header are rejected with `403`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| `GET` | `/api/health` | Anyone | Health probe (checks the database connection) |
| `POST` | `/api/auth/login` | Anyone | Username + password; sets the `travel_session` cookie (rate limited) |
| `POST` | `/api/auth/logout` | Anyone | Ends this session |
| `GET` | `/api/auth/me` | Anyone | The signed-in user, or `null` |
| `GET`/`POST` | `/api/auth/setup` | Anyone | First-run status / create the first admin (needs `SETUP_TOKEN`, zero users) |
| `GET`/`POST` | `/api/auth/invite` | Link holder | Describe / accept an invite or reset link (sets a password, signs in) |
| `POST` | `/api/auth/passkey/options`, `/verify` | Anyone | Passkey sign-in challenge and answer |
| `POST` | `/api/account/password` | Signed in | Change or add a password (signs out other devices) |
| `GET`/`DELETE` | `/api/account/sessions` | Signed in | List / sign out own devices |
| `GET`/`PATCH`/`DELETE` | `/api/account/passkeys` | Signed in | List / rename / remove own passkeys |
| `POST` | `/api/account/passkeys/options`, `/verify` | Signed in | Add a passkey |
| `GET`/`POST`/`PATCH` | `/api/users` | Admin | List / add (returns invite link token) / change role, name or on-off |
| `POST` | `/api/users/link` | Admin | New one-time invite or reset link |
| `DELETE` | `/api/users/sessions` | Admin | Sign someone out everywhere |
| `POST`/`PATCH`/`DELETE` | `/api/trips` | Admin | Create (with days + checklist) / edit (reconciles days; `409` if a day with plans would go) / delete (needs `confirmName`) |
| `POST` | `/api/trips/archive` | Admin | Archive or restore (`{ id, archived }`) |
| `PATCH` | `/api/days` | Admin | Set a day's title |
| `POST`/`DELETE` | `/api/trips/share` | Admin | Make a share link (returns the URL once; replaces any old one) / turn sharing off |
| `POST` | `/api/photos?tripId=…` | Member | Upload one photo (raw image body; optional `takenAt`, `dayNumber`, `caption` in the query) |
| `PATCH`/`DELETE` | `/api/photos` | Uploader or Admin | Caption / day (`isCover` is admin-only) / delete |
| `GET` | `/api/photos/<id>/<size>` | Signed in | Photo file, size `sm`, `lg` or `orig` (`?download=1` for an attachment) |
| `GET` | `/api/share/<token>/<id>/<size>` | Link holder | Photo file for a live share link (`sm` or `lg` only) |
| `POST` | `/api/checklist` | Member | Tick an item, or add one; renaming needs Admin |
| `DELETE` | `/api/checklist` | Admin | Delete a checklist item |
| `POST` | `/api/grocery` | Member | Tick a grocery item |
| `PUT` | `/api/grocery` | Member | Add a grocery item |
| `POST`/`PUT`/`DELETE` | `/api/activities` | Admin | Update / create / delete an activity |
| `POST`/`DELETE` | `/api/logistics` | Admin | Save / delete a logistics card |
| `POST` | `/api/meals` | Admin | Upsert a meal plan record for a given day and meal type |

---

## 🚢 Production & Deployment

### Containerization (Docker)

The repository uses a multi-stage Docker build producing a standalone Next.js image based on `node:22-alpine`:

```bash
# Build Docker image
docker build -t travel-site:latest .

# Run container locally
docker run -p 3000:3000 \
  -e DATABASE_URL="file:/app/database/travel.db" \
  -e APP_ORIGIN="http://localhost:3000"   -e SETUP_TOKEN="make-up-a-long-random-string" \
  -v $(pwd)/database:/app/database \
  travel-site:latest
```

The container entrypoint (`docker-entrypoint.sh`) copies the database to `database/backups/` (keeping the 5 newest), then runs `prisma db push` before starting `server.js`. The push runs **without** `--accept-data-loss`, so a schema change that would drop data stops the rollout instead of deleting it. `GET /api/health` backs the startup, readiness and liveness probes.

### Kubernetes & Kustomize

Production deployment runs on a self-hosted Kubernetes cluster:

- **Storage**: PersistentVolume and PVC (`travel-site-pvc`) mounted to `/app/database`, backed by an NFS export (`192.168.1.253:/export/travel-db`).
- **Photos**: a second 20Gi volume (`travel-uploads-pvc`, reclaim policy `Retain`) mounted to `/app/uploads`, backed by `192.168.1.253:/export/travel-uploads`. The export must exist and be owned by the container user before the first deploy with photos: `chown -R 1001:1001 /export/travel-uploads`. Back it up along with the database export.
- **Service**: NodePort service exposing the app on port `30090`.
- **Config**: `APP_ORIGIN` is set by the `travel-config` ConfigMap generated in [`k8s/kustomization.yaml`](k8s/kustomization.yaml). Passkeys are tied to that hostname.
- **Secret**: `travel-secrets` may hold `SETUP_TOKEN` (optional). Add it for the first deploy, create the admin at `/setup`, then remove it.

**Locked out?** Every admin forgot their password and lost their passkeys? Print a one-time reset link from inside the pod:

```bash
kubectl exec deploy/travel-site-deployment -- node scripts/admin-reset.mjs <username>
kubectl exec deploy/travel-site-deployment -- node scripts/admin-reset.mjs <username> --make-admin   # also promote + turn back on
```

Deploy manually using Kustomize:

```bash
kubectl apply -k k8s
kubectl rollout restart deployment/travel-site-deployment
```

### Continuous Integration & Deployment (CI/CD)

The GitHub Actions workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) triggers on pushes to the `main` branch:
1. **Test** and **Build** run in parallel: the full test suite (`test.yml`: lint, unit/API/script tests, e2e) alongside an ARM64 image build on native `ubuntu-24.04-arm` runners, pushed as `ghcr.io/ferrinhouse/travel-site:sha-<commit>` with GitHub Actions layer caching.
2. **Promote**: only once both pass, the tested image is re-tagged `latest` in the registry (`docker buildx imagetools create`, no rebuild). The cluster pulls `latest` on every restart, so an untested image never gets that tag.
3. **Deploy**: runs on a self-hosted runner to apply Kubernetes manifests via `kubectl apply -k k8s`, restarts the deployment and waits for the rollout.

Rolling back is a re-tag of an earlier build: `docker buildx imagetools create --tag ghcr.io/ferrinhouse/travel-site:latest ghcr.io/ferrinhouse/travel-site:sha-<older-commit>`, then `kubectl rollout restart deployment/travel-site-deployment`.

---

## 🗺️ Roadmap & Future Feature Plans

The following features and architectural enhancements are planned for upcoming releases:

### 1. 🔐 Authentication
- Done: per-person accounts with passwords and passkeys, Viewer/Member/Admin roles, invite and reset links. Still open: an audit log of edits.

### 2. ➕ Dynamic Trip Creation & Management (UI & API)
- Done: plan, edit, archive and delete trips in the app, with day lists kept in step with the dates. Still open: reordering or inserting days in the middle of a trip, and copying a whole itinerary from a past trip.

### 3. 📷 Scrapbook
- Done: photos by day, trip cover, printable trip story and optional share links. Still open: videos, and a storage-usage view for admins.

### 4. 📱 Offline Support & Progressive Web App (PWA)
- Implement service workers and manifest caching so full itineraries, flight confirmations, hotel addresses, and packing lists remain accessible when traveling through areas with spotty cellular coverage (e.g., flights, cruises, national parks).

### 5. 📅 Calendar & Navigation Integration
- One-click `.ics` calendar export and Google Calendar synchronization for flights, reservations, and timed events.
- Embedded maps showing daily activity routes, transit directions, and walking distance estimates.

