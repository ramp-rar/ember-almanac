# Ember Almanac — engineering rules

> "Did Earth burn more — or did our satellites just get better at seeing it?"
> A sensor-harmonized burning-activity calendar for any area on Earth (NASA Space Apps 2026,
> challenge "Harmonization of MODIS and VIIRS Hot Spots").

## Who builds what
- **Science team** (not in this repo's scope): downloads FIRMS, harmonizes MODIS × VIIRS,
  delivers files described in `docs/DATA_CONTRACT.md`.
- **This repo** (full-stack owner): ingestion of those files, database, API, web UI, export,
  deployment. We never re-implement the team's harmonization; we validate, store, query and present it.

## Non-negotiable product rules
1. **The Burning Calendar is the home screen.** Rows = years 2000–2026, columns = Jan–Dec.
2. **Honest values only.** Every number shown to a user is an `HonestValue` (see `lib/domain/honest-value.ts`)
   and carries a status: `final | estimate | preliminary | no_data | future`.
   The UI component API must make it impossible to render a value without its status.
   - `no_data`: before 2000-11-01 (MODIS start) or a FIRMS missing day/month.
   - `estimate`: years < 2012 (MODIS-only, scaled into VIIRS-equivalent units).
   - `preliminary`: months after the last Standard-processing (SP) date; NRT data is replaced by SP with ~5 months lag.
   - `future`: after today.
   - Exact dates come from `meta.json` delivered by the science team, never hard-coded in components.
3. **No data ≠ zero.** `no_data` cells are hatched grey, never coloured as 0.
4. **Main metric for emergency services:** ratio to the multi-year median of the same month,
   e.g. "×1.8 vs median of 24 Novembers". Median is computed AFTER aggregating the AOI per year
   (medians are not additive). Baseline excludes the target year; requires ≥ 10 valid years;
   if median = 0 show the absolute value and "no usual activity" instead of a ratio.
5. **Colour scales are colour-vision-deficiency safe** (sequential: inferno/cividis; diverging: blue↔orange),
   and colour is never the only channel — numbers/tooltips/patterns always accompany it.
6. **Performance is a feature.** Budgets in `docs/adr/0003-first-load-js-budget.md`. A PR that breaks a budget is not merged.

## Stack (decided — change only through an ADR in `docs/adr/`)
- Next.js (App Router, current stable) + TypeScript `strict` + Tailwind + shadcn/ui
- State: TanStack Query (server state), Zustand (UI state), nuqs (URL state → shareable links)
- Map: MapLibre GL JS + terra-draw (drawing) + h3-js (in a Web Worker)
- Charts: ECharts (lazy-loaded). Calendar: own SVG component (324 cells — no chart lib needed)
- Backend: Next.js Route Handlers (Node runtime) on Vercel Functions; Zod validation on every boundary
- DB: Postgres (Neon via Vercel Marketplace) + Drizzle ORM + drizzle-kit migrations
- Object storage: Vercel Blob (team's raw files, region geometries, large exports)
- Tests: Vitest (unit/property), Playwright (e2e + visual), autocannon (API load)
- CI: GitHub Actions (or GitLab CI) + Vercel Git integration (preview per PR, production on `main`)

## Repository map
```
app/                 routes (UI) + app/api/** (route handlers)
components/          UI components (calendar/, map/, charts/, aoi/, ui/)
lib/domain/          pure domain logic: honest-value, status, baseline, stats (no I/O)
lib/h3/              h3 helpers + web worker
server/              db client, repositories, services (I/O lives here only)
db/                  drizzle schema + migrations
scripts/             validate-contract, ingest, build-regions, bench
tests/               unit/, e2e/, fixtures/
docs/                SPEC.md, DATA_CONTRACT.md, ROADMAP.md, adr/, reviews/
```

## Commands
```
pnpm dev | pnpm build | pnpm lint | pnpm typecheck | pnpm test | pnpm test:e2e
pnpm db:generate | pnpm db:migrate | pnpm contract:validate <dir> | pnpm ingest <dir> | pnpm bench
```

## How we work (this is NOT vibe coding)
Every feature goes through the feature cycle: spec → ADR if a decision is made → failing tests →
implementation → self-review → two independent reviews (code and science integrity) → fixes → perf/a11y gate →
conventional commit + PR with the filled checklist. Review notes are saved to `docs/reviews/`.
Never skip a step silently; if a step is skipped, write why in the PR.

## Do not
- Do not invent numbers, coefficients or "confidence %" that are not computed from data.
- Do not add: login, AI chatbot, 3D globe, leaderboards, streaks, fire "prediction". (See ROADMAP "Eliminate".)
- Do not call FIRMS from the browser. Do not commit secrets. Do not edit migrations after merge.
