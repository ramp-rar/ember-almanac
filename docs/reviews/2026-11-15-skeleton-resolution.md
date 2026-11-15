# Phase 1 skeleton — resolution of review findings (2026-11-15)

Reviews: [code](2026-11-15-skeleton-code-review.md) · [science](2026-11-15-skeleton-science-review.md).
Both first passes: CHANGES REQUESTED. Process note: the skeleton was built in one pass at the
owner's request ("whole product visible on mock data"), with one pair of reviews at the end
instead of one per feature.

## Fixed

| Finding | Fix | Evidence |
|---|---|---|
| Code B1 — unbounded AOI (25 s CPU, 1.3 GB) | area limit 10 M km², ≤ 90° box span, resolution chosen from the estimated cell count (r4 directly for large areas) | `tests/unit/aoi-limits.test.ts`, e2e "API status codes" |
| Code M1 — antimeridian silently wrong | boxes > 90° and circles crossing 180° refused with a readable message; map clicks wrapped | `aoi-limits.test.ts` |
| Code M2 — polar circle crash → 500/503 | circles reaching ±85° refused; `InvalidAreaError` → 400; unknown errors → 500, connection errors → 503 | `aoi-limits.test.ts`, e2e |
| Code m3/m4 — non-canonical ids; POST id rejected by GET | only canonical ids decode; POST validates the rounded id | `aoi-limits.test.ts` |
| Science M1 (interim) — explosive ratio shown loud | headline no longer coloured by the ratio; absolute numbers in the sentence ("225 vs usual 179 fire-days") | — |
| Science M2 — trend shown regardless of the test | neutral heading; verdict sentence from Mann–Kendall at 0.05; no trend below n = 10; dashed grey line when not significant; count of MODIS-only years; separate fit over final years | `tests/unit/trend.test.ts` |
| Science M3 — withheld year looked like zero | shaded full-height band for years without a total in both charts | — |
| Science M4 — CSV not self-describing | unit-named columns, `dataset_version`, baseline n/from/to/estimate years; `metadata.json` export (method, AOI, version, statuses, FIRMS acknowledgement) | `tests/unit/summary-csv.test.ts`, e2e |
| Minors | hard-coded 2012 in legend; estimate year bars no longer hatched as preliminary; median label in raw mode; stale chart click; empty region list; MultiPolygon regions in local mode; `app/error.tsx`; safe URL decoding | — |

## Not fixed

| Finding | Why | When |
|---|---|---|
| Science M1 (final) — minimum-median floor | needs Q5 from the science team | before F03 ships |
| Code M3 — Postgres-vs-local equality test, route tests with a stubbed source | needs a test Postgres in CI | F07 |
| Code m8 — CDN may serve the previous dataset for up to 25 h | cache keyed by version needs the version in the URL | before deploy |
| Code m9/m12 — keyboard focus drift, map load race | cosmetic | redesign |
