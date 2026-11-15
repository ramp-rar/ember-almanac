# 0001. Server-side aggregation on Postgres + CDN cache, not browser-only Parquet
Date: 2026-11-15 · Status: accepted

## Context
Earlier drafts proposed a static app (Parquet + DuckDB-Wasm in the browser). Requirements now: a real backend,
shareable AOI links, CSV export of detections, "no lag" on weak laptops and phones, and deployment on Vercel.
Calendar payload is tiny (324 cells); the heavy part is summing many H3 cells per (year, month).

## Options
1. Browser-only: Parquet on CDN + DuckDB-Wasm. Pros: no server cost. Cons: ~MBs of WASM + data on first load,
   slow on mobile, no persistent AOI links, export limited by browser memory.
2. Postgres aggregates + Next.js route handlers on Vercel Functions + CDN caching. Pros: ~30 KB responses,
   fast on any device, persistent AOIs, streaming export, real backend. Cons: DB to operate; cold starts.
3. FastAPI + PostGIS on a separate host. Pros: GIS power. Cons: second deploy target, CORS, not needed —
   H3 cell lists replace polygon-in-polygon queries.

## Decision
Option 2. Polygons are converted to H3 cells (client worker for preview, server re-validates), DB does
`SUM … WHERE h3 = ANY($cells) GROUP BY year, month`. Countries are precomputed (`region_month`).
Responses are immutable per dataset_version → `s-maxage` at the Vercel CDN.

## Consequences
Need a data contract and an idempotent ingest. Must watch Neon storage (aggregates are small; detections stay in Blob).
Spike required for detections export (ADR 0002): DuckDB-node in a Vercel Function reading Blob Parquet vs
a Postgres `detection` table for the pilot region.
