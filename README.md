# FIRE TRACE

> Did Earth burn more — or did our satellites just get better at seeing it?

A sensor-harmonized burning-activity calendar for any area on Earth.
NASA Space Apps 2026, challenge "Harmonization of MODIS and VIIRS Hot Spots".

Status: **Phase 0 (foundation)**. The Burning Calendar (F02) and the rest of Phase 1 are
described in [docs/SPEC.md](docs/SPEC.md) and scheduled in [docs/ROADMAP.md](docs/ROADMAP.md).

## Run it locally

Requirements: Node 24 (see `.nvmrc`) and pnpm 12.

```bash
pnpm install
pnpm fixtures                                        # writes delivery/mock-2026-11-15a (MOCK data)
pnpm contract:validate delivery/mock-2026-11-15a     # 16 checks, report in docs/reviews/
pnpm dev                                             # http://localhost:3000
```

With no database configured, a local server reads `meta.json` of the newest `delivery/mock-*`
folder and shows a **MOCK DATA** banner. This fallback is never used on Vercel.

To use a real database, copy `.env.example` to `.env.local`, fill in the Neon URLs, then:

```bash
pnpm db:migrate
pnpm ingest delivery/mock-2026-11-15a --skip-blob    # drop --skip-blob once BLOB_READ_WRITE_TOKEN is set
```

| Command                                        | What it does                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`       | Next.js dev server / production build / serve the build                 |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | ESLint / `tsc --noEmit` / Prettier                                      |
| `pnpm test` / `pnpm test:coverage`             | Vitest unit and property tests (coverage gate on `lib/domain`)          |
| `pnpm test:e2e`                                | Playwright; builds and starts the app, or targets `E2E_BASE_URL`        |
| `pnpm db:generate` / `pnpm db:migrate`         | Drizzle: create a migration from `db/schema.ts` / apply migrations      |
| `pnpm fixtures`                                | Deterministic mock delivery for Central Asia (`--cells N`)              |
| `pnpm contract:validate <dir>`                 | Check a delivery against [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) |
| `pnpm ingest <dir>`                            | Validate, then load a delivery into Postgres and make it active         |
| `pnpm bench [url]`                             | autocannon against the API                                              |

## Architecture

Decision record: [ADR 0001 — server-side aggregation on Postgres + CDN cache](docs/adr/0001-architecture.md).

```
science team ──delivery/<version>/──▶ contract:validate ──▶ ingest ──▶ Postgres (Neon) + Vercel Blob
                                                                            │
browser ◀── JSON (cached at the CDN per dataset_version) ◀── Next.js route handlers
```

- The science team harmonizes MODIS × VIIRS and delivers files; this repository validates,
  stores, queries and presents them. It never re-implements the harmonization.
- The server computes the calendar, series and metrics; the client only draws.
- Every number is an `HonestValue` with a status: `final`, `estimate`, `preliminary`,
  `no_data` or `future`. No data is never shown as zero. All data dates come from `meta.json`.

```
app/            routes and app/api/** route handlers
components/     UI components
lib/domain/     pure domain logic, no I/O: honest-value, status, baseline, stats, meta
server/         database client, repositories, services (all I/O)
db/             Drizzle schema and migrations
scripts/        make-fixtures, validate-contract, ingest, bench
tests/          unit/, e2e/, fixtures/
docs/           SPEC, DATA_CONTRACT, ROADMAP, adr/, reviews/
```

## How the agent team works

Development follows the `feature-cycle` skill in `docs/PROJECT_RULES.md`: spec → design → failing
tests → implementation → self-review → two independent reviews → fixes → performance and
accessibility gates → conventional commit. The git history shows each step.

| Agent                                         | Role                                                             |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `architect`                                   | Designs each feature before code; writes ADRs for real decisions |
| `backend-engineer`, `frontend-engineer`       | Implement the design                                             |
| `code-reviewer`                               | Independent review of every change                               |
| `science-integrity-reviewer`                  | Checks every computed or displayed number and its status         |
| `a11y-auditor`, `perf-auditor`, `qa-engineer` | Accessibility, performance budgets, end-to-end tests             |

Agents are defined in `docs/PROJECT_RULES.md`; their reports are saved in [docs/reviews/](docs/reviews/).
Project rules are in [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md).

## CI and deployment

[.github/workflows/ci.yml](.github/workflows/ci.yml): format, lint, typecheck, unit tests with
coverage, mock delivery against the contract, build; Playwright against each Vercel preview
deployment; migrations on `main`. Deployment steps are in `docs/PROJECT_RULES.md`.

## Data

Fire detections come from NASA FIRMS (MODIS and VIIRS). We acknowledge the
use of data and imagery from NASA's Fire Information for Resource Management System (FIRMS),
part of NASA's Earth Science Data and Information System (ESDIS).
