# Ember Almanac

> Did Earth burn more — or did our satellites just get better at seeing it?

A harmonized MODIS × VIIRS burning calendar, 2000–2026, for 159 countries and Texas, in English,
Russian and Tajik. NASA Space Apps Challenge 2026 · Dushanbe · challenge
"Harmonization of MODIS and VIIRS Hot Spots" · team **Adeptus Vulkanis**.

- **Live:** https://ember-almanac.vercel.app
- **Demo (7 slides, PDF):** https://ember-almanac.vercel.app/ember-almanac-demo.pdf

## What it does

1. **Burning calendar** — rows are years, columns are months; one harmonized scale across the
   2012 sensor change (MODIS → VIIRS).
2. **Plain-language answer** for any month: "×0.5 vs median of 25 Octobers (2001–2025),
   preliminary" with the absolute numbers and the percentile.
3. **Honest statuses** on every value: checked, estimate (older satellite), preliminary, no data,
   not yet. No data is never drawn as zero.
4. **3D satellite map** with relief and the places where fire was detected in the selected month
   (last 12 months) or in a typical year.
5. **Trend** (Mann–Kendall + Theil–Sen; "no detectable trend" when p ≥ 0.05), anomalies, and the
   data team's 6-month expected range — labelled "not a forecast", with a check of how often past
   months fell inside it.
6. **Export** of a CSV where every row carries its status, plus metadata.json.

## Team

Azamat Israilov (team owner · data and harmonization) · Abubakr Damonov (full-stack web app) ·
Ibrohim Yormahmadov · Muhammadjon Ashurzoda · Sumaiyo Isroilova.

## Architecture

```
NASA FIRMS (MODIS, VIIRS)  →  data team: harmonization, H3 grid, FastAPI (Docker)
                           →  pnpm snapshot / snapshot:geo  →  data/snapshot, public/geo
                           →  Next.js 16 route handlers (Zod-validated)  →  UI (React 19)
```

- Without `FIRE_API_URL` the app serves the bundled snapshot (what runs on Vercel).
- With `FIRE_API_URL=http://localhost:8000` it reads the live data service (custom areas too).
- Domain logic (statuses, baselines, statistics) is pure TypeScript in `lib/domain`, tested.

## Run it locally

Requirements: Node 24, pnpm 12, Docker Desktop.

```bash
pnpm install
pnpm dev                                   # http://localhost:3000, bundled real snapshot

# live data service (the data team's API) + Mailpit
echo "FIRE_API_DIR=D:/path/to/fire-calendar-api" > .env
docker compose up -d --build
FIRE_API_URL=http://localhost:8000 pnpm dev

# refresh the bundled data from the service
FIRE_API_URL=http://localhost:8000 pnpm snapshot
pnpm snapshot:geo D:/path/to/fire-calendar-api/data/serving
```

Quality gates: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), `pnpm test:e2e` (Playwright,
desktop + 390 px mobile). Decisions are recorded in [docs/adr](docs/adr).

## Data and credits

- NASA FIRMS — MODIS and VIIRS active fire products. We acknowledge the use of data and imagery
  from NASA's Fire Information for Resource Management System (FIRMS), part of NASA's Earth
  Science Data and Information System (ESDIS).
- Base map: Esri World Imagery and World Boundaries and Places. Relief: AWS Terrain Tiles
  (Mapzen Terrarium). Country names: Unicode CLDR. Hexagon grid: Uber H3.
- Libraries: Next.js, React, MapLibre GL JS, Apache ECharts, Zod, TanStack Query, Tailwind CSS.
- Code was written with the help of an AI coding assistant; every change was
  reviewed and covered by automated tests by the team.
