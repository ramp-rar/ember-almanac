# ADR 0004 — Use the data team's Fire Calendar API as a data source

Status: accepted (owner decision, 2026-11-15) · Supersedes nothing; extends DATA_CONTRACT v1 with a second source.

## Context
The science/data team delivers a FastAPI service (`fire-calendar-api`, regions Kazakhstan and Texas) instead of the
Parquet delivery described in `docs/DATA_CONTRACT.md`. It serves monthly harmonized "cell-days" per region or
H3 res-5 hex set. It differs from the contract: grid res 3/5 (contract: 6), no `lo/hi` range, no raw per-sensor counts,
own norm (2001–2025, includes the target year), own 6-month forecast.

## Decision
- New `FireSource` implementation `server/repositories/remote-api.ts`, enabled by `FIRE_API_URL`
  (http/https only, no credentials). It wins over database and local fixtures when set.
- We take only the monthly `value`. Baselines, ratio, percentile, trend and statuses are **still computed by us**
  (baseline excludes the target year, ≥ 10 years, status from dates) — the API's `norm_*`/`ratio_to_norm` are ignored.
- Missing fields are `null`, never 0: `AoiMonthRow.harmLo/harmHi/rawModis/rawViirs` are nullable; with no raw counts
  the raw view is hidden (`dataset.hasRaw = false`), with no range it is not shown (`hasRange`).
- A custom area is sent as res-5 hexes (res 6 → parents, res 4 → children) to the region found by `/locate`.
  An area outside the covered regions is a 404 `no_coverage` — **not** an empty/zero calendar.
- Dataset meta is synthesized from the API: estimate until its first `observed` month, preliminary from its first
  `preliminary` month, `nrt_through` = `data_end`, baseline 2001–2025.
- Every response is validated with Zod; failures become 503 `unavailable`.

## Open questions for the data team
1. Estimate/observed boundary is 2012-02 but our status rule is year-based (`estimate_before_year` = 2012): January 2012 shows
   as `final` though the API calls it `estimate`.
2. `monthly()` zero-fills months missing from the hex table (`reindex(fill_value=0.0)`). Fine for Kazakhstan/Texas now (no
   zero months), but an AOI partly outside a region is silently counted as 0 there. Need explicit "no data".
3. AOI = hexes whose res-5 *center* lies inside; our res-6 → parent conversion differs slightly at borders.
4. Per-hex monthly values (for map hotspots) are not served; `/detections` has points but in detections, not cell-days.
5. Units: "cell-days of ~1 km cells, VIIRS S-NPP equivalent" (contract says NOAA-20). Confirm and align.

## Consequences
Real data without the contract's raw/range fields; the UI degrades honestly. The forecast endpoint is not used yet
(planned: show as a labelled historical range, never as certainty).
