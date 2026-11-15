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
