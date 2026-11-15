# Science-integrity review: Phase 0 (domain logic, ingest, validator, fixture, copy)

Date: 2026-11-15 · Reviewer: science-integrity reviewer · Spec: docs/PROJECT_RULES.md rules 2–4, docs/SPEC.md F02–F06,
docs/DATA_CONTRACT.md, docs/PROJECT_RULES.md

Verdict: CHANGES REQUESTED

## What I checked and confirmed independently
I wrote a throwaway script (scratchpad, deleted afterwards) and checked these against the real modules:
- `statusOf`: 2000-01…10 give no_data and 2000-11 gives estimate. A month after today gives future. A leap
  February 2016 missing on all 29 days gives no_data, but missing on 28 of 29 days gives final. A month with no
  active platform (all coverage ended) gives no_data. The rule order matches the skill.
- `ratioToMedian`: the target year is excluded, only final|estimate in the window count, n < 10 gives no ratio,
  median = 0 gives no ratio. The percentile rank uses the mid-rank (ties count half), checked by hand. Rounding is
  `Math.round(x*10)/10`.
- `mannKendall`: matches my own code exactly on a 15-point series with ties: S = 78, Var(S) = 404.667 with the
  tie correction, z = 3.8277 with the continuity correction. Two-sided p from the code is 1.29373e-4; exact
  erfc gives 1.29327e-4.
- `normalCdf` (A&S 7.1.26): largest absolute error in the upper tail over z in [0, 6] is 7.0e-8, so the p error is
  at most 1.4e-7. This is consistent with the stated erf error bound of 1.5e-7. Relative error of p: 3e-7 at
  z=1.645, 2.8e-6 at z=1.96, 1.2e-4 at z=3.29, 9.2e-4 at z=4.5, 1.6e-3 at z=5.
- `theilSen`: the slope is the median of pairwise slopes and the intercept is the median of y − b·x (Conover). Correct.
- No hard-coded data dates in app/, components/, lib/, server/. Every data date comes from meta.json, and the
  only literals are in comments. No "number of fires", "prediction" or "confidence %" wording anywhere.
- `sumHonest` never turns a missing part into 0. 2026 gives `{value: null, status: future, note: "10 of 12 parts observed"}`.

The core types are sound: `honest()` / the brand / `worstStatus`. The findings below are about what the status
logic does **not** know yet: how many days of a month were actually observed.

---

## BLOCKER

### B1. `statusOf` ignores `nrt_through`: months with no NRT data yet render as preliminary zeros
- Where: lib/domain/status.ts:33-43 (no reference to `meta.nrt_through`), docs/DATA_CONTRACT.md:47 (no row
  means 0 if the month is covered), scripts/ingest.ts:218-225 (region_month only has rows that exist).
- Verified: meta with `nrt_through = 2026-10-20`, today = 2026-11-15 gives `statusOf(2026, 11) = 'preliminary'`.
  The delivery has no November rows. Under the sparse rule an observed month with no rows is 0.
- Misleading outcome: this happens to every delivery as it ages. On 1 December, December becomes
  "preliminary" with value 0 in every cell and every country, and its ratio reads "×0.0 vs median of 23
  Decembers". An emergency manager reads "no burning at all this month (preliminary)" when in fact nobody
  has looked. This is exactly the no_data-as-zero failure that rule 3 forbids.
- Fix: in `statusOf`, between rules 2 and 3, add: month start > `meta.nrt_through` gives `no_data` (note "not yet
  delivered"). Better, return a distinct reason so the UI can say "awaiting data". Add tests: nrt_through lag
  across a month boundary; today in a month after nrt_through.

### B2. Partly observed months (current month, the month that contains `nrt_through`) are compared with full months
- Where: lib/domain/status.ts:37 (`start > today` is the only test of the in-progress month),
  lib/domain/baseline.ts:81-158 (no notion of observed days), scripts/make-fixtures.ts:222,239 (the fixture
  itself scales Nov 2026 by 14/30 observed days).
- Verified: November 2026, observed 1–14 Nov, on track with a median of 12 for a full November: half-month
  value 6 gives "×0.5 vs median of 23 Novembers (2003–2025) (preliminary)" and percentile P0.
- Misleading outcome: during an active fire month the headline metric says "half of normal, lowest on record".
  Escalation is held back while the month is still running. The SPEC F03 example headline is literally
  "November 2026 — ×1.8 … preliminary" on the date of this review. A "preliminary" label does not tell the
  user that half the month is missing; it only says the numbers may be revised.
- Fix: (1) Add `observedDays(year, month, meta, today)` to the domain. This is the days in coverage of at least
  one platform, up to min(today, nrt_through), not in missing_days. The fixture already has this logic at
  scripts/make-fixtures.ts:86-98, so move it into lib/domain. Expose it on every cell as a note ("14 of 30
  days"). (2) `ratioToMedian` must refuse a partial target (`kind: 'partial_month'`) unless a same-period
  baseline exists (1–14 Nov of each baseline year). That needs daily or pentad data from the science team, see
  Q1. (3) The default month in F03 is "the last complete month", computed from `nrt_through`, not from today.
  (4) Tests: current month, the nrt_through month, today = the 1st of a month.

---

## MAJOR

### M1. A month is "missing" only if every day is missing: a month with 30 of 31 days lost is `final`
- Where: lib/domain/status.ts:9-18 (`isMonthFullyMissing` is all-or-nothing).
- Verified: 2014-03 with 30 of 31 days missing on MODIS and S-NPP gives `final`. MODIS start set mid-month
  (2000-11-15) gives 2000-11 as plain `estimate`. Jan 2012 with MODIS missing all month and S-NPP only from
  the 20th gives `final`, with 12 observed days.
- Misleading outcome: a month that is 97% unobserved shows a tiny count labelled "final", and the ratio
  reads ×0.0–×0.1 "final". The skill's literal rule is satisfied, but the user is still misled. Real FIRMS
  outages are multi-day (e.g. S-NPP safe-mode periods), so this case is not hypothetical.
- Fix: use the same `observedDays` as B2. Below a threshold agreed with the science team (Q2, e.g. under 90% of
  days observed), carry a note ("26 of 31 days observed"), keep the month out of the baseline, and refuse
  the ratio. Below a lower threshold, treat it as no_data. If the science team already normalises for missing
  days, meta must say so (new field) and only the note remains. Add tests for each case above.

### M2. A month that straddles the SP date is labelled `final`; region totals lose the processing flag
- Where: lib/domain/status.ts:40 (`monthStart > standard_processing_through`), scripts/lib/contract.ts:201-203
  (validator uses the same month-start rule), scripts/ingest.ts:218-225 (region_month has no `processing`
  column, db/schema.ts region_month).
- Verified: SP = 2026-06-15 gives June 2026 `final`, although 15 of its 30 days are NRT and will change.
- Misleading outcome: "final" promises the number won't change. After the next delivery it does change,
  and users who exported or cited it lose trust. Countries cannot even fall back on the per-row `processing`
  because region_month drops it.
- Fix: use month END > SP to mean preliminary, in both `statusOf` and the validator. Carry `processing`
  (NRT if any contributing row is NRT) into region_month as well, and give any month whose rows are NRT the
  worst-of status. Add tests at the SP boundary (SP on the last day, first day, mid-month). See Q3.

### M3. The ratio copy hides that 9 of 23 baseline years are MODIS-only estimates
- Where: lib/domain/baseline.ts:152-156 (status = target status), 164-177 (`ratioCopy` never uses
  `baselineEstimateYears`).
- Position on the design question: giving the ratio the TARGET's status is acceptable. The status tells
  the user how settled the target month is. If the ratio took the worst of target and baseline, every ratio
  against 2003–2025 would be "estimate" forever and the label would carry no information. But the baseline
  then has to be disclosed in the copy, not only in an API field. 39% of the median's support is scaled
  MODIS. If the harmonization is biased low or high for that month, every ratio shifts and nothing on
  screen says so. This seam is the core uncertainty of the whole challenge.
- Misleading outcome: "×1.8 vs median of 23 Novembers (2003–2025) · final" reads as a VIIRS-to-VIIRS
  comparison.
- Fix: when `baselineEstimateYears > 0`, `ratioCopy` (and the tooltip and the CSV `method` field) adds
  "· baseline includes 9 MODIS-only estimates". Offer a VIIRS-only baseline (2012–2025, n = 14, at least 10) as a
  sensitivity check. If the two ratios disagree beyond the harm_lo/hi range, show both. Add a test asserting the
  copy. See Q4.

### M4. A near-zero median gives explosive ratios; only median = 0 is handled
- Where: lib/domain/baseline.ts:142-157.
- Verified: baseline Novembers alternating 0.1 / 0.2 fire-days gives median 0.1, and target 3 gives
  "×30.0 vs median of 23 Novembers". Harmonized values are continuous (log-linear back-transform), so exact
  zeros are rare and tiny medians are common in dry or sparsely burning AOIs and off-season months.
- Misleading outcome: a "×30" headline for three cell-days of fire in a desert AOI in winter. Emergency
  managers sort and alert on the ratio, so this is a false alarm generator.
- Fix: a minimum-median rule, with a floor that comes from meta (agreed with the science team, Q5, e.g.
  median under 1 harmonized fire-day, or below the harmonization noise floor). Under the floor: no ratio, show
  absolute value + percentile + "little usual activity in this month". Put the floor in meta, not in code.
  Add a test.

---

## MINOR

- m1. **"×0.0" for small non-zero activity.** lib/domain/baseline.ts:153. Target 0.6 against median 12 gives
  "×0.0", which reads as "nothing burned". Render "<×0.1" when 0 < ratio < 0.05. Test it.
- m2. **Percentile wording.** baseline.ts:140. The mid-rank definition is correct (checked). P100 / P0 with
  n = 10–23 is coarse: prefer "highest of 23 Novembers" / "lowest of 23" at the extremes, and always show n.
- m3. **p-value display.** lib/domain/stats.ts:36-44. The A&S 7.1.26 accuracy is adequate: measured absolute
  error in p is at most 1.4e-7, and relative error is under 0.1% for z up to 4.5. Display p to 2 significant
  figures and floor at "p < 0.001". The tests (tests/unit/stats.test.ts:5-12) check only 5 decimals and do not
  test the claimed bound. Add a reference-value test at z = 3.29 and 4.5 with a relative tolerance.
- m4. **F04 trend requirements (carry forward; no caller exists yet).** stats.ts:17-30, 64-87 are correct but
  nothing enforces "complete years only". Add a domain function that builds the annual series only from years
  whose 12 months are all final|estimate, and test that 2000 (Nov–Dec only) and 2026 drop out. Also:
  (a) the series crosses the 2012 MODIS-to-VIIRS seam, and 2001 to mid-2002 is Terra-only. Label the trend with
  "n estimate years" and offer the 2012+ trend as a sensitivity check. (b) MK assumes independence, and annual
  fire series are often autocorrelated. Ask the science team whether to apply a Hamed–Rao variance correction
  (Q8). (c) The Theil–Sen intercept is at x = 0 (year 0, e.g. −866.5). Report slope per year and the fitted
  value at a stated anchor year.
- m5. **"Median after aggregation" has no test.** SPEC F03 acceptance requires one. Aggregation lives in SQL
  (scripts/ingest.ts:218-225) and in a future AOI service. Add a pure aggregator in lib/domain and a test
  where median-of-sums differs from sum-of-medians.
- m6. **harm_lo / harm_hi summed across cells.** scripts/ingest.ts:137,146-147,221. Summing bounds is
  the interval under perfect positive correlation (comonotone). It is exact if the uncertainty comes from a
  shared per-month harmonization coefficient, which is likely for a log-linear per-month method. It is far
  too wide if per-cell errors are independent (width should then grow like the square root of N, not N).
  Either way it is not a "95% CI" of the sum. Label it "range (sum of cell bounds)" until Q6 is answered.
  'NRT if any child is NRT' is correct: it is the worst-of rule.
- m7. **Validator gaps.** scripts/lib/contract.ts:145-170, 239-250. Add these checks: `fire_days_harm_lo >= 0`;
  `fire_days_harm <= daysInMonth` per cell (a cell cannot have more fire-days than days, assuming Q7 confirms
  the unit); `det_viirs_raw = 0` and `source_mode = 'modis_only'` for months entirely before the first VIIRS
  coverage start (guards against raw/harmonized mixing); no rows in a month that meta declares fully missing;
  detection totals compared per instrument (MODIS vs VIIRS separately) and per h3, not only the combined
  monthly sum; detections `processing` consistent with the cell_month row.
- m8. **Day convention must be written down and reused in export.** contract.ts:60. Matching by
  `local_solar_date` is the right convention for "fire-days" IF cell_month was aggregated the same way (Q9).
  The F05 `detections.csv` must select detections by the month of the same field, or summary.csv and
  detections.csv disagree at month edges. Put the convention in `meta.harmonization`.
- m9. **Mock labelling.** The fixture is well labelled: `mock-*` version, method "MOCK — synthetic…",
  region names "(fixture)", user-assigned codes ZZA/ZZB/ZZC. Remaining risks: `isMockDataset` checks only the
  version prefix (lib/domain/meta.ts:66), so also test `harmonization.method` starting with "MOCK". The badge
  exists only in the banner (components/dataset-banner.tsx:29). Calendar, charts, share images and every
  export (metadata.json + a `dataset_version` column) must carry "MOCK DATA" too, because screenshots lose
  the banner. The bbox overlays real Central Asian countries: if `regions.geojson` is ever omitted, the
  documented geoBoundaries fallback would join real country names (KAZ, UZB…) to mock values. Forbid that
  fallback for mock versions.
- m10. **SPEC example arithmetic.** docs/SPEC.md:25 says "24 Novembers (2003–2025)", but that range has 23 years.
  The code is right to print the real n and range (baseline.ts:174). Fix the SPEC text.
- m11. **`honest()` null-with-note is free text.** lib/domain/honest-value.ts:46-48. Acceptable (question d),
  but restrict it: allow null with an observed status only via a closed reason enum ('insufficient_baseline',
  'no_usual_activity', 'partial_aggregate', 'partial_month'). Then "null, final, note: 'tbd'" cannot
  slip through for `fire_days_harm`.
- m12. **Status legend copy.** app/page.tsx:5-11. "preliminary: Near real-time data…" should add "may cover
  only part of the month" (after B2). "estimate" could add "Terra-only before mid-2002" if the science team
  confirms that distinction matters (Q10).
- m13. **Unit wording for AOI sums.** A country total of "harmonized fire-days" is a sum of cell-days and can
  exceed 31 for a month. Copy must say "harmonized fire-days (cell-days, VIIRS-equivalent)" or similar, so
  "412 fire-days in November" is not read as calendar days (Q7).
- m14. **Region membership by cell centroid.** scripts/ingest.ts:202 (`polygonToCells` = centre containment)
  drops border and coastal r6 cells whose centre lies outside the polygon. Small effect at r6 (~36 km2), but
  state it in export metadata.

---

## Positions on the author's open questions
- a) **Year totals with future/no_data months.** Keep `value: null` for the official year total. Do not let a
  partial sum into the ranking, trend, anomaly or colour scale. Showing a separate, clearly labelled
  "Jan–Nov so far (11 of 12 months, preliminary)" is acceptable as a different kind of value
  (`kind: 'partial'`), with its own visual style and never coloured on the year-total scale. For 2000 (2 of 12
  months), show nothing, or "Nov–Dec only". This is a product decision, not a science-team question.
- b) **SP straddle.** Change to month end > SP (M2). Ask the science team (Q3) whether SP always ends on a
  month boundary and whether a cell_month row can mix SP and NRT days.
- c) **"24 Novembers".** The code is correct; fix the SPEC (m10).
- d) **null with an observed status.** Acceptable with a closed reason enum (m11).

## Questions for the science team
Questions in **bold** must be answered before F02/F03.

1. **(before F03)** Can you deliver daily (or pentad) cell totals, or at least the per-month count of observed
   days per platform? Without them a partial current month cannot be compared with the same period of past
   years (B2).
2. **(before F02)** Do your monthly cell values normalise for missing days or partial platform coverage, or are
   they raw sums over observed days? What share of observed days do you consider a month valid (M1)?
3. **(before F02)** Is `standard_processing_through` always the last day of a month? Can one cell_month row
   contain both SP and NRT days, and which `processing` value does it get then (M2)?
4. **(before F03)** Is the harmonization good enough for 2003–2011 estimates to enter the same-month median, or
   should the default baseline be VIIRS-only (2012–2025)? Is there a per-month validation error we can show (M3)?
5. **(before F03)** What is the noise floor of a harmonized monthly value? Below what median should a ratio not
   be shown (M4)?
6. **(before F02 tooltips / F05)** What do `fire_days_harm_lo/_hi` represent (CI level? quantiles? coefficient
   uncertainty only?), and are errors correlated across cells within a month? Can we sum them (m6)?
7. **(before F02)** Exact unit definition: is a cell's fire-day value bounded by the number of days in the month?
   What is the correct name for a sum over cells (m7, m13)? Is the log-linear model fitted at cell-month scale,
   and is the sum of back-transformed cell values unbiased at AOI/country scale (retransformation bias)?
8. (before F04) Is the annual series autocorrelated enough to need a modified Mann–Kendall (Hamed–Rao or
   pre-whitening)? Should the trend default to complete VIIRS years only (m4)?
9. **(before F02)** How is `local_solar_date` defined (UTC + lon/15 h?), and was cell_month aggregated by it?
   Does a ~01:30 night overpass count toward the same fire-day as the preceding ~13:30 overpass, or the next
   day (m8)?
10. (before F04) Terra-only months (2000-11 to ~2002-07): are they harmonized with the same chain as Aqua?
    Should they carry an extra note or be excluded from the trend?

---

# Second pass (fixes in `git diff 07ad660 HEAD`)

Verdict: APPROVE

Approved for the Phase 0 gate. No BLOCKER and no new MAJOR remains. M1 and M4 stay open as tracked
science-team questions and must be closed before F03 ships (see "Gate conditions").

Scope read: `lib/`, the resolution note, and the unit suite (117 tests, green). I re-verified with my own
throwaway script (deleted afterwards). I did not read the `scripts/lib` or test diffs line by line.

## Fixes verified
- **B1 fixed.** `nrt_through = 2026-10-20`, today 2026-11-15: November is `no_data` and `buildMonthSeries`
  gives value null, not 0. October is `preliminary` with coverage 20 of 31. With `nrt_through = 2026-10-31`,
  October is 31 of 31 and November is `no_data`. With `nrt_through = 2026-11-01`, November is `preliminary`,
  1 of 30. No boundary mislabel found.
- **B2 fixed.** November 2026 (14 of 30 days) gives `partial_month`, no ratio, no percentile, copy "partial
  month: 14 of 30 days observed", status preliminary. Partial months are kept out of baselines.
- **M2 fixed in `statusOf`.** SP = 06-30: June `final`, July `preliminary`. SP = 06-15 or 06-29: June
  `preliminary`, May `final`. Preliminary still wins over estimate. The validator keeps the month-start rule
  pending Q3; that is acceptable because it only checks the delivery, and the label users see is now the
  stricter one.
- **M3 fixed.** `baselineNote()` gives "baseline includes 9 MODIS-only estimate years of 21". It is a separate
  string, so F03 must render it next to the headline (gate condition 3).
- **Sparse zeros.** With no rows at all: 2000-10 is null/no_data, 2005-07 is 0/estimate, 2026-12 is future.

## Does excluding partial months silently shrink baselines?
No, it is not silent, and the direction is safe. With one all-platform gap day in November 2015, a 2025 target
gives "×1.0 vs median of 21 Novembers (2003–2024)": the real n is printed and 2015 is dropped. If enough years
drop, the result is "insufficient baseline", never a wrong ratio. The printed year range does not say which
year inside it was dropped; list excluded years in the tooltip (minor).

## Is the interim M1 rule safe?
Yes. "Any unobserved day means partial, no ratio, out of the baseline" can only withhold a number, never show a
wrong one. Checked cases:
- Jan 2012 normal (MODIS all month, S-NPP from the 20th): 31 of 31, not partial. Correct.
- Jan 2012 with MODIS missing all month: 12 of 31, partial, no ratio.
- MODIS start mid-month (2000-11-15): 16 of 30, partial.
- One day missing on one platform only (Feb 2016, S-NPP): 29 of 29, not partial. Correct.
- One all-platform gap day (Nov 2015): 29 of 30, no ratio for that month. This is over-strict, and Q2 should
  relax it, but it is honest.

Limit of the interim rule: a day counts as observed if any one platform saw it. A VIIRS-era day seen only by
MODIS counts as observed. Whether the harmonized value is still valid then is part of Q2.

## Remaining findings (all MINOR; none blocks the gate)
- N1. **Year totals ignore coverage.** lib/domain/honest-value.ts `sumHonest`. Verified: `nrt_through =
  2026-12-20`, today 2027-01-05 gives a 2026 year total with a number and status `preliminary`, although
  December has 20 of 31 days. A year with a partial month must not get a plain year total or enter the F04
  trend. Fix before F02 year totals: sum `MonthPoint`s, and withhold or label the total when any month is
  partial.
- N2. **`coverage` is optional and absent means "fully observed".** lib/domain/baseline.ts:8-17. Verified: a
  hand-built series without `coverage` reproduces the old B2 result ("×0.5 … (preliminary)"). The safe default
  is the other way round. Make `coverage` required on `MonthPoint` (tests can use a helper) before F03.
- N3. **Partial months still show a status but no flag on the cell.** A `final` cell with 12 of 31 days looks
  like any other final cell unless the UI reads `coverage`. F02 tooltips and the CSV must show "N of M days".
- N4. **`buildMonthSeries` throws on a row inside a no_data month** (series.ts:40-42). Correct to refuse, but
  the validator should reject such a delivery first (m7, still open), so the calendar cannot crash at runtime.
- Still open from the first pass and tracked: m1, m2, m3, m4, m6, m7 (rest), m8, m9, m10, m12, m13, m14;
  `region_month.processing`; the labelled year-to-date total (product decision).

## Gate conditions
1. **M1 may stay open** for the Phase 0 gate. The interim rule is safe. Close it with Q2 before F03.
2. **M4 may stay open** for the Phase 0 gate, because nothing renders a ratio yet. It must be closed before
   F03 ships: without a minimum-median floor from the science team (Q5), "×30 vs median" for a near-zero
   median is still produced (not re-tested; the code path is unchanged). Do not invent the floor.
3. F03 must render `baselineNote()` wherever the ratio headline appears, including the CSV method field.
4. N1 before F02 year totals; N2 before F03.
5. Q1–Q7 and Q9 go to the science team now; they are needed before F02/F03.
