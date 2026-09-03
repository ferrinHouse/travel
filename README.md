# ✈️ Family Travel Adventures

A modern, responsive travel companion and itinerary management web application built for the Ferrin household adventures. Designed for seamless mobile and desktop use, it centralizes trip schedules, travel logistics, packing checklists, meal plans, and categorized grocery lists into a unified dashboard.

---

## ✨ Features

- **Dynamic Trip Dashboard**:
  - Automatically categorizes adventures into **Upcoming Trips** and **Past Adventures** based on calendar end-dates.
  - Custom color palettes and themes per trip (e.g., Chicago, Boston, Hawaii).
  - Quick metadata overview (dates, travel group, tags, descriptions).

- **Unified Day-by-Day Itinerary**:
  - Chronologically interweaves scheduled activities and meals (Breakfast, Lunch, Dinner).
  - Custom alert callouts for critical reservations, showtimes, and sporting events (e.g., Red Sox games, spa times).
  - Inline Markdown support for rich notes, maps, tickets, and hyperlinks.

- **Trip Logistics & Bookings**:
  - Markdown-enabled info cards for flights, hotels, VRBO rentals, confirmation codes, and transit schedules.
  - Direct links to live bus/train trackers, Google Maps routes, and booking portals.

- **Collaborative Packing & Pre-Trip Checklists**:
  - Categorized task lists: **Pre-Trip To-Do**, **Packing List**, and **Travel Apps**.
  - Open checkbox toggling: family members can check off items on the go without logging in.
  - Admin controls for adding, modifying, or deleting items.

- **Meal Planner & Master Grocery Shopping List**:
  - Day-by-day breakfast, lunch, and dinner scheduling with optional specific times.
  - Automatically sorts meals directly into each day's timeline.
  - Master grocery shopping checklist categorized by meal, store, or section (e.g., Trader Joe's, Costco, Taco Bar, Essentials).

- **Role-Based Admin Access Control**:
  - **Public Mode (Default)**: View itineraries, logistics, meals, and check off packing/grocery items.
  - **Admin Edit Mode (Passcode-protected)**: Unlock full CRUD capabilities to add, edit, or remove itinerary activities, logistics cards, checklist items, and meal plans. Session maintained via secure HTTP-only cookies.

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
│       └── ci.yml               # Automated ARM64 Docker build, GHCR push & K8s rollout
├── k8s/                         # Kubernetes deployment manifests
│   ├── base/                    # Base Deployment, Service, and PVC definitions
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── storage.yaml
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
│   │   │   ├── auth/            # Admin passcode login/session verification
│   │   │   ├── checklist/       # Packing & pre-trip checklist items
│   │   │   ├── grocery/         # Master grocery items
│   │   │   ├── logistics/       # Logistics info cards
│   │   │   └── meals/           # Meal planner upserts
│   │   ├── trips/[id]/          # Dynamic trip detail page with tabbed view
│   │   ├── globals.css          # Core design system, variables, and responsive layout
│   │   ├── layout.js            # Root HTML shell & metadata
│   │   └── page.js              # Dashboard homepage (Upcoming & Past trips)
│   ├── components/
│   │   └── TripDetailsClient.js # Interactive client component for tabs, modals, and edit forms
│   └── lib/
│       ├── db.js                # PrismaClient singleton with better-sqlite3 adapter
│       └── helpers.js           # Time parsing, markdown rendering, meal icons, and date checks
├── tests/
│   └── helpers.test.mjs         # Unit tests for helper utilities
├── Dockerfile                   # Multi-stage optimized Alpine Docker build
├── docker-entrypoint.sh         # Startup script running prisma db push before server.js
├── next.config.mjs              # Next.js config (output: "standalone")
├── package.json
└── prisma.config.ts             # Prisma CLI configuration
```

---

## 🗄️ Database Models

Defined in [`prisma/schema.prisma`](prisma/schema.prisma):

- **`Trip`**: Primary trip entity (`id`, `name`, `dates`, `travelers`, `status`, `startDate`, `endDate`, `tag`, `primaryColor`, `accentColor`).
- **`ItineraryDay`**: Calendar days assigned to a trip (`dayNumber`, `dateLabel`, `title`).
- **`ItineraryActivity`**: Timed or untimed activities for a day (`time`, `description`, `details`, `isAlert`, `order`).
- **`MealPlan`**: Meal scheduling per day (`dayNumber`, `mealType`, `mealName`, `details`, `time`).
- **`ChecklistItem`**: Shared tasks and packing requirements (`text`, `category`, `isCompleted`).
- **`LogisticsCard`**: Markdown travel details and confirmations (`title`, `content`, `order`).
- **`GroceryItem`**: Master shopping checklist (`name`, `category`, `isBought`).

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
ADMIN_PASSCODE="your_admin_passcode_here"
```

### 3. Initialize & Seed Database

Generate Prisma client artifacts, create the SQLite database schema, and seed the initial trip catalog:

```bash
# Push schema to SQLite
npx prisma db push

# Seed trips, logistics, checklists, and days
node prisma/seed.js

# Seed detailed meal planning and grocery items
npm run seed:meals
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Quality

Run the test suite using Node's built-in test runner:

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

---

## 🔌 API Endpoints Reference

All API routes are located in `src/app/api/`:

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/auth` | No | Submit admin passcode; sets `admin_authenticated` HTTP-only cookie |
| `GET` | `/api/auth` | No | Check if the current session has admin privileges |
| `DELETE` | `/api/auth` | No | Clear admin session cookie (lock edit mode) |
| `POST` | `/api/activities` | **Yes** | Update activity details, time, or alert status |
| `PUT` | `/api/activities` | **Yes** | Create a new activity for a trip day |
| `DELETE` | `/api/activities` | **Yes** | Delete an activity |
| `POST` | `/api/checklist` | *Conditional* | Toggle status (Open); create item or update text (**Yes**) |
| `DELETE` | `/api/checklist` | **Yes** | Delete a checklist item |
| `POST` | `/api/grocery` | No | Toggle `isBought` status of a grocery item |
| `PUT` | `/api/grocery` | No | Add a new custom grocery item |
| `POST` | `/api/logistics` | **Yes** | Create or update a logistics card |
| `DELETE` | `/api/logistics` | **Yes** | Delete a logistics card |
| `POST` | `/api/meals` | **Yes** | Upsert a meal plan record for a given day and meal type |

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
  -e ADMIN_PASSCODE="your_passcode" \
  -v $(pwd)/database:/app/database \
  travel-site:latest
```

The container entrypoint (`docker-entrypoint.sh`) executes `prisma db push` on startup to guarantee migrations are applied before starting `server.js`.

### Kubernetes & Kustomize

Production deployment runs on a self-hosted Kubernetes cluster:

- **Storage**: PersistentVolume and PVC (`travel-site-pvc`) mounted to `/app/database`, backed by an NFS export (`192.168.1.253:/export/travel-db`).
- **Service**: NodePort service exposing the app on port `30090`.
- **Secret**: `travel-secrets` providing `ADMIN_PASSCODE`.

Deploy manually using Kustomize:

```bash
kubectl apply -k k8s
kubectl rollout restart deployment/travel-site-deployment
```

### Continuous Integration & Deployment (CI/CD)

The GitHub Actions workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) triggers on pushes to the `main` branch:
1. **Build**: Builds an ARM64 container image using native `ubuntu-24.04-arm` runners and pushes to `ghcr.io/ferrinhouse/travel-site:latest` with GitHub Actions layer caching.
2. **Deploy**: Runs on a self-hosted runner to apply Kubernetes manifests via `kubectl apply -k k8s` and triggers a zero-downtime rolling restart.

---

## 🗺️ Roadmap & Future Feature Plans

The following features and architectural enhancements are planned for upcoming releases:

### 1. 🔐 Robust Authentication (Scoped for Updates)
- **Current State**: A single shared passcode stored in environment variables (`ADMIN_PASSCODE`) unlocks edit mode via an HTTP-only session cookie.
- **Planned Improvements**:
  - **Targeted Protection for Mutations**: Implement a modern, robust authentication provider (e.g., Auth.js / NextAuth, OAuth with Google/GitHub, or WebAuthn/Passkeys) strictly enforcing authorization on mutating endpoints (`POST`, `PUT`, `DELETE`).
  - **Friction-Free Public Viewing**: Maintain completely unauthenticated, instant-load read access for itineraries and logistics, as well as friction-free checkbox toggling for packing and grocery items so family members can check off tasks on mobile without needing credentials.
  - **Session Security & Auditability**: Move away from a single static passcode toward individual user credentials, audit logging for edits, and rate-limiting on sensitive API routes.

### 2. ➕ Dynamic Trip Creation & Management (UI & API)
- **Current State**: New trips are currently added via database seeding scripts (`prisma/seed.js`) or direct database insertions.
- **Planned Improvements**:
  - **In-App Trip Creator Wizard**: Add an interactive **"+ New Trip"** modal or dedicated setup page accessible to authenticated admins.
  - **Customizable Metadata & Theming**: Form controls to define trip slug ID, name, date range (`startDate` to `endDate`), traveler list, tags (City, Island, Beach, National Parks), and custom primary/accent hex color palettes.
  - **Auto-Scaffolded Schedules**: Automatically generate day slots (`Day 1`, `Day 2`, etc.) matching the date range, along with baseline checklist categories (Pre-Trip, Packing, Apps) and empty meal templates.
  - **Trip Editing & Archiving**: Full UI controls to edit existing trip details, manually adjust upcoming/past status, and safely archive or delete trips with cascading cleanup.

### 3. 📱 Offline Support & Progressive Web App (PWA)
- Implement service workers and manifest caching so full itineraries, flight confirmations, hotel addresses, and packing lists remain accessible when traveling through areas with spotty cellular coverage (e.g., flights, cruises, national parks).

### 4. 📅 Calendar & Navigation Integration
- One-click `.ics` calendar export and Google Calendar synchronization for flights, reservations, and timed events.
- Embedded maps showing daily activity routes, transit directions, and walking distance estimates.

