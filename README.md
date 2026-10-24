# ACME Salary Management

A web app for ACME's HR manager to keep salary records for **10,000 employees across 8 countries** accurate, and to answer "how do we pay people?" in a few clicks. It replaces an Excel workbook.

- **Browse and search** employees (25 per page; filter by name, country, department, job title; active or inactive).
- **Add, edit and delete** employees. Every rule is checked on the server. Deleting marks an employee inactive (with an exit date) and never loses data.
- **Salary history**: each pay change keeps its effective date and an optional reason. The current salary is always the latest entry.
- **Insights**: min / max / mean / median per country, per job title within a country, and an organisation-wide comparison in USD.
- **Excel import and export**: export the current view or a template, then re-upload it. The import shows a preview first (create / update / unchanged / error) and applies all-or-nothing.

## Documentation

| Document                                                                                 | What it covers                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`docs/requirements.md`](docs/requirements.md)                                           | One-page requirements: goal, scope, what is out of scope and why                              |
| [`docs/specs/salary-management-discovery.md`](docs/specs/salary-management-discovery.md) | Discovery: hypotheses, slices, risks                                                          |
| [`docs/specs/salary-management-spec.md`](docs/specs/salary-management-spec.md)           | Spec: acceptance criteria per slice, API shape, rules                                         |
| [`docs/plans/salary-management-plan.md`](docs/plans/salary-management-plan.md)           | Implementation plan: stack, structure, slice-by-slice design                                  |
| [`docs/architecture.md`](docs/architecture.md)                                           | Architecture diagrams, key decisions and trade-offs, measured performance, production changes |
| [`docs/ai-usage.md`](docs/ai-usage.md)                                                   | How AI tools were used to build this, prompts and decisions                                   |

## Prerequisites

- **Node 24** (the repo pins it in `.nvmrc`). With nvm: `nvm install && nvm use`.
- npm 10 or newer (ships with Node 24). No other services: the database is a local SQLite file.

## Getting started

```bash
nvm use              # Node 24
npm ci               # install all workspaces (contracts, server, web)
npm run seed         # create ./server/data/salary.db with 10,000 seeded employees
npm run dev          # API on http://localhost:3000, web app on http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the API on port 3000.

The seed is deterministic (fixed random seed) and safe to re-run: it replaces all rows, so you always end with the same 10,000 employees and no duplicates.

## Commands

| Command                         | What it does                                                            |
| ------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                   | API (`tsx watch`) and web (Vite) together                               |
| `npm run seed`                  | Replace the database contents with the 10,000-employee seed             |
| `npm run build`                 | Type-check and build the web app into `web/dist`                        |
| `npm start`                     | Run the API; it also serves `web/dist` if it exists (production mode)   |
| `npm test`                      | Fast unit and integration tests for server and web (no perf tests)      |
| `npm run test:perf`             | Performance suite at 10,000 employees (see below)                       |
| `npm run lint`                  | ESLint over the whole repo                                              |
| `npm run typecheck`             | `tsc` for every workspace                                               |
| `npm run format`                | Prettier. Do not run it over `web/src/components/ui/` (vendored shadcn) |
| `npm run db:generate -w server` | Generate a Drizzle migration after changing `server/src/db/schema.ts`   |

## Environment variables

All optional. Read by the server (`server/src/config.ts`).

| Variable        | Default                                    | Meaning                                                                              |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `PORT`          | `3000`                                     | HTTP port                                                                            |
| `DATABASE_PATH` | `./data/salary.db` (relative to `server/`) | SQLite file. Created and migrated on boot                                            |
| `SEED_ON_EMPTY` | `false`                                    | When `true`, seed the 10,000 demo employees at boot if the database has no employees |
| `APP_TIMEZONE`  | `UTC`                                      | Time zone that decides what "today" is (hire-date limits, effective dates)           |
| `WEB_DIST_PATH` | `../web/dist` (relative to `server/`)      | Built web app to serve. If the folder is missing, only the API is served             |

## Tests

```bash
npm test             # ~620 tests, a few seconds, deterministic (fixed clock and seed, in-memory SQLite)
npm run test:perf    # 5 timing tests against 10,000 employees, kept out of `npm test` on purpose
```

The perf suite covers the first list page, country insights, export, import preview and import apply, each with a time budget. Measured numbers are in [`docs/architecture.md`](docs/architecture.md#performance).

## Production build, locally

```bash
npm run build
SEED_ON_EMPTY=true DATABASE_PATH=/tmp/salary.db npm start
# http://localhost:3000 serves the web app; GET /api/health returns {"status":"ok"}
```

## Deploying

The repo ships a multi-stage `Dockerfile` (Node 24 slim) and a Render Blueprint, `render.yaml`. One container serves the API and the web app on port 3000, migrates the database on boot, and seeds it when it is empty (`SEED_ON_EMPTY=true`), so a fresh deployment shows 10,000 employees straight away.

**On Render:**

1. Push the repo to GitHub.
2. In Render choose **New > Blueprint** and select the repo. Render reads `render.yaml`.
3. The blueprint attaches a 1 GB disk at `/data` (the SQLite file is `/data/salary.db`), so data survives deploys. Disks need a paid plan. On a free instance remove the `disk` block: the database is then recreated and re-seeded on every restart, and edits are lost.
4. The health check is `/api/health`. Nothing secret is configured.

**Anywhere else (Railway, Fly.io, a VM):**

```bash
docker build -t acme-salary .
docker run -p 3000:3000 -v acme-data:/data acme-salary
```

Mount a volume at `/data` to keep the data. The app has **no authentication**, so do not put real salary data on a public URL (see "What would change for production" in the architecture doc).

## Repository layout

```
contracts/   @acme/contracts: TypeScript types shared by server and web (no build step)
server/      Express 5 API: src/{employees,insights,spreadsheet,reference,seed,shared,db}, drizzle/ migrations, perf/ suite
web/         React 19 SPA (Vite, Tailwind, shadcn/ui, TanStack Query, React Router)
docs/        requirements, spec, plan, architecture, AI usage
```
