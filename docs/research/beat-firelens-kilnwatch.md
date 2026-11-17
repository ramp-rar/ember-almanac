# How Ember Almanac beats FireLens and kiln-watch

Date: 2026-11-17. Method: read-only. `curl` on HTML, JS/CSS bundles, public JSON endpoints and headers of all three sites;
bundle string/identifier greps; no browser session. Anything I could not see is marked **(not verified)**.
Extends sections 7 and 8 of `docs/research/competitors.md` (read 2026-11-15); numbers below were re-measured today.

## Summary (5 lines)

1. Our edge is real and unique: 2000–2026, 159 countries clipped to real borders, a five-state status on every cell, "xN vs median of N years" with the target year excluded and n >= 10, three languages (en/ru/tg), CDN-cached calendar, and the only calendar with a checked 6-month range (34 of 34 past months inside the 95% band).
2. Our weak spots are visible to a judge in the first minute: the calendar is not in the server HTML (a skeleton, 243 KB of JS first), no methodology page (`/methodology` is 404), no raw-vs-harmonized "seam" view (snapshot has `hasRaw:false`), no polygon drawing and no admin-1 areas, no OG/share card, map shows only the last 12 months.
3. FireLens wins on breadth of tools (weekly calendar, anomalies, email alerts, PNG/CSV/JSON/print, live global layer) but its "country" is a bounding box (`clipped_to_geometry:false`), has no `estimate` state, no URL state, no i18n, no methodology page and ~415 KB of brotli JS before the map.
4. kiln-watch wins on evidence and reach (95% intervals, backtests, place check, news corroboration, API, MCP) but covers only 9 preset areas, ships 3D/AI/alerts we forbid, serves hashed assets with `max-age=0`, and has no five-state status or `future`/`no_data` state.
5. Plan below: 15 tasks; the top 5 are the 2012 seam view, a real methodology page with the team's held-out numbers, server-rendered calendar + share cards, polygon/admin-1 areas on the live data API, and a month scrubber for the map.

## 0. What was measured and what was not

| Item | Verified how |
|---|---|
| Ember Almanac | HTML of `/`, `/r/TAJIKISTAN`, `/account`; `/api/regions?q=`, `/api/regions/TAJIKISTAN/calendar`, `/geo/tajikistan/index.json`, `/geo/tajikistan/2026-10.json`, `/api/export/summary?aoi=r:TAJIKISTAN`, `/api/meta`; the 13 `<script>` chunks in the HTML; repo code (`components/`, `lib/`, `app/`). |
| FireLens | `index.html`, `index-BWgWv8GA.js` (237 KB raw), maplibre and react chunks, CSS; R2 `index.json` (234 areas, `through 2026-11-15`), Tajikistan report (312 KB raw), Cloud Run `/fires/global?days=1`; bundle strings. |
| kiln-watch | `index.html`, main bundle `index-BaRWSiPQ.js`, lazy chunks Home/Map/PlaceRisk/Warning/SatelliteFigure/maplibre, `/api/{health,regions,warnings,outlook,export/options}`, `/api/regions/n-california/{warning,export.csv}`, `/data/regions/n-california/monthly.json`. |
| Not verified (all three) | Rendered screens, motion, mobile layout at 400 px, real keyboard/screen-reader behaviour, axe/Lighthouse scores, repo licences. Single machine, 1–3 samples per URL, so latencies are indicative only (cold starts vary: FireLens `/fires/global` took 20.3 s on the first call, 1.1–1.2 s afterwards). Our own lazy chunks (MapLibre, ECharts) are not listed in the HTML, so I did not measure them; ADR 0003 says they stay outside the 210 KB budget. |

## 1. Feature-by-feature

Legend for gap: **WIN** we are ahead, **TIE**, **GAP** a competitor is ahead, **NEW** neither does it.

| Area | FireLens (https://firelens.tech) | kiln-watch (https://kiln-watch-seven.vercel.app) | Ember Almanac today | Gap |
|---|---|---|---|---|
| Calendar | Weekly: 27 years x ~52 weeks per report (`modis_raw, viirs_raw, harmonized_count, total_frp, status, z_score, percentile, quality`) plus a 314-row `monthly` list; statuses `NO_DATA/LOW/NORMAL/HIGH/EXTREME` are anomaly classes, with `provisional` flag; **no `estimate` state**; future weeks are `NO_DATA`, not `future`. | Month and ISO-week x year grid; `role:"grid"`, arrow keys + Enter (bundle strings); colour = period vs same-period median; recency-weighted variant; period flags `partial/provisional`; `viirs_scale_modelled` column marks the pre-2012 part. No `no_data` hatch or `future` found. | Month x year (2000–2026, 324 cells), SVG with `role=grid`, `aria-activedescendant`, per-cell `aria-label`, hatch for estimate/no_data, three colour modes, legend, row totals and column medians, five statuses (`final/estimate/preliminary/no_data/future`). Calendar payload has `cov` (days observed / days in month). | WIN on status model and range; GAP: no weekly mode. |
| Headline metric | "vs median, same dates" tile, rank among years, YTD vs baseline, last 2 weeks; templates say "mean" in one string (which one is shown: not verified). Baseline 2003–2025. | `ratio_to_median`, `percentile`, `rank`, `of_years` in the export; baseline includes the target period (`of_years 26` for 2000–2025 rows) and is recency-weighted in one mode. | "xN vs median of N same months (2001–2025), preliminary", target year excluded, n >= 10, median 0 rule, percentile (`r: {k:'ratio', v, n, by, ne, p, md}` in every cell). | WIN (strictest, plain-language, status inline). |
| Map: how fires are drawn | MapLibre, ArcGIS World Imagery + labels raster tiles. Global layer = server-aggregated 0.5 degree cells (`/fires/global`, 33.9k detections in a 52 KB JSON). Layers (bundle): `heatmap` + `circle` crossfade by zoom, `fill` AOI/country layers; raw detections for a bbox via POST `/fires/live`. No clustering, no vector tiles. | MapLibre, OpenFreeMap dark/positron basemap, NASA GIBS WMS by date; heatmap + circle layers (7/6 hits); popups "Nth percentile of the same days"; globe projection switch (`setProjection`); table row flies to a cell. No hillshade/raster-dem/clustering in the map chunks. "Coordinates are pixel centres". | MapLibre 6, Esri World Imagery + World Boundaries, **3D relief** (AWS Terrarium raster-dem, switched on after first draw), heatmap layer fading out at z3–4.5, points per month/typical year from `public/geo/<id>/` (e.g. Tajikistan: 14 points in 2026-10, 304 B). H3 res-5 cells (~250 km2) as data unit. | WIN on terrain; TIE otherwise; GAP: only last 12 months + a typical year, no live "today" layer, no per-day detections. |
| Imagery / layers | Esri imagery. No GIBS. | GIBS (BlueMarble WMS in a figure + date-based tiles per strings). | Esri imagery only. No NASA GIBS true-colour per date. | GAP (GIBS is a cheap, on-theme add). |
| Terrain / 3D | None found (0 `terrain/hillshade/raster-dem` hits). | Three.js "anatomy" scene on Home (800 KB chunk in 2026-11-15 notes; today the Home chunk is 234 KB br); no 3D terrain map. | Relief on the map. No globe (forbidden by rules). | WIN |
| Time navigation | No timeline, slider or animation strings (0 hits for `slider/timeline/animation/playback`). Pick a week in the calendar; archive grid = one year per call. | Date-driven GIBS tiles; 12-week bar chart; no animation verified (not verified). | Select a cell (y, m in URL via nuqs); map follows the selected month for the last 12 months only. No scrubber, no play. | NEW opportunity (nobody animates the 25-year record). |
| Area selection | Search (Nominatim) -> bbox; 234 prebuilt reports (230 countries as **bboxes**, `clipped_to_geometry:false`, Tajikistan 67.5–74.25E, 37–41N includes neighbours); GPS; draw (bundle has `polygon` strings; behaviour not verified). No admin-1. | 9 preset areas; any box up to 4 x 4 degrees as a background build ("plan on 5 to 10 minutes"); place search via Nominatim; geolocation in PlaceRisk. | 159 countries clipped to real borders + Texas, point + radius (live API only), bounding box (live API only), click map for a point. UI says "Polygon drawing is not built yet". No admin-1, no city search. On Vercel (snapshot) custom areas return 405 (`/api/aoi`). | WIN on borders; GAP on polygons, admin-1 and cities. |
| Anomalies / alerts | 4 anomaly rows for Tajikistan with severity and text ("6.7x the 2003–2025 mean (z = 5.6, above the 100th percentile)"); types `EXTREME_FIRE_SURGE`, `EARLY_ONSET`; "Fire alerts by email" (subscribe + consent tick box). Whether alerts actually send: not verified. | `quiet/normal/watch/insufficient` per region, percentile of the month-so-far vs same days, 12-week chart, world outlook list, backtest per alert (`pod, far, pss, n`), email subscription but live `/api/health` says `email:false` (verified today). | Ratio + percentile per cell and an anomaly series in the yearly chart (`anomaly` per year); status words per month. No alerts. | GAP on alerts (but alerts are not in our rules: keep out of scope). |
| Forecasts / outlook | "Early-warning outlook": analog years, expected/low/high per week for 7 weeks, `risk_level: ELEVATED`, `prob_exceed_p90: 40` for Tajikistan; any held-out check: not found in the bundle (not verified). | `next_4_weeks_median`, cell-group outlook with `usual_next_30`; copy says "an outlook, not a forecast". | 6-month expected range (data team) with mean/80%/95% bands and a check: **34 months scored, 30 inside 80%, 34 inside 95%** (`forecastCheck`), labelled "not a forecast". | WIN (only one that publishes coverage with n in plain words). |
| Exports / API | Buttons (bundle strings): Hotspots CSV, Daily table CSV, Same-dates-by-year CSV, Full AOI report JSON, Daily chart PNG, Hotspot map PNG, print "Area report". Public Cloud Run API `/api/v1/*` (undocumented, POST-heavy). | CSV/TSV/JSON, month or week, column groups, `#` provenance block (unit, source, code version), `ci95_lo/hi`, `ratio_to_median`; `/api/export/options` self-describes; no key. Large API surface (cases, evidence, exposure, kilns, agent, MCP claimed). | `summary.csv` (status per row, `harm_lo/hi`, `ratio_to_median`, `baseline_n/from/to`, `dataset_version`) and `metadata.json`; `Cache-Control: no-store`; no `#` header, no JSON/TSV, no PNG/share, no OpenAPI. | GAP on breadth and docs. |
| Languages | English only found (no locale tables; flagcdn images for 3 flags are for presets, not UI). | `en` + `bn`. | **en, ru, tg** (names of 159 countries in all three via CLDR), `lang` set, locale radiogroup. | WIN |
| Accessibility | 11 `aria-label`, 1 `role:"dialog"`, 4 `role:"status"`; CSS has 6 `prefers-color-scheme` and 3 `prefers-reduced-motion` rules. Keyboard: 2 `keydown` handlers. Untested. | 93 `aria-label`, `role:"grid"` x2, 6 reduced-motion rules, **0** `prefers-color-scheme` rules. Untested. | `role=grid` + `aria-activedescendant` + per-cell labels, skip link, theme radiogroup (Light/Dark/Auto), hatch patterns (colour never the only channel), CVD-safe palettes. No axe/Lighthouse report published; no "table view" alternative seen. | WIN (structure), unproven (no audit). |
| Mobile | Viewport meta present; behaviour not verified. | Viewport meta present; behaviour not verified. | Viewport meta; e2e at 390 px stated in README (not re-run by me). | TIE (unproven) |
| Onboarding / explanations | "Is it a real fire?" panel, source line, calibration table (strings). | Persona cards on Home, "what teams asked NASA", candid copy, `SatelliteFigure`. | "How it works" and "Glossary" sections (hash links `#how`, `#glossary` in the header, not separate URLs), plain-language answer sentence, status legend. | TIE / GAP (explainer is text only, no figure of the sensor change). |
| Methodology / validation page | **None found**: 0 hits for "methodology", "glossary". A calibration table with `alpha`, `k`, `calibration_years 2012–2019` is shown. | Yes: sensor-denial rehearsal, hold-out, 95%-interval coverage, Aqua drift caveats (strings; figures not verified). | `/methodology` is **404**; only the 6-month range check and the status copy. | **GAP** (kiln-watch is ahead). |
| Sharing | **No URL state** (no `searchParams`, `pushState`, `location.hash` in the bundle); `localStorage` x2. PNG exports and print. No OG tags (`noindex`). | `location.hash` x5, `history.replaceState` x3, "Copy a link to this exact view" (clipboard x8); `og:title/description/image` + `twitter:card` present. | URL state via nuqs (`y`, `m`, `mode`), path URLs `/r/<ISO3>`, `/a/<id>`. HTML is `noindex` and has **no `og:*`**, no share card. | TIE on links, GAP on previews. |
| First paint / SSR | Empty `<div id="root">`; CSR only. | Empty `<div id="root">`; CSR only. | Prerendered skeleton with real `<title>`, `lang`, header and `aria-busy` placeholders; **calendar not in the HTML**. | WIN (slightly), but the calendar is not server-rendered. |
| Fire "detail" | Daily chart per sensor, top intense cell-days, live today layer. | Daily chart by satellite, "what's behind it" panel, news/EONET cases. | Month detail only (hotspot points per month). | GAP |
| Data scope | 230 countries + Global/Amazon/California/SE Australia, 2000–2026, through 2026-11-15. | 9 areas, 2000–2026, through 2026-11-14. | 159 countries + Texas, 2000–2026, standard processing to 2026-07-31, NRT to 2026-11-15 (snapshot `snapshot-2026-11-15`). | TIE on scope, WIN on clipping. |

### Evidence worth quoting
- FireLens Tajikistan report: `bbox {west 67.5, south 37.0, east 74.25, north 41.0}`, `clipped_to_geometry:false`, summary status `NORMAL`, `provisional:true`; its calendar uses weeks 44–52 of 2000 as data and the last weeks of 2026 as `NO_DATA` (no `future`).
- kiln-watch CSV row: `2000-11 ... 125 raw, hotspots_aqua_scale 232.5, ci95 98.3–366.7, ratio_to_median 1.565, percentile 84, rank 5, of_years 26`: interval and provenance are shipped, but `of_years 26` includes the target year and there is no per-row status.
- Ours: Tajikistan 2012-01 cell `{s:'final', cov:[31,31], h:7.1, r:{k:'ratio', v:0.6, n:24, by:[2001,2025], ne:11, p:21, md:11.7}}`; `lo/hi/rm/rv` are `null` because `dataset.hasRaw=false` and `hasRange=false` in the snapshot (not zero).

## 2. Performance (measured 2026-11-17, one machine in Europe, br unless stated)

| Metric | FireLens | kiln-watch | Ember Almanac |
|---|---|---|---|
| HTML TTFB (1st / best of 3) | 1.76 s | 1.60 s | `/r/TAJIKISTAN` 0.54 / 0.42 s (`X-Vercel-Cache: HIT`, prerendered; `/` 0.88 s, `/account` 1.23 s on first hit) |
| HTML size (br / raw) | 0.68 KB / 1.6 KB (empty root) | 0.96 KB / 1.8 KB (empty root) | 6.6 KB / 33.5 KB (skeleton + header + inlined runtime) |
| HTML `Cache-Control` | `public, max-age=0, must-revalidate` (Cloudflare `DYNAMIC`) | same (`X-Vercel-Cache: MISS`) | `public, max-age=0, must-revalidate` (Vercel `HIT`) |
| Render-blocking JS referenced from HTML (br / raw) | main 66.3 KB / 237 KB + maplibre 289.7 KB / 1.05 MB + react 46.2 KB / 141 KB = **402 KB br** (+12.7 KB CSS) | main 170.7 KB / 529 KB; Home route chunk 234 KB br (three.js) loaded on landing; CSS 18.4 KB br. Landing total about **405 KB br** (+ maplibre 291 KB on map views) | 13 scripts: **242.7 KB br / 750 KB raw**, +8.5 KB CSS. Largest chunk 73.3 KB br. MapLibre/ECharts lazy (not measured). |
| Biggest single asset | `maplibre-*.js` 290 KB br / 1.05 MB raw | `Home-*.js` 234 KB br; `maplibre-gl-*.js` 291 KB br | `3w3wm5fwx56gv.js` 73.3 KB br |
| Asset caching | `max-age=31536000, immutable` (CF `HIT`) | **`max-age=0, must-revalidate`** on hashed bundles | `max-age=31536000, immutable` |
| Calendar data | per-area report on R2: 26.7 KB gzip / 312 KB raw, TTFB 0.68–0.88 s, `public, max-age=3600, stale-while-revalidate=86400` (URL `?v=<through>`) | `/data/regions/n-california/monthly.json` 35.5 KB, TTFB 1.0 s, `max-age=0, must-revalidate`, `MISS` | `/api/regions/TAJIKISTAN/calendar` 5.9 KB br / 62 KB raw, TTFB 0.46–0.95 s, `s-maxage=3600, stale-while-revalidate=86400`, `X-Vercel-Cache: HIT` |
| Area list | `index.json` 19.7 KB, **not compressed**, `max-age=300` | `/api/regions` 1.4 KB, 0.66 s, `max-age=0` | `/api/regions?q=` 7.8 KB br / 23.8 KB raw, 1.12 s, `Cache-Control: public` only (no `s-maxage`, `MISS`) |
| Other API | `/fires/global` 52 KB, 20.3 s first call, 1.1–1.2 s after; no `Cache-Control` seen (Cloud Run) | `/api/outlook` 43.9 KB, 0.74 s TTFB; `/api/warnings` 1.1 KB 0.83 s; `/api/health` 3.26 s; export.csv 14.2 KB 0.69 s; all `max-age=0` | `/geo/tajikistan/index.json` 1.0 KB br, 0.82 s, `max-age=3600, s-maxage=86400, swr=604800`; month points 67–758 B; `/api/export/summary` 0.81 s, **`no-store`** |
| Backend / hosting | Cloudflare + Cloud Run (asia-south1) + R2 | Vercel + FastAPI on Azure Japan East (`kiln-watch-jp...`) | Vercel only (snapshot bundled; live data API optional) |

Reading: on raw first-load JS we are the lightest (243 KB vs about 400 KB), the only one with immutable assets and CDN-cached calendar JSON together, and the only one whose first load excludes MapLibre. Weak points to fix: `/api/regions` and `/api/export/*` have no shared-cache policy, and the calendar is not in the HTML.

## 3. Plan to win (15 tasks, ranked by impact on NASA judges)

Impact = how much it moves a judge's score on "does this solve the MODIS/VIIRS harmonization challenge, honestly, usably". Effort S < 1 day, M = 1–3 days, L = more than 3 days. "Live API" = needs `FIRE_API_URL` (the data team's FastAPI) or a fresh `pnpm snapshot`; "New data" = something the data team must deliver.

| # | Task | Impact | Effort | Needs |
|---|---|---|---|---|
| 1 | The 2012 seam view | Very high | M | New data (raw columns) or live API |
| 2 | Methodology and validation page | Very high | M | Team's held-out numbers |
| 3 | Server-rendered calendar + OG/share cards | High | M | none |
| 4 | Admin-1 areas and polygon drawing (real borders) | High | L | Live API; admin-1 geometry |
| 5 | Month scrubber (2000–2026) on the map | High | L | New data (per-month cells) |
| 6 | Cell click -> mini calendar | High | M | Live API or per-cell data |
| 7 | Uncertainty whiskers on cells | High | M | New data (`harm_lo/hi`) |
| 8 | Show-as-table + a11y report | Medium-high | S–M | none |
| 9 | "What was reported" links for unusual months | Medium | M | none (EONET) |
| 10 | Documented public API and richer export | Medium | M | none |
| 11 | Cache/headers hardening and a published perf report | Medium | S | none |
| 12 | "Sensor or reality?" explainer figure | Medium | M | Team's figures |
| 13 | Daily/weekly drill-down for the selected month | Medium | M | Live API |
| 14 | "Is fire near you?" place check | Medium | M | Live API |
| 15 | NASA GIBS true-colour layer on the map | Low-medium | S | none |

### 1. The 2012 seam view (raw vs harmonized)
- **Why it wins:** this is the challenge's question ("Did Earth burn more, or did our satellites get better?"). FireLens shows `modis_raw/viirs_raw` per week but never plots the jump; kiln-watch hides the seam on a separate page; neither has a one-click "show naive splice" on the home flow.
- **Build:** new `components/charts/seam-chart.tsx` (lazy ECharts, in the existing yearly-charts area): annual raw MODIS+VIIRS spliced line vs harmonized line, a vertical band at 2012-02 ("sensor change") and at the start/end of standard processing, one toggle "show raw". Data: `calendar.series.years[].total` exists; raw needs `rm/rv` per cell, which are `null` in the snapshot (`dataset.hasRaw:false`). Refresh the snapshot from the live API with raw columns (`pnpm snapshot`), extend the snapshot builder to persist `rawModis/rawViirs`, keep Zod `CalendarResponse.cells[].rm/rv` nullable. Caption computed from data: "raw detections step by x2.1 across Feb 2012 in this area; harmonized does not" with the numbers taken from the series, never hard-coded (the team's Texas x2.15 and Kazakhstan x1.98 are theirs, cite them as such).
- **Honesty check (PROJECT_RULES rules 2, 3, 6, "Do not invent numbers"):** every point carries status; before 2000-11 `no_data` is a gap, not zero; show "raw not delivered for this area" when `hasRaw` is false instead of hiding the toggle; the jump ratio is computed from the delivered series, with the 12 months either side stated.

### 2. Methodology and validation page (`/methodology`, also linked from the calendar footer)
- **Why it wins:** kiln-watch has one, FireLens none (0 hits), we have a 404. Judges look for "how do you know the harmonization is right".
- **Build:** `app/methodology/page.tsx` (static, i18n en/ru/tg). Sections: the sensors and dates (from `meta.json`/`dataset.coverage`: MODIS from 2000-11-01, VIIRS S-NPP from 2012-02-01), the five statuses with the exact rule for each, how the ratio is computed (median after AOI aggregation, target year excluded, n >= 10, median 0 rule), the team's validation (fit/test periods, annual error, rank correlation, month above/below norm hit rate: quote their README numbers with the file/version), our own range check (`forecastCheck` n, in80, in95 per country, computed at build time from `data/snapshot`), and a limits list ("detections are not fires or burned area", "1 km cell-days, VIIRS-equivalent unit", "estimate before 2012-02").
- **Needs:** the data team's validation figures as a delivered file (e.g. `validation.json`), otherwise show "validation not delivered" and link their repo. Do not compute our own accuracy percentages.
- **Honesty check:** numbers are cited as "the data team's" with dataset version; no "confidence %" of ours; the baseline difference to the team's README (their "norm" includes the target year, ours excludes it) is stated plainly.

### 3. Server-rendered calendar + OG/share cards
- **Why it wins:** today the HTML for `/r/TAJIKISTAN` is a skeleton with `aria-busy`, no calendar and no `og:*`, so link previews in chat and a no-JS/slow-network first look are blank (kiln-watch has OG tags; FireLens is `noindex`, no OG). Both competitors are CSR only.
- **Build:** in `app/r/[iso3]/page.tsx` read `data/snapshot` server-side (no fetch) and render the 324-cell grid as server HTML (cells as `<td>`/SVG `<rect>` with the status word in `aria-label`), hydrate the existing component on top; add `generateMetadata` with title "<Area>: xN vs median in <Month Year>, preliminary", description, `og:image` via `app/r/[iso3]/opengraph-image.tsx` (`next/og`, a 27 x 12 mini-calendar with hatch for `no_data/estimate` and the dataset version in the footer), `twitter:card`. Keep `noindex` only if the team wants it, otherwise remove (note FireLens and we both set `noindex`). Revalidate on dataset version.
- **Honesty check:** the share image draws `no_data` hatched and shows `status` text for the headline cell and "data through <date>"; no colour-only encoding; preliminary headline says "preliminary" in the image.

### 4. Admin-1 areas and polygon drawing on real borders
- **Why it wins:** FireLens countries are bounding boxes (Tajikistan's box contains neighbouring land); kiln-watch offers 9 presets and 5–10 minute builds; only mikuuloves (not in this task) has admin-1. A Tajik demo with Dushanbe, Sughd, Khatlon, GBAO, DRS as clipped areas, answering in seconds, is unmatched.
- **Build:** terra-draw polygon mode in `components/aoi/aoi-picker.tsx` (remove the "not built yet" text at `lib/i18n/messages.ts` `draw2`), `lib/h3/` worker polyfill of the polygon to H3 res-5 cells (h3-js already a dependency), `POST /api/aoi` (Zod) -> live API; admin-1 geometry bundled in `public/geo/admin1/<ISO3>.json` (check licence: geoBoundaries CC BY or GADM non-commercial; record in an ADR) and an `Admin-1` tab listing provinces with `area=r:TJK:TJ-DU` in the URL (nuqs). Cap area and cell count and show a status line "built from N cells, VIIRS-equivalent cell-days".
- **Needs:** live data API (custom areas are `405` on the Vercel snapshot build today); admin-1 pre-aggregation for the demo countries can be done by the data team to avoid the wait on Vercel.
- **Honesty check:** AOI with fewer than the baseline minimum (10 valid years) or too few cells says "insufficient: n=7" instead of a ratio; the polygon area and cell count are displayed; clipped areas must say how partial H3 cells are handled (count whole cells whose centre is inside, state it).

### 5. Month scrubber for the map (2000–2026)
- **Why it wins:** neither competitor has time navigation (0 timeline/slider/animation hits in FireLens; kiln-watch not verified); an animated record 2000–2026 on one scale is the visual proof of harmonization.
- **Build:** a slider + play button under the map (`components/map/time-scrub.tsx`); one feature per H3 res-5 cell carrying the 324 monthly values as a compact array (for Tajikistan the typical-year file is about 2.5 KB, so a full per-month history is tens of KB per country), colour by MapLibre `['at', idx, ['get','v']]` expression so a month change is a style update with no refetch (FireLens-style heat-to-point crossfade is not needed). `prefers-reduced-motion` disables autoplay; the calendar selection and the slider are one state (`y`, `m` in the URL).
- **Needs new data:** per-cell monthly series (the team's `cell_month`), delivered per country in a compact form (CSR/delta-coded like mikuuloves' `history.bin` but per country, tens of KB, not 14.7 MB). `public/geo` today holds 12 months + typical year only.
- **Honesty check:** months with status `estimate` get the hatch/outline style and the label "older satellite estimate"; `no_data` cells are not drawn as zero (no fill, grey pattern); a cell that is empty in a final month means "no detection", worded that way in the tooltip; static sources are labelled if the team flags them.

### 6. Click a map cell -> its own calendar
- **Build:** `GET /api/cell/<h3>` (Node route, Zod, `s-maxage` by dataset version) returning the same `CalendarResponse` shape for one hex; side panel reuses `BurningCalendar`. mikuuloves does per-10-degree JSON; we have H3 already.
- **Needs:** live API or per-cell monthly data (same file as task 5).
- **Honesty check:** a single cell has few detections; require the same n >= 10 baseline, otherwise show absolute values and "no usual activity" per rule 4.

### 7. Uncertainty whiskers
- **Build:** tooltip "x1.8 (1.4–2.3)" and a thin range mark in `components/calendar/burning-calendar.tsx` when `lo/hi` exist; CSV already has `harm_lo/hi`; JSON/OpenAPI list them. kiln-watch ships `ci95_lo/hi`; FireLens none.
- **Needs new data:** `harm_lo/harm_hi` from the team (snapshot: `hasRange:false`, `lo/hi: null`).
- **Honesty check:** when absent show "no interval delivered for this area", never a synthetic band.

### 8. "Show as table" and a published accessibility report
- **Build:** a toggle that swaps the SVG for a real `<table>` (rows = years, columns = months, each cell "ratio, status") using the same `cellLabelText`; run axe + Playwright keyboard tests (`tests/e2e/a11y.spec.ts`) and publish `docs/reviews/a11y-<date>.md` with measured results; add `prefers-reduced-motion` to any new animation. Competitors have counts of `aria-label` only, no evidence (kiln-watch 93, FireLens 11).
- **Honesty check:** the table must show the status word with every value; no value without status.

### 9. "What was reported" links for unusual months
- **Build:** server route `GET /api/events?bbox&month` calling NASA EONET (wildfire category) with `revalidate` 24 h; panel under the headline for months with ratio >= 2 or percentile >= 90: up to N links, enum `reported | none found`. kiln-watch does this with GDELT plus an LLM filter; we do links only, no model.
- **Honesty check:** copy says "reported events near this area and month", never "confirmed"; "none found" is not "no fire"; EONET coverage is incomplete outside news-heavy regions (state it).

### 10. Documented public API and richer export
- **Build:** `/api/openapi.json` generated from the existing Zod schemas (Zod 4 `z.toJSONSchema`), `/api` docs page; `summary.csv` gets an optional `#` provenance header (`?header=1`: unit, source, dataset version, SP/NRT dates, rule text for statuses), `?format=json`, `s-maxage` keyed by dataset version (today `no-store`). kiln-watch's `/api/export/options` is the model.
- **Honesty check:** headers include the unit ("harmonized cell-days, VIIRS S-NPP equivalent") and the line "detections are not fires"; status column stays per row.

### 11. Cache/header hardening and a published perf report
- **Build:** add `s-maxage=3600, stale-while-revalidate=86400` to `/api/regions` (today `Cache-Control: public` only, `MISS`) and `/api/meta`; `Cache-Control: public, s-maxage=3600` on export with the dataset version in the filename; record `curl -w` numbers in `docs/reviews/perf-<date>.md` against ADR 0003 (210 KB gzip) and add the measured first-load JS (242.7 KB br) to the README. Lighthouse mobile run on `/r/TAJIKISTAN`.
- **Honesty check:** stale responses show "data through <date>" from `meta.json`.

### 12. "Sensor or reality?" explainer figure
- **Build:** a section under the calendar (the existing `#how` anchor) with one figure: MODIS 1 km vs VIIRS 375 m footprint over one real area and the overpass times; reuse the data team's figures (their `guide_*` images, currently Russian-only) with captions in en/ru/tg. FireLens has an "Is it a real fire?" text panel; kiln-watch has a `SatelliteFigure` chunk (not inspected).
- **Needs:** the team's figures and permission/licence (their repo has none).
- **Honesty check:** cite figure source and dataset version; no invented overpass numbers.

### 13. Daily/weekly drill-down for the selected month
- **Build:** bar chart per day (stacked by sensor) for the selected month under the map, from `/api/aoi/<id>/hotspots` (exists as a route; needs the live API). FireLens and kiln-watch both have daily charts. Weekly calendar mode only if the team confirms small-area noise is handled (FireLens's own Tajikistan current week is `0.0` vs baseline `2.9`).
- **Honesty check:** days without delivery are `no_data` (hatched), not zero; preliminary days labelled.

### 14. "Is fire near you?" place check
- **Build:** geolocation or place name (server-side geocoding to avoid third-party calls from the browser) -> a point + radius AOI; shows detections in the last 7 days within 5–25 km and the usual activity for this month with status; URL `/near?lat=&lon=&r=`. kiln-watch and BurnCal have versions.
- **Needs:** live API for NRT detections.
- **Honesty check:** "detections, not fires; none seen is not none occurred"; show last overpass time and `preliminary`.

### 15. NASA GIBS true-colour layer
- **Build:** raster source from `gibs.earthdata.nasa.gov` WMTS (MODIS Terra CorrectedReflectance, `TIME=<selected day>`) as an optional layer next to the Esri imagery, with NASA credit. kiln-watch already does this.
- **Honesty check:** date shown; imagery is "for context, not used in the numbers".

## 4. Things to avoid (they would lose points)
- Do not add alerts, AI chat, a 3D globe or predictions (rules; kiln-watch ships all of them, and its own copy calls its backtest "generous").
- Do not call FIRMS or third-party geocoders from the browser (BurnCal hard-codes a key; FireLens and kiln-watch call Nominatim from the client).
- Do not put a big history blob on the critical path (mikuuloves: 14.7 MB gzip).
- Do not claim "better honesty" on copy alone: both competitors write careful caveats. Our verifiable differences are the per-value status, the stricter baseline and the real borders.

## 5. Honest list of things we got wrong or lack (so judges do not find them first)
- Calendar not in the server HTML; no `og:*`; `noindex`; `/methodology` 404; no OpenAPI; `/api/regions` and exports not shared-cacheable.
- Snapshot has no raw counts and no intervals (`hasRaw:false`, `hasRange:false`); the "seam" and "uncertainty" tasks depend on the data team.
- Custom areas (point, box, polygon) only work with the live data API; on Vercel (`snapshot`) `/api/aoi` returned `405` today.
- Map history is limited to 12 months plus a typical year.

## Appendix: reproduce
`curl -s --compressed -w "%{time_starttransfer} %{time_total} %{size_download}\n" -o /dev/null <url>` for TTFB/total/size (add `-H "Accept-Encoding: br"` for brotli, omit for raw); `curl -sI` for headers.
Bundles: FireLens `/assets/{index-BWgWv8GA,maplibre-CveZqPjz,react-CiXg_QnS}.js`, CSS `index-DlZgqQLO.css`; R2 `https://pub-0c8f8afcb5ca41119ca93ba2cc66c242.r2.dev/{index.json,reports/tajikistan.json?v=2026-11-15}`; Cloud Run `https://firelens-api-578816839215.asia-south1.run.app/api/v1/fires/global?days=1`.
kiln-watch `/assets/{index-BaRWSiPQ,Home-C8oAiYwq,Map-Bbrc6wXr,PlaceRisk-Bj9FbdQB,Warning-ca3UxJaf,maplibre-gl-C-Ekdwb3}.js`, CSS `index-DeGqyNF3.css`.
