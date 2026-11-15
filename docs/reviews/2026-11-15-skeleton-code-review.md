# Code review: Phase 1 UI skeleton (feat/phase1-skeleton)

- Date: 2026-11-15
- Scope: `git diff 7570246 HEAD`: 90cc439 (domain), b059994 (API + FireSource), f7a597e (UI)
- Reviewer: independent reviewer subagent. I did not write this code and did not change any code.
- Checks: `pnpm test` (135) and `pnpm typecheck` were reported green. I did not run the build,
  e2e or a dev server. I ran h3-js 4.5.0 directly (from the project's node_modules) to measure the
  AOI edge cases below.
- Accepted as out of scope: no polygon drawing, ZIP pending ADR 0002, 203 KB first-load JS (owner
  decision), and the aoiId encoding the input instead of a stored AOI.

**Verdict: CHANGES REQUESTED.** There is 1 BLOCKER and 3 MAJOR findings.

---

## BLOCKER

### B1. AOI size is unbounded, so one public GET can use about 25 s of CPU and 1.3 GB of memory
- `lib/h3/aoi-id.ts:46-53` (bbox validation has no size limit), `lib/h3/aoi.ts:21-27`
  (`aoiCells` always runs `polygonToCells` at r6 first), `server/services/calendar-service.ts:46`,
  `app/api/aoi/route.ts:33`.
- **Failing scenario.** `GET /api/aoi/bb_-89_-80_89_80/calendar` passes `decodeAoi`. `aoiCells`
  then builds every r6 cell before it falls back to r4. I measured this outside the app:
  **6,886,320 r6 cells, 24.5 s, +1.3 GB RSS** for that one call. After that it builds about 140 k r4
  cells and sends them to Postgres as a single ~2.7 MB `string_to_array` parameter. The endpoint
  needs no login, and every distinct id misses the CDN cache: `bb_-89_-80_89_80.1`, or the
  non-canonical forms in m3. A few parallel requests will exhaust a Vercel Function's memory or time
  limit. The same work runs on `POST /api/aoi`. Smaller inputs are also over the SPEC budget: a
  60x60 degree box takes 2.6 s just to compute the cells (SPEC F01 allows 1.5 s for the whole
  response).
- **Fix.**
  1. Estimate the cell count before calling `polygonToCells`: bbox/circle area divided by
     `getHexagonAreaAvg(6, 'km2')`. If the estimate is above `MAX_FINE_CELLS`, go straight to r4.
  2. Add a hard limit in `validateAoi`, so the client and server reject the same inputs. Either cap
     the area (for example <= 5,000,000 km2, about 2,800 r4 cells) or cap the span (for example
     <= 60 degrees in longitude and latitude). Show a readable error such as "Area too large - pick
     a country instead".
  3. Add unit tests for the limit and for the "estimate goes straight to r4" path.

## MAJOR

### M1. AOIs that cross the antimeridian, or are wider than 180 degrees, silently get the wrong cells
- `lib/h3/aoi-id.ts:46-53` and `lib/h3/aoi-id.ts:90-100`, consumed by `lib/h3/aoi.ts:24`.
- h3-js v4 assumes that any polygon edge longer than 180 degrees of longitude crosses the
  antimeridian. The bbox ring has only 4 vertices, so every box wider than 180 degrees gets inverted.
  Measured:
  - `bb_-170_-10_170_10` (340 degrees wide) returns **3,497 r4 cells**. A 340x20 degree box should be
    about 21 k cells; 3,497 is about the 20-degree strip around the antimeridian.
    `bb_-179_-80_179_80` returns 1,696 r4 cells instead of about 250 k.
  - Circles near the antimeridian get longitudes above 180 from `aoiRing`, which does not wrap them,
    and lose cells. `pt_70_179.9_200` gives 1,555 cells against about 3,480 expected.
    `pt_0_180_50` gives 150 against about 218.
- **Why it matters.** The calendar header shows cellsCount/km2 and a full calendar for an area the
  user did not choose. Nothing flags the error. This breaks "Honest values only" (Fiji, Chukotka and
  the Aleutians are real fire areas).
- **Fix.**
  - In `validateAoi`, reject `east - west > 180`. Together with B1's span limit this is automatic.
  - Accept `west > east` as an explicit antimeridian-crossing box, or split it into two rings.
  - In `aoiRing`, either keep circle longitudes in [-180, 180] and split at the antimeridian, or build
    the circle with `gridDisk` around `latLngToCell` (geodesic, no wrap problems). Also wrap the map
    click (`components/map/aoi-map.tsx:58` should use `e.lngLat.wrap()`), otherwise a click on a
    world copy gives lon > 180, which the form rejects.
  - Add tests: `bb_-170_-10_170_10` is rejected (or correct), and the cell count for `pt_70_179.9_200`
    is within 15 % of pi*r^2/36.1.

### M2. Inputs that pass validation make h3 throw, and the API answers 500/503 instead of 400
- `app/api/aoi/route.ts:33` (`aoiCells` is outside any try), `server/http.ts:8-16`,
  `lib/h3/aoi-id.ts:92`.
- **Failing scenario.** `{kind:'point', lat:89, lon:0, radiusKm:200}` passes `validateAoi`. With the
  `cos` clamp at 0.01, the ring spans +-100 degrees of longitude with latitudes clamped to 90, so it
  degenerates. `polygonToCells` then throws `H3LibraryError code 1` (reproduced).
  - `POST /api/aoi` has no try/catch, so it returns an unhandled 500 with the default Next error body.
  - `GET /api/aoi/pt_89_0_200/calendar` reaches `handleError`, which maps every unknown error to
    `503 "temporarily unavailable. Please retry."`. That tells clients and monitoring that a permanent
    client error is transient.
  - The same 503 mapping hides programming errors and delivery-contract violations, such as a
    `RangeError` from `buildMonthSeries` or a `honest()` invariant.
- **Fix.**
  - Wrap `aoiCells` in POST.
  - Reject polar circles in `validateAoi` (for example `|lat| + radius/111 > 85`), or use the
    `gridDisk` construction from M1.
  - In `handleError`, return 503 only for real I/O failures (DB connection or fetch errors) and 500
    for everything else. Add a typed `InvalidAreaError` that maps to 400.

### M3. No tests cover the risky server branches
- `tests/unit/aoi.test.ts` covers only the happy round-trip and one r4 switch. Nothing tests:
  - the route handlers (400 vs 404 vs 503),
  - `postgresSource` (the bigint `= any(string_to_array(...))` path, ilike escaping of `%` `_` `\`),
  - `local-delivery` (load failure clears the cache, missing or MultiPolygon `regions.geojson`),
  - B1, M1, M2 and m3.
- Each of B1/M1/M2 would have been caught by a single unit test.
- **Fix.**
  - Add unit tests for `validateAoi`/`decodeAoi` edge cases (huge, antimeridian, pole, non-canonical).
  - Add a small route-handler test that calls `GET`/`POST` directly with a stubbed `getActiveSource`
    to check the status codes.
  - Add one integration test of `aoiMonthly` against the CI Postgres. Its result must equal
    `local-delivery` for the same cells; that equality is the property that makes the FireSource
    seam trustworthy.

## MINOR

- **m1 `server/repositories/local-delivery.ts:15-24, 94-106`. The local source accepts only
  Polygon; ingest accepts MultiPolygon.** `scripts/ingest.ts:42-46` accepts both. If a mock or sample
  delivery contains a MultiPolygon (most real countries with islands), `load()` rejects, so every
  request returns 503, AOI calendars included, which do not need regions at all. The same happens
  when `regions.geojson` is missing; DATA_CONTRACT section 4 says the file is optional. Other gaps:
  - r6 is hard-coded at line 98 instead of `meta.harmonization.h3_resolution`.
  - `Math.min(...lons)` overflows the call stack on rings with more than ~120 k vertices.
  - **Fix:** share the zod schema and the Polygon|MultiPolygon handling with ingest, compute the bbox
    with a loop, and treat a missing file as an empty region list.
- **m2 `server/repositories/local-delivery.ts:50-76, 128-138`. Cache and lifecycle.**
  - The DuckDB instance is never closed, and `db.closeSync()` is not in `finally`, so a failed query
    leaks the connection.
  - The cache is keyed only by directory. Re-running `pnpm fixtures` into the same `mock-*` name
    serves stale data until restart, and old directories are never evicted.
  - **Fix:** use `try/finally` with `closeSync()` on both, key the cache by `dir + mtime(meta.json)`,
    and keep only the newest entry.
- **m3 `lib/h3/aoi-id.ts:65-76`. `decodeAoi` accepts non-canonical ids.** `Number()` accepts `1e1`,
  `0x10`, `+5`, `050`, and surrounding whitespace, CR/LF included. Effects:
  - Unlimited aliases of one AOI bypass the CDN cache, which amplifies B1.
  - `GET /api/export/summary?aoi=a:pt_%0A43_77_50` decodes to an id containing a newline. That puts
    the newline in the Content-Disposition header (`app/api/export/summary/route.ts:18`), so
    `new Response` throws and the client gets 503.
  - The export route also lacks the 80-character length guard used in the calendar route.
  - **Fix:** in `decodeAoi`, return the input only when `encodeAoi(input) === id` and it validates.
- **m4 `app/api/aoi/route.ts:30-36`. POST can return an id that GET rejects.** POST validates the raw
  input but encodes a rounded one. bbox west 10.0001 / east 10.0004 is valid, but it encodes to
  `bb_10_..._10_...`, and the calendar route rejects that with 400. `cellsCount` is also computed on
  the unrounded input. **Fix:** normalise first (`decodeAoi(encodeAoi(input))`), return 400 if it is
  null, and compute the cells on the normalised input.
- **m5 `server/repositories/fire-source.ts:82, 96`. The SQL is safe, but the cell list is passed as
  one huge CSV string.** The csv is a bound parameter, so there is no injection. But 50 k cells is
  about 1 MB of text parsed by `string_to_array` and then cast. **Fix:** bind a typed bigint array
  parameter, or use `unnest` joined to the table for large sets. Also move `h3ToDb` (line 34,
  duplicated in `scripts/ingest.ts:67`) into `lib/h3`, so ingest and query cannot drift. The ilike
  escaping on line 41 is correct: backslash is the default LIKE escape in Postgres, and the value is
  bound.
- **m6 `server/repositories/fire-source.ts:58-62`.** `region()` runs `count(*)` over `region_cell` on
  every request (about 470 k rows for Russia at r6), adding a third serial round-trip on Neon HTTP.
  **Fix:** store `cells_count` on `region` at ingest time.
- **m7 `server/services/calendar-service.ts:31-37` vs `lib/api/types.ts:16`. The ring contract and
  the code disagree.** The type says regions from the DB have `ring: null`. The service always sends
  the bbox rectangle, and the map draws it as if it were the country outline. For countries crossing
  the antimeridian (RUS, USA, FJI), bbox is about [-180, .., 180, ..], so the map fits and outlines
  the whole world. **Fix:** send `ring: null` for regions until real outlines come from Blob, and
  only call fitBounds in that case. Store an antimeridian-aware bbox at ingest (west > east).
- **m8 `server/http.ts:20`. CALENDAR_CACHE keeps stale data too long.** `s-maxage=3600,
  stale-while-revalidate=86400` means that after a dataset activation, the CDN can serve the
  previous version's calendar (statuses, `today`) for up to 25 h, while summary.csv (no-store)
  already shows the new version. **Fix:** include the dataset version in the URL or cache key, or
  shorten SWR to <= 1 h.
- **m9 `components/calendar/burning-calendar.tsx:177, 273-302`. Keyboard and focus state drift.**
  - `active` is initialised from `selected` once and never re-synced. After a selection changes from
    outside (chart bar click, URL edit), arrow keys move from the old cell and
    `aria-activedescendant` points at it.
  - When a mouse click focuses the svg, `onFocus` moves the overlay to the old `active` cell. The
    click then sets the new one but never calls `moveOverlay`, and the next pointermove returns early
    because `hover` already equals that cell. Result: the focus ring sits on a different cell from
    the one just clicked.
  - `onPointerLeave` while focused leaves the overlay on the last hovered cell, not on `active`.
  - **Fix:**
    - Re-sync `active` when `selected` changes.
    - Call `moveOverlay(c)` in `onClick`.
    - In `onPointerLeave`, move the overlay to `active` when focused.
- **m10 `components/calendar/burning-calendar.tsx:265-270`. Grid ARIA.** `role="grid"` owns non-row
  children (text, era rail, totals, medians). Year and month labels are not rowheader/columnheader,
  and the pinned cell has no `aria-selected`. **Fix:** set `aria-hidden` on the decorative groups,
  add `role="rowheader"` to the year label inside each row, and set `aria-selected` on the selected
  gridcell.
- **m11 `components/charts/yearly-charts.tsx:52-59`. Stale click handler.** `onClick` is not in deps
  (`[series, selectedYear]`), so `onSelectYear` captures an old `selected.m`. Pick Nov 2020, then
  Mar 2020 (same year, deps unchanged), then click the 2015 bar: the URL becomes `y=2015&m=11`, not
  3. **Fix:** keep `onClick` in a ref updated every render and register the ECharts listener once.
- **m12 `components/map/aoi-map.tsx:42-55, 69-78`. Map load race.** If `isStyleLoaded()` is already
  true before `load` fires, `apply()` finds no `aoi` source and skips it. The `load` handler then
  adds the source with the first-render `aoi` closure, so the outline can show the previous AOI.
  Several AOI changes before load also stack several `once('load')` handlers. **Fix:** keep the
  latest aoi in a ref, add the source in `load` from that ref, and in the AOI effect check
  `getSource('aoi')` rather than `isStyleLoaded()`.
- **m13 `components/explorer/explorer.tsx:58-61, 111`. Home page with no regions.** If
  `/api/regions` returns an empty list (a delivery without regions.geojson, see m1), the home page
  shows the pulsing skeleton forever. **Fix:** handle an empty list with an empty state that offers
  the Coordinates form.
- **m14 `components/aoi/aoi-picker.tsx:14`. Non-JSON error bodies.** `getJson` parses the body
  without a catch. A platform 504 with an HTML body shows a raw JSON parse error to the user. Use
  the same tolerant parse as `fetchJson` in `components/explorer/explorer.tsx:43`. Also debounce the
  region search (one request per keystroke today).
- **m15 `app/a/[aoiId]/page.tsx:14`.** `decodeURIComponent` on an already-decoded param throws
  URIError on a stray percent sign. There is no `app/error.tsx`, so any render-time throw shows the
  framework error page (for example a `honest()` invariant in
  `components/metric/headline.tsx:13-14`). **Fix:** use a safe decode, and add `app/error.tsx` with
  the Retry and AoiPicker UI.
- **m16 `lib/h3/aoi.ts:1`.** Nothing enforces "server only". Today h3-js is imported only from
  `server/**`, `app/api/**` and `lib/h3/aoi.ts`, and client code correctly uses `lib/h3/aoi-id.ts`;
  I verified this with grep. But one wrong import would silently add h3-js to the client bundle.
  **Fix:** add the `server-only` import to `lib/h3/aoi.ts`, or an ESLint `no-restricted-imports`
  rule for `components/**`.

## NIT
- `lib/domain/calendar.ts:199`: the ratio `r.v` is not rounded, and neither are `anomaly`/`slope`
  in the series. This inflates the JSON payload; round like `md`.
- `server/repositories/fire-source.ts:41-47`: the DB returns at most 20 rows, the local source has no
  limit. Make both FireSource implementations follow the same contract.

## What is right (no action)
- The FireSource seam is narrow and correct for swapping in real data: the calendar contract carries
  status, coverage, n and baseline years for every number, and no_data stays null through the
  calendar, CSV and tooltip.
- The SQL is fully parameterised. The bigint conversion matches ingest, and the cell_month PK
  (version_id, h3, year, month) supports the version + `h3 = any(...)` lookup.
- CellsLayer memoisation holds: all props are referentially stable per response, and hover only
  moves the overlay through the ref.
- ECharts instances are disposed and their ResizeObservers disconnected. The MapLibre map is removed
  on unmount.
