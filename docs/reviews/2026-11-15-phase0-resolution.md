# Phase 0 — resolution of review findings (2026-11-15)

Reviews: [code](2026-11-15-phase0-code-review.md) · [science](2026-11-15-phase0-science-review.md).
Both first passes: CHANGES REQUESTED.

## Fixed

| Finding | Fix | Evidence |
|---|---|---|
| Code B1 / Science B1 — months after `nrt_through` were `preliminary`, so absent rows read as 0 | `statusOf`: month starting after `nrt_through` → `no_data` | `tests/unit/status.test.ts` "B1" |
| Science B2 / Code M3 — partial month compared with full-month median | `monthCoverage()`; `ratioToMedian` returns `partial_month` (no ratio) and keeps partial months out of baselines | `status.test.ts` "monthCoverage", `baseline.test.ts` "B2" |
| Science M2 — month straddling the SP date was `final` | `statusOf`: month ending after `standard_processing_through` → `preliminary` | `status.test.ts` "M2" |
| Science M3 — copy hid MODIS-only estimate years in the baseline | `baselineNote()` | `baseline.test.ts` "M3" |
| Code M1 — `HonestValue` could be forged with a spread | class with a private `#brand` and private constructor; validation inside the constructor | `tests/unit/honest-brand.test.ts` (`@ts-expect-error`) |
| Code M2 — absent month treated as no_data although storage is sparse | `buildMonthSeries()` fills real zeros only in observed months; `ratioToMedian` rejects duplicates | `tests/unit/series.test.ts` |
| Code M4 — re-running an old version silently rolled production back | existing inactive version is a no-op; rollback needs `--activate`; advisory lock + re-check inside the transaction | run against embedded Postgres, scenarios 2, 4, 5 |
| Code M5 — mock regions leaked into real data | delivered region set replaces the previous one; `regions.geojson` is required; `mock-*` refused when real data exists (`--allow-mock`) | same run, scenario 6 |
| Code M7 — e2e on protected Vercel previews would get 401 | Playwright sends `x-vercel-protection-bypass` from `VERCEL_AUTOMATION_BYPASS_SECRET` | `playwright.config.ts`, `ci.yml` |
| Code M8 — the contract gate had no failure-path tests | 19 failure cases on generated Parquet | `tests/unit/contract.test.ts` |
| Science m5 — no "median after aggregation" test | added | `baseline.test.ts` "m5" |
| Minor — Infinity and negative `lo` passed the validator; blank note accepted; CI cancelled runs on `main`; bbox via spread | fixed | `contract.test.ts`, `honest-brand.test.ts`, `ci.yml`, `ingest.ts` |

## Not fixed in Phase 0

| Finding | Why | When |
|---|---|---|
| Code M6 — ingest reads `cell_month` into memory | Fine for the pilot/mock size; real fix is COPY into a staging table | Before the first continental delivery; documented in `scripts/ingest.ts` |
| Code M8 (second half) — automated ingest test on embedded Postgres | Verified by hand (6 scenarios); automating adds a test dependency | F07 |
| Science M1 — threshold for "too few observed days" | Needs a number from the science team (Q2). Today: any day unobserved → no ratio, out of baseline | Before F03 |
| Science M4 — near-zero median gives extreme ratios | Needs a noise floor from the science team (Q5); we do not invent one | Before F03 |
| Year total for the current year is blank | Product decision: add a labelled "Jan–Nov so far" value or not | Before F02 |
| `region_month` has no `processing` column; `source_mode` dropped at ingest | Status comes from meta; schema change needs a decision | F02 design |
| SPEC F03 example says "24 Novembers (2003–2025)"; that range is 23 years | The code prints the real n and range; SPEC text is the owner's to correct | — |
| honest-labels skill lists 6 status rules; the code now has 7 (stricter) | Skill text is the owner's to update | — |

## Questions for the science team

Listed in full in the science review, section "Questions for the science team" (Q1–Q10).
Q1–Q7 and Q9 are needed before F02/F03.

## Second pass — both APPROVE

Code review: APPROVE · Science review: APPROVE (see the "Second pass" section of each report).

Carried into Phase 1 (each must be closed before the feature named):

| Item | Close before |
|---|---|
| Science M1 (observed-days threshold, Q2) and M4 (minimum-median floor, Q5) | F03 |
| F03 shows `baselineNote()` next to every ratio headline and in the CSV method field | F03 |
| N2 / m-2a — make `MonthPoint.coverage` required so a hand-built series cannot skip the partial-month check | F03 |
| N1 — year totals ignore partial coverage | F02 year totals, F04 trend |
| N3 — "N of M days" in tooltips and CSV for partial months | F02, F05 |
| m-2f — `toPlain` / `fromJson` for `HonestValue` across the server→client boundary | F02 |
| N4 / m-2d — validator rejects rows in no_data months; `regions.geojson` and `lo ≥ 0` written into DATA_CONTRACT.md | next delivery |
| m-2b — removing a region cascades to older versions' `region_month`; m-2c — rollback branch takes the advisory lock | F01 |
| Code M6 — COPY-to-staging ingest (or abort above ~3 M rows) + automated PGlite ingest test | first non-pilot delivery, at the latest F07 |
