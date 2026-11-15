# Competitor research — FIRE TRACE

Date of research: 2026-11-15. Method: HTTP fetch of HTML, JS bundle and public JSON endpoints (read-only).

## 0. What could and could not be verified

| Source | Result | Basis |
|---|---|---|
| firescope-seven.vercel.app | Verified in depth | Vite/React SPA. Fetched the 1.6 MB JS bundle, the CSS and the live `/api/v1/{meta,regions,calibration,calendar}` JSON. Not seen: a rendered screenshot, so layout and visual design are inferred from strings and CSS only. |
| offnadir-delta.com/active-fire-map | Verified (page text) | Fetched. Map itself is an embedded viewer; its internals were not inspected. |
| offnadir-delta.com/watchfloor | Partly | HTML shell and meta description only. The page is client-rendered, so events and UI were not visible. Nothing beyond the description is claimed. |
| globalnaturewatch.org | Partly | Landing page only (rebrand from Global Forest Watch, "Horizon" product, "Browse applications", newsletter). No fire-tool details were fetched. |
| EFFIS, GWIS | Landing page nav only | Menu items and one disclaimer sentence. No tool testing. |
| NASA Worldview | Not analysed | Returned a JS shell (4 KB). Only general knowledge (not verified here) applies. |
| zoom.earth | Landing page UI strings only | Settings, measure tools, subscription, time controls. Fire layer not verified. |
| sci-vega.ru | Fetched, text garbled (legacy encoding), looks like a Russian science news/announcement portal. Not a fire tool as far as seen. Excluded from the comparison. |
| Data team repo Azamat-Israilov/NASA-Space-Vulans-Watch | Verified | GitHub API tree plus raw README. |

Anything not in this table was not checked. The "weaknesses" below are only those evidenced in what was fetched.

## 1. FireScope (the direct competitor)

Title "FireScope · Global Fire Intelligence", meta: "harmonized MODIS and VIIRS global fire intelligence". Same challenge as ours.

### 1.1 What it is (from the bundle and API)
- Stack: Vite + React SPA, MapLibre GL 6.x, a chart library (unidentified, SVG/canvas), React Query-like client. API `/api/v1/*` proxied through Vercel to a Railway backend (headers `X-Railway-Edge`, `X-Vercel-Id`).
- Endpoints seen in the client: `meta, regions, regions/{code}, calendar, timeseries, seasonal, anomalies, hotspots, sensor-comparison, calibration, map/cells, map/observations`, and exports `observations.csv, harmonized.csv, calendar.csv, daily.csv, metadata.json`.
- Views, from UI strings: header filter bar (region + date window + confidence threshold), "Monthly activity across years, with coverage and anomalies" (a month-by-year calendar with per-month tooltip: raw MODIS/VIIRS counts, mean FRP, night share, observing sensors, coverage), "Trends and seasonal patterns against the historical baseline", "MODIS versus VIIRS, raw and harmonized", a Hotspots/day-by-day view (daily detections per sensor, confidence and night-share, top intense cell-days ranked by summed FRP), a map (point detections, FRP-weighted density heatmap, harmonized activity per hex/cell with colour modes volume/intensity/night share, bounding-box/polygon drawing, daily GIBS MODIS true-colour layer, light/dark basemap via OpenFreeMap, a terrain/3D toggle via AWS terrarium), a "Methodology" page ("This page is the honest part of the product"), a CSV/JSON export area ("Download data with its provenance attached"), a language setting (code includes `ru`) and persisted preferences in localStorage.
- Calibration: VIIRS to MODIS-equivalent scale. Isotonic regression for counts, ratio model for FRP, trained 2013–2020, tested 2021–2024 (test r = 0.69, R^2 = 0.48, MAE 1.44 on n = 186,579). Candidate models and losing models are shown deliberately.

### 1.2 What it does well (be honest about this)
- Strong honesty copy: "not a count of fires", "counts never summed", coverage caveat ("a quiet month and an unobserved month cannot be distinguished"), anomaly classification refused when coverage is sparse, gaps not interpolated, SP vs NRT explained, median + MAD instead of mean + SD, minimum 4 years for a baseline.
- Methodology page with held-out validation, within-month correlation (not pooled), all published.
- Exports with provenance (metadata.json), reasonably rich API.
- Daily/hotspot drill-down and a real map with drawing.

### 1.3 Weaknesses (evidenced)
| # | Weakness | Evidence |
|---|---|---|
| 1 | Not global and not 2000-2026. Only 10 hand-picked regions. | `/api/v1/meta`: first_date 2013-01-01, last_date 2024-12-31, 10 regions. Only Australia, Brazil, Kazakhstan, Ukraine have just `[2021]`; Indonesia 2019–2024; Greece, Mongolia, Portugal, Tajikistan, Turkey 2013–2024. The name/meta says "global". |
| 2 | No MODIS-only history before 2013, so the very thing the challenge is about (2000–2012 vs the VIIRS era) is absent. No data for 2025–2026 either, and today is Nov 2026. | Same. |
| 3 | The calibration is trained on 2013-2020 and tested on 2021-2024, but the test r^2 is 0.48. The "harmonized" value is accordingly noisy, and no uncertainty interval is attached to a calendar cell (only `harmonized_count` in the payload sample). | calibration/meta JSON; calendar cell fields have no lo/hi. |
| 4 | "Region" geometry is a convex hull of populated 0.1 deg grid cells, "NOT an administrative boundary" (their own note). Australia's area is 10.5M km^2 (larger than the country). Not usable for a real AOI. | `regions` notes. |
| 5 | Unit is "estimated MODIS-equivalent detections": abstract for non-experts, and the app itself warns it is not a fire count. No plain-language "ratio to usual" headline found in the strings (the baseline exists, as anomaly/MAD classification, but the bundle shows no "×1.8 vs median" statement). |
| 6 | API responses are `Cache-Control: public, max-age=0, must-revalidate`, i.e. no CDN caching; one calendar call for Greece took 0.58 s and 58 KB uncompressed-visible. Single origin on Railway behind Vercel rewrite. |
| 7 | Single 1.64 MB JS bundle (no route splitting visible: one `index-*.js`), client-side rendered only (the HTML is an empty `<div id="root">`, no SSR, no link preview, no content for crawlers, no `<noscript>`). |
| 8 | Data source note says calendar coverage is derived from detections only ("cannot be distinguished from a day not observed"): coverage columns are lower bounds. It is honest, but also means the app cannot show real satellite overpass coverage. |
| 9 | Status vocabulary is per-month coverage (`complete/partial/sparse`) plus an SP-only statement. No explicit per-cell status taxonomy for estimate / preliminary / future, because the data stops in 2024. |
| 10 | Only 11 `aria-label` strings in a 1.6 MB bundle and no `prefers-color-scheme` in the bundle (theme is chosen by toggle). Keyboard focus on calendar is claimed ("tab to it") but unverified. Treat accessibility as unproven. |
| 11 | One shared stylesheet of 112 KB; no per-region sharing URL was found in route strings (`path:` strings absent, routing likely state-based, so deep links are unproven). |

### 1.4 What our product has that FireScope lacks
Full 2000–2026 range, the 2012 sensor transition made visible, an explicit status per cell (`final/estimate/preliminary/no_data/future`), ratio to median of the same month as the headline, country/arbitrary-AOI selection, server-cached CDN calendar, SSR first paint, shareable URLs.

## 2. Other sites

| Site | Does best | Concrete weaknesses (evidence) | What a harmonized calendar offers that it lacks |
|---|---|---|---|
| Off-Nadir Delta, Active Fire Map | Free, no login, live FIRMS view; sensor choice VIIRS/MODIS; date stepping back to 2000; confidence colours red/orange/yellow; stated latency of ~3 h. | Internally inconsistent latency claims on the same page (~12 h vs ~3 h; MODIS "~2 days" vs same latency for both). Shows raw detections per day only: no multi-year context, no cross-sensor comparability, no counts or trend. Page is also a funnel to a paid/free-account workspace. | Whether this month is unusual vs. the same month over 25 years, and without the false 2012 step. |
| Off-Nadir Delta, Watchfloor | Event feed with reports, location precision and "could it be seen from orbit" labels (per its meta description, which is the only thing verified). | Not verified in the browser (client-rendered). It is a news/events product, not a historical fire archive. | Long-run fire baseline for the same place. |
| Global Nature Watch (ex Global Forest Watch) | Authority, large catalogue of forest layers, alerts, subscriptions, "Horizon". | Landing page only reviewed. Fire layer analysed? No. Visible: heavy marketing page, account-oriented ("My GNW"). | A fast, no-login answer to "is this month unusual" for any AOI. |
| EFFIS (EU) | Official, fire danger forecast, rapid damage assessment (burnt areas), national statistics portal, annual reports, data request form. | Own disclaimer: mapped fires may include intentionally set vegetation-management fires. Europe/neighbourhood scope. Navigation is a large menu-driven institutional site with several separate viewers ("Current Situation Viewer 2.0", "Current Statistics Portal", "Current Situation Viewer"). Data comes through a request form. | Same-month-vs-median ratio, sensor harmonization, one calendar page, worldwide. |
| GWIS (JRC) | Global counterpart; country profiles, burnt areas, emissions, fuel map; official. | Same menu-heavy institutional design; again its own disclaimer on intentional fires. Country profile is annual/seasonal summary rather than a year x month sensor-harmonized calendar. | Sensor-bias-free annual comparability and plain-language ratio. |
| NASA Worldview | Authoritative imagery and FIRMS layers, time slider. | JS shell only (not verified further). From general knowledge, it is a viewer for imagery, not a statistics tool. | Aggregate statistics per AOI. |
| Zoom Earth | Polished UX, time controls, measure tools, themes, 24 h loops. | Landing HTML shows weather/hurricane focus; fire layer not verified. Subscription model. | Historical depth and statistics. |
| sci-vega.ru | n/a | Could not decode; not a fire tool as far as seen. Excluded. | n/a |

## 3. The data team's repo (Azamat-Israilov/NASA-Space-Vulans-Watch)

| Aspect | Finding |
|---|---|
| Status | Created 2026-11-14, last push 2026-11-15. No licence. No GitHub description, no topics. Language: Jupyter Notebook. |
| Language of docs | README and docs are in Russian (judges are global; we must translate what we expose). |
| Scope delivered | Two regions only: Texas and Kazakhstan, 2000 to Nov 2026. 15 raw FIRMS files, 5.2 M detections. Tajikistan appears in EDA notebooks only. |
| Method | Local-day conversion, static-source (flare) mask, 1 x 1 km cell-days as the unit, H3 hexes (~250 km^2 and ~12,400 km^2), monthly counts per sensor day/night, day/night and fire-phase specific k-model trained on 2012–2019 and validated on years not seen, then 2020–2026 as a holdout. |
| Headline numbers (their README) | False 2012 jump x2.15 (Texas), x1.98 (Kazakhstan) removed. Annual error after harmonization 4–7% (TX) and 3–7% (KZ). Rank correlation 0.80 / 0.99. Month above/below norm correct 85% / 96%. |
| Series statuses (their table) | Nov 2000 – Jun 2002 Terra only, estimate; Jul 2002 – Jan 2012 MODIS rescaled, estimate; Feb 2012 – Jul 2026 VIIRS S-NPP observation; Aug–Oct 2026 NRT, preliminary; Nov 2026 NOAA-20 rescaled (S-NPP switched off 2 Nov), preliminary. Matches our status model. |
| What is exposed | No API. A single-file static demo (`webapp/index.html` + 820 KB `data.js`) with calendar, hex selection, anomaly view, "show naive splice" toggle, seasonal profile, day/night toggle, CSV export, light/dark. Tests: 25 pytest files. Processed data is not in git (`data/processed` is gitignored; only `data/README.md`). |
| Documented | `docs/pipeline.md`, `k_model.md`, `static_mask.md`, `harmonization_report.md`, a 107 KB `harmonization_guide.md`, results tables under `reports/k/`. |
| Gaps relevant to us | (a) Unit is 1 km cell-days, which the DATA_CONTRACT must name precisely in UI copy. (b) Only 2 regions, so the calendar for "any area on Earth" needs more deliveries; until then, say so. (c) "Norm" in their README is the 2001–2025 median, which includes the target year, whereas ours excludes the target year. (d) Estimate asterisk is their only marker. (e) No uncertainty intervals are mentioned (check `harm_lo/harm_hi` in the delivery). (f) No licence on the repo: ask. |

## 4. Prioritised features (our app) that none, or only the weakest, provide

Honesty column: does it satisfy docs/PROJECT_RULES.md "Honest values only" and "no invented numbers" (yes/no)? Effort: S/M/L.

| # | Feature | Why it beats the field | Honest? | Effort |
|---|---|---|---|---|
| 1 | "Raw vs harmonized" toggle with the 2012 jump shown (naive splice vs harmonized line on the annual chart). Spec F10. | The team's demo has the toggle; FireScope has no pre-2013 data, so it cannot show it at all. This is the challenge's central message. | yes | M |
| 2 | Plain-language headline per selected month: "x1.8 vs median of 24 Novembers (2003-2025), preliminary" with the n and the status inline. Median after AOI aggregation, target year excluded, n >= 10. | FireScope uses MAD/anomaly classes and abstract "MODIS-equivalent detections"; the other sites have no baseline at all. Emergency services need one sentence. | yes | S |
| 3 | Per-cell status layer incl. `estimate`, `preliminary`, `future`, `no_data` hatched grey, with a legend and a toggle "show only final data". | FireScope has coverage classes only; no site distinguishes the pre-2012 estimate from observation. | yes | S |
| 4 | Uncertainty on harmonized values (`harm_lo`/`harm_hi` as a whisker/tooltip range, only if delivered by the science team; else "no interval available"). | FireScope reports r^2 0.48 but shows a single point value per cell; nobody shows an interval in the calendar. | yes (only if computed by the data team) | M |
| 5 | Arbitrary AOI by draw/country/point+radius, using real country polygons, same calendar in <= 1.5 s, shareable URL `/a/<id>`. | FireScope regions are convex hulls of grid cells (its own caveat); Off-Nadir and Worldview have no area statistics; EFFIS is Europe-only. | yes | L |
| 6 | Fire Stripes / share card PNG/SVG with status marks and the dataset version, one click (spec F12). | No competitor offers a shareable, honest summary image. | yes | M |
| 7 | "Sensor or reality?" explainer: scroll-through of one real fire seen by both sensors, overpass times, 1 km vs 375 m (re-use the data team's `guide_*` figures, translated). | Competitors use jargon; the data team's guide exists only in Russian. | yes (use their figures and numbers, with attribution) | M |
| 8 | Real overpass coverage layer (FIRMS swaths) so "no detection" can be told from "not observed" (spec F14). | FireScope states plainly that it cannot do this; others do not address it. | yes | L |
| 9 | Static-source (flare/industrial) filter toggle and "flares masked: N cells" disclosure, using the team's mask. | Not seen anywhere in the fetched sites; Texas and Kazakhstan are flare-heavy. | yes (the mask comes from the team; show its count) | M |
| 10 | Accessibility-first calendar: full keyboard grid navigation, screen-reader table fallback with status words, CVD-safe scales, pattern + number never colour alone, `prefers-reduced-motion`, and SSR first paint under budget; publish a Lighthouse/axe report in the repo. | FireScope ships a client-only 1.6 MB bundle with few ARIA strings; this is a measurable, demonstrable advantage. | yes | M |

Not recommended: a 3D globe, prediction, chatbot (forbidden by docs/PROJECT_RULES.md "Do not"). A 3D terrain map is optional and must not delay features 1-3.

## 5. FireScope vs us

| Category | FireScope (verified) | FIRE TRACE (target) | Edge |
|---|---|---|---|
| Data honesty | Excellent copy and methodology page; coverage classes; refuses anomaly labels on sparse months; shows losing models. But the headline unit is abstract and no interval per cell. | Same level of copy, plus a five-state status per value, enforced by the `HonestValue` type; ratio with n and exclusion of target year. | Tie on candour, we win on structure; must match their methodology page. |
| Calendar | Month x year view, tooltip with raw MODIS/VIIRS, FRP, coverage; years only 2013–2024 (most regions 1 year). | 2000–2026, 324 cells, three colour modes, row sum and column median, hatched no_data. | We win (range). |
| Map | MapLibre, points, FRP heatmap, harmonized hex, bbox/polygon, GIBS daily imagery, terrain toggle, light/dark. | Draw + country + radius AOI, H3 worker, terra-draw; phase 2 live layer. | FireScope wins today; we should close by AOI quality and no hull regions. |
| Mobile | CSS exists, behaviour unverified. | Budgeted, to be tested in Playwright at 400 px. | Unproven both sides. |
| Accessibility | ~11 aria-labels in bundle; no `prefers-color-scheme`; keyboard claims unverified. | WCAG 2.2 AA audit, CVD-safe scales, tables fallback. | We can win. |
| Performance | CSR SPA, one 1.64 MB JS bundle, API not CDN-cached (max-age=0), 0.58 s for one calendar call. | CDN-cached calendar, route-split, SSR, budgets in perf-budget. | We can win. |
| Explanations for non-experts | Good caveats but in expert vocabulary (MODIS-equivalent, MAD, isotonic); methodology page. | One-sentence ratio headline, glossary, "sensor or reality" explainer. | We can win. |
| Export / API | CSV x4 + metadata JSON + public unauthenticated `/api/v1` (rich). | Zip with summary, detections and metadata (spec F05); public API planned for phase 1. | FireScope ahead on breadth; match with a documented API and OpenAPI. |
| Coverage of the world and time | 10 regions, 2013–2024 (most 2021). | Depends on deliveries: the data team has 2 regions today (TX, KZ, 2000–2026). | Unclear; we win on time depth, lose on region count unless more regions arrive. |

## 6. Risks to our own claims
- "Any area on Earth" is not true until the data team delivers more than two regions. Label the UI honestly ("regions delivered").
- The team's baseline includes the target year; ours excludes it. Align in DATA_CONTRACT or recompute server-side from `cell_month`.
- FireScope's honesty bar is high. We must not claim better honesty on copy alone; the differentiator is the per-value status, the range 2000–2026 and the headline ratio.
