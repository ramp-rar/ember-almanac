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


## 7. Kiln-watch (https://kiln-watch-seven.vercel.app/)

Method: `curl` on the HTML, the Vite bundles (`index-7kKvbekD.js` 524 KB, lazy chunks `Home` 800 KB incl. three.js, `Map` 13 KB, `PlaceRisk` 19 KB, `Warning` 28 KB, `maplibre-gl`, CSS 71 KB) and nine public JSON endpoints, read 2026-11-15. The site is a client-rendered React SPA. Findings come from bundle strings and API responses, not from a browser session: I did NOT see rendered screens, so layout, motion and pixel-level interaction claims are marked "from code" or "not verified".

### 7.1 What it is
"Kiln Watch" (team "Off the Binary", GitHub `Aalvee-Aarham/nasaspaceappschallenge-2026-team-off-the-binary`) answers the same challenge as ours (MODIS x VIIRS harmonization) but as a broad product: harmonized record, early warning, place-risk check, AI analyst, MCP server, email alerts. Its `og:description` claims "an early warning and a 35-tool MCP server" (a meta-tag claim; `/mcp` answers 406 to a plain GET, so I could not list the tools). Origin story: Dhaka brick-kiln belt and Boro-harvest farmers, but the product is global.

### 7.2 Pages, features and interactions found
| Area | Evidence | What it does |
|---|---|---|
| Home | `Home` chunk strings | Hero + persona cards (fire services/NGOs/farmers, researchers, developers). Uses three.js with "NASA 3D Resources" satellite models and "NASA Blue Marble" Earth (an "anatomy" 3D section, `--anatomy-*` dark tokens). This 3D scene is what our docs/PROJECT_RULES.md forbids. |
| Calendars | string "Fire activity by ISO week and year. Arrow keys move, Enter opens." | Month and ISO-week x year grid; colour + label = period vs median of same month; a "recency-weighted" variant (each year counts half as much as one 10 years newer); percentile toggle "all other years" vs "recent years"; `role=grid` present; click/Enter opens "what's behind it" (daily chart stacked by satellite, map fly-to, news). |
| Map | `Map` chunk, MapLibre | Basemap `tiles.openfreemap.org/styles/dark`, NASA GIBS WMS tiles by date, globe projection switch (`setProjection`), popups "Nth percentile of the same days", table row click flies to the cell, caveat "coordinates are pixel centres, not exact fire locations". No terrain/hillshade/raster-dem found in the bundle: no 3D terrain map. |
| Early warning | `Warning` chunk, `/api/warnings`, `/api/outlook` | Levels `quiet / normal / watch / insufficient` per region from the percentile of "month so far" vs the same days in earlier years; headline sentence ("higher than 23 of the previous 26 Novembers over the same days"); `next_4_weeks_median`; 12-week bar chart with median tick, top-tenth orange, top-quarter gold, bottom-tenth blue, dashed in-progress week; world "outlook" list of half-degree cell groups with `last_30`, `usual_last_30`, `usual_next_30`; email subscription (live `/api/health` says `email:false`) and an n8n workflow download. |
| Backtest | `/api/warnings` | Each alert carries `backtest {pod, far, pss, n}` (e.g. N. California pod 0.65, far 0.235, pss 0.592, n 178); `insufficient` with null backtest for Dhaka and La Rioja; copy admits the score "is generous" because the month total includes days the rule already saw. |
| Is fire near you? | `PlaceRisk` chunk, `/api/place-risk`, Nominatim, geolocation | Type a town/school/address or share location: fire seen within 1-25 km this week, usual fire months, outlook, and nearby schools, hospitals, clinics, care homes, fire stations (OpenStreetMap). Plain yes/no sentences. |
| Farm check | `/api/farm-check` | Dhaka kilns within 1 km, estimated smoke, fire before Boro harvest; "email or print it for the agriculture office". |
| Casebook / news | `/api/casebook`, `/api/events` | Unusual months matched to NASA EONET events and GDELT news (2017+), each case labelled `corroborated / reported / satellite_only / agency_only / abstained / insufficient`; Gemini filters off-topic headlines; GDELT limited to 1 request per 5 s. Per-area exposure (population, hospitals, schools, roads, cropland km2; WorldPop/OSM). |
| Download | `/api/export/options` | CSV/TSV/JSON; month or week granularity; column groups: harmonized Aqua-scale hotspots + `ci95_lo/hi`, VIIRS scale + `viirs_scale_modelled` flag, fire cell-days, history (`median_same_period, ratio_to_median, percentile, rank, of_years`), satellites used + per-satellite coverage, raw counts ("do not trend them"). CSV starts with `#` comment lines (unit, source, code version). Detections file: up to 366 days with static-source flag and "used in calendar" flag. No key, no sign-up. |
| Methodology / proof | strings | Sensor-denial rehearsal ("what if MODIS had ended in 2016?"), geographic hold-out, FRP quantile mapping (W2 distance), seasonal Mann-Kendall (harmonized slope should match Aqua-only), yearly totals indexed to 2003-2011 = 100 on log scale, "95% intervals contained the observed value in N%" (calibrated on earlier years, scored on later), chain-of-links error added to the interval, MODIS calibration stops at 2020 (Terra/Aqua overpass drift; chart "Aqua MODIS local overpass hour by year"), "Aqua itself drifts after about 2021, so the 2024 comparison is weaker". NRT versions flagged provisional. |
| Build your own area | `/api/aoi` | Any box up to 4 x 4 deg; "plan on 5 to 10 minutes" background build with progress screen. Only 9 preset areas: Alberta, Dhaka kilns, La Rioja, N. California, Niger Delta, Parana Delta, Punjab, Rondonia, SE Australia. |
| AI analyst | `/api/agent`, `/api/personas` | Chat with personas (e.g. "Ember", fire operations officer), tool calls listed; "charts are drawn from the pipeline, never by the model". UI text says Google Gemini free tier; live `/api/health` reports `groq/openai/gpt-oss-120b`: copy and server disagree. |
| Other | strings | "What teams asked NASA, and our answers", feedback to GitHub issues, "Copy a link to this exact view" (hash-state URLs), locales `en` + `bn` (Bengali) only: no Russian or Tajik. |

### 7.3 Data sources and claims
- FIRMS MODIS C6.1 + VIIRS 375 m via the Portolan GeoParquet mirror on source.coop (CC0), data through 2026-11-14 (`/api/health`), regions built 2026-11-15: fresh to the day.
- Primary unit "harmonized hotspots on the Aqua MODIS scale" with 95% interval; secondary fire cell-days. Explicit: "A calendar value is hotspots a reference satellite would have recorded, not a count of fires." Static sources (kilns, flares) separated by a flag.
- Cites Giglio and others (DOIs in bundle), a 2026 GMD paper and an arXiv PDF: verified only that the links exist.
- Not verified: interval coverage percentages, the "35 tools" count, numeric calibration results (Methodology page is client-rendered; not parsed).

### 7.4 Design (from code)
- Dark-first near-black navy (`--night #030508`, `--raised #0A0E15`, `--line #1C232F`, text `#F1F4F8`, muted `#97A3B3`), ember orange accent `#EA7329`/`#FF9A5A`, gold `#F6C64F`, cold blue `#7FB2EC`, focus `#00A1FF`, green `#3DDC97`. Light values exist (`#f3f4f6`, `#111827`) but the CSS has 1 `prefers-reduced-motion` and 0 `prefers-color-scheme` rules.
- Typography: Instrument Serif (display) + Inter / Inter Tight (UI).
- Level colours orange/gold/green/blue always paired with a text label; CVD safety not verified.
- Motion: not verified (three.js scene, view transitions referenced).
- A11y signals: 98 `aria-label`, 4 grid roles, arrow-key navigation copy. Not tested by me.

### 7.5 Strengths (evidence)
1. Breadth with a believable "so what": place check with schools/hospitals, alerts, farm check, API, MCP, n8n.
2. Candid copy ("Aqua itself drifts after about 2021"; "that score is generous"; "detections are not fires"; "an outlook, not a forecast").
3. Uncertainty shipped: 95% intervals in export, per-alert backtest, `insufficient` instead of a fake level.
4. Provenance in every file (unit, source, code version, `viirs_scale_modelled`, NRT share).
5. Fresh data, open unauthenticated endpoints, no key.
6. Six corroboration classes keep news from overstating the satellite signal.

### 7.6 Weaknesses (evidence)
1. Only 9 preset regions; any other area is a 5-10 min build limited to 4 x 4 deg (`/api/aoi` copy).
2. Baseline is recency-weighted or includes the target period; no minimum-years rule or n visible in what I found. Ours (exclude target year, n >= 10, median 0 rule) is stricter.
3. No five-state status per value: provisional is a period flag, pre-2012 is a `viirs_scale_modelled` column; I found no `no_data` hatch and no `future` state.
4. Performance: Home chunk 800 KB (three.js) + 524 KB main; API `Cache-Control: public, max-age=0, must-revalidate`, `X-Vercel-Cache: MISS`; FastAPI backend on Azure Japan East (`kiln-watch-jp...japaneast.azurecontainerapps.io`); UI ships "it may be busy or waking up" copy.
5. Copy vs server mismatch (Gemini vs Groq); `email:false` on the live server although email alerts are advertised.
6. Scope creep (3D scene, AI chat, alert levels); alert backtest admittedly partly scored on days the rule already saw.
7. Two languages (en, bn), no ru/tg; no OS dark-mode following.
8. SPA with empty `<div id="root">` and hash URLs: no SSR, weak link previews.
9. Backtest n about 130-180 per region without intervals; independence of overlapping windows not stated (not verified how handled).

### 7.7 What to adopt (better than theirs)
1. **Interval and provenance in tooltip and export.** Build: if the data team delivers `harm_lo/harm_hi`, tooltip "x1.8 (1.4-2.3)" and `ci95_lo/ci95_hi` columns; CSV header `#` block with unit, source, dataset version and a `status` column per row. Better: status per row, typed via `HonestValue`, not just extra columns. Honesty: only if computed by the science team, else "no interval available". Effort M.
2. **Check-against-reports labels on unusual months.** Build: for months in the top 10%, server job queries NASA EONET (free) and shows linked events with an enum label (corroborated / reported / satellite_only / none found). Better: links only, no LLM summarising of news. Honesty: show counts and links, never "confirmed fire". Effort M.
3. **"Insufficient" with a stated reason.** Build: headline copy per rule: `fewer than 10 valid years (n=7)`, `median is 0: no usual activity`, `coverage too low`. Better: theirs returns `insufficient` without a visible reason in the data I saw. Honesty: pure rules. Effort S.
4. **Backtest panel for our 6-month expected range.** Build: "How reliable was this?" showing the share of past months where the observed value fell inside the range, with n and the overlap caveat, computed by script from our data; hide the range if not validated. Better: coverage in plain words instead of POD/FAR/PSS. Honesty: computed, with n; else "not validated". Effort M.
5. **"Is fire near you?" address check inside the calendar frame.** Build: one input (place or point + radius from our AOI tool): detections this week within 5-25 km and "usual for this month" with status, at a shareable URL. Skip facility lists in phase 1. Better: same status/ratio rules and SSR-able URL. Honesty: "detections, not fires; none seen is not none occurred", show last overpass time. Effort M.
6. **Seam/sensor-denial figure next to the calendar.** Build: raw vs harmonized annual lines with the 2012 and 2020 seams marked and caption "a step in the raw line that the Aqua-only line does not share is the satellite fleet changing, not fire", plus the data team's rehearsal figure if delivered. Better: on the main flow, theirs is on a separate page. Honesty: only figures from the science team, cite file/version. Effort S-M.
7. **ISO-week calendar mode.** Build: `granularity=week` in the API and a 53 x 27 SVG grid with the same status rules and arrow-key/Enter navigation. Better: median excludes target year, no silent recency weighting. Honesty: show "too few detections" below a threshold instead of noisy ratios. Effort M.
8. **Per-satellite coverage strip under the calendar.** Build: thin row per month (Terra, Aqua, SNPP, NOAA-20/21) with share of days in the tooltip, pattern + text. Better: visible on the home screen, theirs is a download column. Honesty: derive from days with detections and state that method (theirs: "observing on any day it delivered detections anywhere on Earth"). Effort M.
9. **EN/RU/TJ with OS-aware theme.** Build: `prefers-color-scheme` plus explicit toggle, `lang` per route, translated status labels reviewed by a native speaker. Better: they ship en/bn and no `prefers-color-scheme`. Honesty: glossary entries for methodology terms, no machine-only copy. Effort M.
10. **SSR + CDN-cached calendar, path URLs.** Build: SSR of the 324 cells, `s-maxage` + `stale-while-revalidate` on calendar API keyed by dataset version, OG image per area. Better: theirs is a CSR shell, `max-age=0`, hash URLs. Honesty: stale data labelled with `data_through`. Effort M.
11. **Data-through line.** Build: calendar footer "Data through <date>, last standard-processing <date>, NRT share x% of this month" from `meta.json`, linked to `preliminary` cells. Better: tied to the cell status, not a table column. Honesty: all from `meta.json`. Effort S.
12. **Permanent "what this is not" strip.** Build: "Detections are not fires or burned area; the range is a climatological outlook, not a forecast" next to the headline and in every export header, linking to the glossary. Better: attached to each number's status copy, not a footer. Honesty: wording only. Effort S.

Do not copy: 3D globe/satellite scene, AI chat/personas, email alert levels (docs/PROJECT_RULES.md "Do not"; their own copy calls the backtest "generous"). MCP/n8n only after our public API and OpenAPI exist.

### 7.8 Not verified
Rendered visuals and motion; Methodology page figures and percentages; MCP tool list; email delivery; any HTML table fallback; behaviour at 400 px; AI analyst accuracy; repo licence.


## 8. FireLens, mikuuloves, BurnCal, Terrascope

Method (read 2026-11-15): `curl` on the HTML, the Vite JS bundles (FireLens 237 KB plus separate maplibre/react chunks; Ember Atlas 598 KB; BurnCal 1.84 MB; Terrascope 1.46 MB plus 5 lazy chunks) and the public data files and endpoints the bundles point to. WebFetch was not used. No browser session: layout, motion and pixel details were NOT seen. "From code" means from bundle strings or file bytes. All model scores quoted below are the sites' own claims, not re-checked by me.

| Site | Verified | Not verified |
|---|---|---|
| firelens.tech | Bundle, MapLibre layer definitions, a live `fires/global` response, the CDN `index.json`, the Tajikistan report JSON (size, headers, fields) | Rendered UI, calendar look, Cloud Run API cache headers (GET on POST endpoints gave 405), language list, accessibility |
| nasa.mikuuloves.coffee ("Ember Atlas") | HTML shell, bundle, `meta.json`, `forecast.json`, `admin1.json`, headers and size of `history.bin` (full download measured), URL scheme (`mode`, `area`) | The "Fire Calendar" tab internals (not extracted), rendered globe, forecast accuracy |
| burncal-hackathon.vercel.app | HTML shell, bundle (React + Recharts + d3-geo + SheetJS), the FIRMS calls, UI state names and strings | What `mode=map` (flat map) renders with, any history beyond the NRT window (none found), rendered UI |
| terrascope.space | HTML shell, bundle, 5 lazy chunk names, i18n chunk, `countries.json`, MapLibre style construction | `view=simple` vs other views, what `TJK` shows on screen, the data endpoints (a probe of `/api/forecast/map.png` with only `variable=t2m` returned 500, which says nothing about the live app) |

### 8.1 FireLens (https://firelens.tech/)

**What it does.** "MODIS x VIIRS Fire Intelligence", same challenge as ours. Vite + React SPA (empty `#root`, no SSR), MapLibre in its own preloaded chunk, API on Google Cloud Run in `asia-south1` (`/api/v1`), per-area reports on Cloudflare R2. Endpoints from the bundle's own API table: `/calendar/range|generate|anomalies|report`, `/harmonize/calculate|model`, `/fires/live` (POST, raw NRT MODIS+VIIRS for a bbox), `/fires/global` (today's worldwide VIIRS on a grid), `/archive/grid` (one year, harmonized/MODIS/VIIRS), `/hotspots/search|history|csv`, `/alerts/subscribe`. Features by strings: area search through Nominatim polygons, GPS, a "Compared with the median" headline, anomalies (early/late onset, surge, suppression), an outlook, a calibration table, JSON/CSV download "with the source fields behind it", ArcGIS satellite basemap with a labels overlay, `localStorage`.

**Fire location and loading (from code and bytes).**
- Global layer: the server pre-aggregates to 0.5 degree cells. `GET /fires/global?days=1` returned `cells:[[lat,lon,count,frp],...]` built from 33,868 VIIRS NOAA-20 NRT detections, in 74.8 KB of JSON. The client turns each cell into a GeoJSON Point with weight `w` and calls `getSource("fires").setData`.
- MapLibre layers: a `heatmap` with `maxzoom:7` (weight `w`, radius 5/12/22 px at zoom 0/3/6, ramp red to pale yellow, opacity 0.95 at z4 fading to 0 at z7), then a `circle` layer from `minzoom:3.5` (radius grows with `w`, colour by `w`, opacity 0 at z3.5 to 0.95 at z5). That is a heat-to-point crossfade by zoom. Also an `aoi` fill + line layer and a countries GeoJSON source from jsDelivr.
- Per-area reports: `index.json` (234 entries: 230 countries plus Global, Amazon, California, SE Australia; `through: 2026-11-15`) and `reports/<slug>.json?v=<through>`. Tajikistan report: 26.7 KB gzip, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`; `index.json` is `max-age=300`. Cache is busted by the `?v=` data date. This is the fast path and the one thing to copy outright.
- No vector tiles, no PMTiles, no clustering and no worker code of their own found in the bundle strings (MapLibre's own geojson worker is the only worker).
- An `offline` flag when the API fails: the page keeps working on bundled demo data (from code).

**Calendar and timeline.** The report holds `calendar` = 27 years x weeks. Each week: `modis_raw, viirs_raw, harmonized_count, total_frp, status, z_score, percentile, quality`. Before Nov 2000 the status is `NO_DATA` with `harmonized_count: null` (matches our no_data rule). A parallel `monthly` list (314 rows) carries `harmonized, median, x_median, percentile, complete`. `summary` has this week, 2-week, YTD vs baseline, `percentile`, `status` (`NORMAL`), `z_score`, `season` (`Waning`), `peak_week`, `onset_median_week`, `provisional: true`. Week granularity is their primary calendar. A bundle template reads "Harmonized burning 5.4x the 2003-2025 mean - the highest of all 27 years"; the report field calls the baseline a median, so which one is rendered is not verified.

**Tajikistan / Central Asia.** A report exists: `bbox {west 67.5, south 37.0, east 74.25, north 41.0}`, `coverage 1.0`, `clipped_to_geometry: false`. Kazakhstan, Kyrgyzstan, Uzbekistan and Afghanistan reports also exist. No Tajik-specific features or copy found.

**Strengths (evidence).**
1. Fastest first paint of the four: a 26.7 KB gzip CDN JSON per country with `stale-while-revalidate`.
2. Heat-to-point zoom crossfade on a pre-aggregated grid keeps the map light at world zoom.
3. 2000-2026 weekly calendar with an explicit `NO_DATA` status and a `provisional` flag, the same idea as ours.
4. Its CSS has `prefers-color-scheme` rules (6) and `prefers-reduced-motion` (3). Note: section 1.3 #10 is about FireScope, a different site.

**Weaknesses (evidence).**
1. A "country" is a bounding box, not the country shape (`clipped_to_geometry:false`). Tajikistan's box 67.5-74.25 E, 37-41 N includes parts of neighbouring countries, so the numbers are not the country's.
2. No `estimate` state in the fields seen: only `NO_DATA` and `provisional`.
3. Weekly cells in small areas are noisy (Tajikistan current week: harmonized 0.0 vs baseline 2.9).
4. SPA without SSR; runtime dependency on an unpinned `cdn.jsdelivr.net/gh/.../react-globe.gl@master/...` countries GeoJSON and on Nominatim.
5. The map reads only today (`days=1`) or one archived year per call; I found no animated month scrub in strings (not verified in the UI).

### 8.2 mikuuloves, "Ember Atlas" (https://nasa.mikuuloves.coffee/)

**What it does.** Meta description: "25 years of MODIS and VIIRS fire detections unified into one consistent record, live fires, and an AI fire-risk forecast on a 3D globe". Four tabs in the HTML: History, Fire Calendar, Live, AI Forecast. URL state in the query string: `mode=forecast&area=province:TJ-DU|Dushanbe` (country, province or a box, written by `searchParams.set("area", ...)`). A raw `<canvas id="globe">`, three.js (WebGLRenderer, InstancedMesh, Blue Marble texture), no MapLibre.

**Fire location and loading (measured).**
- History: one binary `data/history.bin`, 50.3 MB raw, **14.7 MB gzip, downloaded whole before anything is drawn** (a "Loading 25 years of fire data..." loader with a progress callback; my download took 65 s). Layout from the parser: `uint32 N`, `N+1` offsets (a CSR index by month), delta-coded `uint32` cell ids, then three `uint16` columns `harm, modis, viirs`. Cell ids are on a 0.01 degree grid (index = row x 36000 + col, about 1 km). A clever columnar format, but the single file is the weakness.
- Per-cell detail on click: `data/tiles/<lat10>_<lon10>.json` (10 x 10 degree JSON lookups, fetched once and kept in a Map).
- Live: raw FIRMS CSVs (VIIRS NOAA-21, and other VIIRS/MODIS sources) fetched through the site's own nginx `/firms/...` path and parsed in the browser; each detection is tested against a static-source mask (`static_mask.bin`, `kinds`, `industrial` flag).
- Caching: `meta.json` is `no-cache`; `history.bin`, `static_mask.bin`, `forecast.json`, `admin1.json` are `max-age=604800` with a `?v=<version>` suffix (version `20261115013126`).
- `meta.json` (50 KB): 302 months from 200011, yearly totals 2001-2025 for 234 countries, `calibration {fit_period 2012-2018, test_period 2019-2025, block_month_r2_log_regional 0.812, raw_modis 0.504, global_monthly_mape_regional 0.074, raw_modis 0.76}` and `stats.detections 392,568,931` (their numbers).

**Forecast (AI).** `forecast.json` (219 KB decoded): gradient-boosted model (949 trees, 40 features incl. weather, fuel history, forest, land cover), "chance of >=30 detections per 1 degree cell" for 2 months, `metrics.auc 0.954` vs `baseline_auc 0.936`, trained 2002-2022, tested 2023-2025 (self-reported). A prediction product, excluded by our docs/PROJECT_RULES.md. Not copied.

**Calendar.** A "Fire Calendar" tab exists; I did not extract its logic (not verified). `meta.json` has months and years only.

**Tajikistan / Central Asia.** `admin1.json` is a TopoJSON of first-level regions with ISO 3166-2 codes; I verified `Dushanbe` (`TJ-DU`, "Independent City", admin Tajikistan) in it. So an admin-1 area is selectable by code in the URL, which is how the link you gave works. Whether the other Tajik regions are in the file was not checked.

**Strengths.** Admin-1 URLs with ISO codes; static (industrial) mask applied to live data; per-10-degree lookups; versioned `?v=` caching with 7-day max-age; a held-out calibration summary (raw vs harmonized); fresh to the day.

**Weaknesses (evidence).**
1. A mandatory 14.7 MB gzip (50.3 MB decoded) download and in-browser decode before the first useful paint; poor fit for weak mobile networks.
2. 3D globe + three.js and an AI-risk story: contradicts our "no 3D globe, no prediction" rules.
3. The browser parses raw FIRMS CSV. It works because they run a proxy (key handling not visible); copying it would break our rule "do not call FIRMS from the browser".
4. No `estimate`/`preliminary`/`no_data` statuses in `meta.json`; years start at 2001, months at 2000-11.
5. Forecast quality claims cannot be reproduced from what I fetched.

### 8.3 BurnCal (https://burncal-hackathon.vercel.app/)

**What it does.** React + Recharts + d3-geo (orthographic globe, SVG or canvas renderer prop) + SheetJS, one 1.84 MB JS chunk, no SSR, no routes found. URL state: `period`, `source` (`both|MODIS|VIIRS`), `mode` (`globe` or map). Component state: points/heatmap toggle, count metric, time-of-day window `08:00-18:00`, location search (Nominatim, Photon), geolocation, "Copy Report", alert text "extreme fires (FRP > 100 MW) within 75 km of your location", exports `BurnCal_Fires / RawData / Summary / TopFires` (Excel via SheetJS).

**Fire location and loading.** The browser calls the FIRMS Area API directly, per country bbox, for `MODIS_NRT` and `VIIRS_NOAA20_NRT`, parses CSV, then filters points inside the country polygon with d3-geo. No tiles, no PMTiles, no aggregation, no worker. A FIRMS MAP_KEY is hard-coded in the public bundle (not reproduced here); our rule "do not call FIRMS from the browser, no secrets" exists for exactly this. Area selection is by clicking a country on the globe.

**Harmonization.** The loader says "Harmonizing MODIS & VIIRS sensors". In the code the only normalisation found is VIIRS confidence `low/nominal/high` mapped to 30/60/90 next to MODIS numeric confidence, and `bright_ti4` vs `brightness`. I found no calibration, no scale factor and no history beyond the NRT window (from code, not exhaustive). The word is a label, not the challenge's method.

**Calendar/timeline.** None found: a recent `period` and a "Peak Day" stat. Not a multi-year view.

**Tajikistan.** Country list includes Tajikistan (Natural Earth shapes); nothing specific.

**Strengths.** Immediate "what burns this week" answer without a backend; Top Fires table, Excel export and report copy; a stated alert threshold.

**Weaknesses.** Key exposed and a live FIRMS dependency (rate limits, single point of failure); 1.84 MB single chunk; no harmonization, baseline or statuses; no i18n found.

### 8.4 Terrascope (https://terrascope.space/)

**What it does.** Not a fire tool. "Earth system trends from NASA data": temperature (`t2m`), precipitation, NDVI/EVI and more, credited to NASA MERRA-2, GPM IMERG, CERES/MODIS via NASA POWER, MODIS, GLDAS, AIRS, OMI. Regions by code (`r=TJK`), `view=simple`, `globe=1`. Lazy routes: `Report`, `CompareReport`, `ForecastPage`, `LinksPage`, `AdminPage`. Endpoints seen: `/countries.json` (917 KB GeoJSON), `/api/ai/ask`, `/api/visit` (POST on visit), `/api/forecast/map.png`. No fire, FIRMS or VIIRS string in its app code.

**Map technique worth noting.** MapLibre with `setProjection` (globe) and a style with no basemap tile source: a `geojson` source `countries` drawn as `fill` (land) and `line` (borders), plus `outline`, `compare` and `point` sources updated by `setData`. The map needs no tile requests and is ready when `countries.json` is. Assets are `max-age=31536000, immutable`, gzip.

**Honesty ideas (from i18n strings).** "Season and trend are removed from both, and only the swings are compared"; "No outlook for {where}: in its climate zone continuing the trend did not pass the check on the past"; "Find robust trends"; 80% and 95% bands on projections. A refuse-when-unvalidated pattern, like our n >= 10 rule.

**Language.** `en` and `ru` blocks in the i18n chunk (about 16,700 Cyrillic characters); no Tajik text found.

**Weaknesses.** Off-topic for fire; 1.46 MB main chunk with MapLibre inlined; a per-visit analytics POST with no consent UI seen (consent UI not verified); an AI ask endpoint, which our docs/PROJECT_RULES.md forbids; I could not see the default `TJK` screen.

### 8.5 Tajikistan / Central Asia summary

| Site | What exists for TJ | Level |
|---|---|---|
| FireLens | Country report `tajikistan` (also KZ, KG, UZ, AF), weekly 27-year calendar, bbox not shape | Complete but bbox |
| Ember Atlas | `TJ-DU` Dushanbe admin-1 polygon selectable; country yearly totals in `meta.json` | Admin-1, depth not checked |
| BurnCal | Country list only, recent days only | Minimal |
| Terrascope | `r=TJK` climate region; no fire | Off-topic |
| Languages | en everywhere; ru in Terrascope; tg nowhere found | Gap |

### 8.6 Map: what to copy for speed and fire location

None of the four uses vector tiles, PMTiles or clustering (no `pmtiles`, `.pbf` or `{z}/{x}/{y}` vector source in the bundles I grepped; FireLens has raster ArcGIS tiles for imagery only). The fast ones win by pre-aggregation and by not blocking on the map. Recipe for our MapLibre map:

1. **Paint the calendar first, load the map after.** Calendar from a per-AOI JSON on the CDN (FireLens model: about 27 KB gzip per country, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`, URL suffix `?v=<dataset version>`). `import("maplibre-gl")` only after the calendar's first paint (FireLens ships MapLibre as its own preloaded chunk). Keep `meta.json` `no-cache`, everything else versioned.
2. **No basemap blocking the first frame.** Option A (Terrascope): a country/admin-1 GeoJSON fill + line style with no tile source, ready at once. Option B: a light/dark vector basemap loaded after. Hillshade only on user request (relief matters in Tajikistan but costs tiles).
3. **Show where fires are with H3 hexes, not raw points, at region zoom.** Pre-bake hex cells (H3 res 4-6 by zoom band) from the science team's `cell_month`. Deliver as per-year vector tiles or small static JSON per AOI (a design, not benchmarked; measure against the perf budget). One feature per hex carrying the 12 monthly values of the selected year as an array, coloured by expression (`["at", month, ["get","v"]]`), so a calendar month click only changes an expression with no refetch. Inferno/cividis colours; `no_data`, `estimate`, `preliminary` as separate hatch/outline styles, never value 0. `promoteId` + `feature-state` for hover.
4. **Zoom crossfade for daily/live detections (FireLens values).** Heatmap with `maxzoom:7` (weight from FRP, radius 5/12/22 at z0/3/6, opacity 0.95 at z4 to 0 at z7), `circle` layer from `minzoom:3.5` (opacity 0 to 0.95 by z5). Source = server-aggregated 0.5 degree grid for the world (their real figure: 33,868 detections in 74.8 KB), raw detections only inside the current bbox at z >= 8, capped; above the cap use the native `cluster:true` GeoJSON source (runs in MapLibre's worker).
5. **Exact-location honesty.** A hex or 0.5 degree cell means "somewhere inside this area"; a detection is a 375 m / 1 km footprint, not a fire. Tooltip: sensor, date/time UTC, FRP, `static source` flag if masked, status. Show masked industrial/flare detections as hollow markers with a count instead of dropping them silently (Ember Atlas flags them).
6. **Click a hex, get its calendar.** Ember Atlas fetches 10 x 10 degree lookup files on demand and caches them. For us: `GET /api/cell/<h3>` returns the 27 x 12 `HonestValue` grid (a few KB), CDN-cached by dataset version.
7. **Workers.** `h3-js` (AOI polygon to cell list, hex boundaries) in a Web Worker as planned; no polygon work on the main thread.
8. **Never** ship one big blob (Ember Atlas: 14.7 MB gzip before first paint), call FIRMS from the browser or embed a MAP_KEY (BurnCal), or depend on an unpinned `@master` CDN URL (FireLens). Pin and self-host country/admin-1 geometry.
9. No 3D globe (docs/PROJECT_RULES.md). Terrascope shows `setProjection` is only a style switch, so a world view does not need a separate globe engine.

### 8.7 Top 10 to adopt

| # | What to adopt | Source | Build note | Effort | Honesty check |
|---|---|---|---|---|---|
| 1 | Precomputed per-AOI report JSON on the CDN with `?v=<through>` and stale-while-revalidate | FireLens (`reports/<slug>.json`, 26.7 KB gzip for Tajikistan) | Build at ingest per delivered AOI; `index.json` lists AOIs and the `through` date. Calendar paints from it before the map loads | S-M | yes: footer "data through <date>" from `meta.json`; if an AOI is not delivered, say so instead of showing a bbox stand-in |
| 2 | Heat-to-point zoom crossfade on a pre-aggregated grid for the live/daily layer | FireLens (layer definitions) | Their zoom stops, server 0.5 degree grid, raw points only in bbox at z >= 8 | S | yes: legend "detections aggregated to 0.5 degree cells, not fires"; empty means "no detection", not "no fire" |
| 3 | Admin-1 areas with ISO 3166-2 in the URL (`area=province:TJ-DU`) | Ember Atlas (`admin1.json`, `area` param) | Bundle admin-1 geometry (licence to check); aggregate by polygon, not bbox. Only Dushanbe verified in their file | M | yes, and better than FireLens bbox; offer admin-1 only for AOIs the science team delivered |
| 4 | Click a map cell, get its calendar | Ember Atlas (10 x 10 degree lookup JSON) | `GET /api/cell/<h3>` returns 27 x 12 `HonestValue`s, cached per dataset version | M | yes: same status rules, n >= 10 baseline, "no usual activity" when median = 0 |
| 5 | Static-source (industrial/flare) detections shown hollow with a count | Ember Atlas (`static_mask.bin`, `industrial` flag) | Use the science team's mask; toggle "include static sources"; count in tooltip | M | yes if the mask comes from the team; show "N masked", never hide silently |
| 6 | "Top most intense days/cells" list that flies the map to the hex | BurnCal (`TopFires`), FireLens (top cell-days) | Top 10 by summed FRP for the selected month; row click selects the hex and its calendar | S | yes: label "intensity by FRP (MW)", status per row, preliminary flag |
| 7 | Year-to-date vs baseline plus percentile tile | FireLens (`summary.ytd_*`, `percentile`, `status`) | Server-computed from `cell_month`, target year excluded, n >= 10; one line next to the ratio headline | S | yes: show n and "preliminary" after the last SP date; no z-score wording that implies a tested distribution |
| 8 | One-line validation strip from delivered files | Ember Atlas (`calibration` block), Terrascope ("did not pass the check on the past") | Read fit/test period and error figures from the team's `meta.json`; if absent show "validation not delivered"; hide any outlook without a backtest | S | yes: cite as the team's numbers with the file version; never compute our own "confidence %" |
| 9 | Fast first paint: tile-free basemap option, lazy MapLibre, immutable hashed assets, split routes | Terrascope (GeoJSON fill style, `immutable` assets, lazy routes), FireLens (separate maplibre chunk) | Budget in `perf-budget`; measure LCP on a throttled 4G profile | S | n/a (performance), but the map must never delay the calendar that carries the honest statuses |
| 10 | Russian first, Tajik second, with reviewed status labels | Terrascope (en + ru found); no site ships tg | `lang` per route; native-speaker review of the five status words and the "detections are not fires" line | M | yes: no machine-only status labels; if tg is unreviewed, ship ru + en and say tg is pending |

Not copied, with reason: AI/prediction pages (Ember Atlas forecast, Terrascope `/api/ai/ask`) and 3D globes (docs/PROJECT_RULES.md "Do not"); live FIRMS from the browser or a key in the bundle (BurnCal); a monolithic history download (Ember Atlas, 14.7 MB gzip); unpinned `@master` CDN data (FireLens); per-visit tracking without a visible consent step (Terrascope `/api/visit`, consent UI not verified). FireLens's bbox-as-country is the most exploitable weakness for a Tajikistan demo: an area clipped to the border, with a real status per cell, is something none of the four shows.

### 8.8 Not verified (this section)
Rendered screens and motion on all four; Ember Atlas "Fire Calendar" tab internals and forecast accuracy; FireLens language list, API cache headers and weekly-calendar UX; BurnCal flat-map renderer and `period` units; Terrascope default `TJK` view and its data endpoints; accessibility of any of the four; licences and repos of any team.
