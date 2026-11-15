# Science-integrity review: Phase 1 UI skeleton (calendar, headline, yearly charts, summary.csv)

Date: 2026-11-15 · Reviewer: science-integrity reviewer · Branch: feat/phase1-skeleton
Spec: docs/PROJECT_RULES.md rules 2–5, docs/SPEC.md F02–F05, docs/DATA_CONTRACT.md, and the gate conditions of
docs/reviews/2026-11-15-phase0-science-review.md (second pass).

Verdict: CHANGES REQUESTED

No BLOCKER. Four MAJOR findings. Two of them are Phase 0 gate conditions that were due "before F03 ships"
and F03 now renders.

## Method and limits
Read from code and tests only, as instructed. Nothing was executed: no script, no test run, no build, no
screenshots. Every statement below is derived by reading the listed lines; none is a measured result.
Files read: lib/domain/calendar.ts, baseline.ts, honest-value.ts, series.ts, stats.ts, lib/format.ts,
components/metric/headline.tsx, components/calendar/{legend,burning-calendar,palette},
components/explorer/explorer.tsx, components/charts/yearly-charts.tsx, components/export/export-panel.tsx,
server/services/calendar-service.ts, app/api/export/summary/route.ts, tests/unit/calendar.test.ts.
Not read: lib/domain/status.ts (unchanged logic assumed from Phase 0), aoi-map, aoi-picker, dataset-banner.

## Confirmed correct
- Every cell carries `s`; headline, tooltip, aria label and year-total title all print the status label.
  `Headline` rebuilds `honest()` values on the client (headline.tsx:12-13).
- no_data / future never become 0 in the grid: `h`, `lo`, `hi`, `rm`, `rv` are null (calendar.ts:192-196),
  `cellLook` checks status before colour (palette.ts:41-42), tooltip says "No observations — not zero"
  (burning-calendar.tsx:532), CSV writes empty cells (calendar-service.ts:96-98) and skips future months.
- Partly observed months: no ratio, no percentile, out of every baseline and out of the month medians
  (baseline.ts:128,154-163; calendar.ts:235). Corner marker, legend entry, tooltip, aria label and the CSV
  columns `observed_days` / `days_in_month` are present.
- Default selected month is the last fully observed month with a value (calendar.ts:257).
- Ratio: median after AOI aggregation, target year excluded, n ≥ 10, median = 0 handled, real n and years in
  the copy, `baselineNote()` rendered under the headline (headline.tsx:18-19,59).
- Trend: only years with 12 fully observed months and status final | estimate (calendar.ts:282-284).
  A fully observed but still preliminary year keeps its bar and is marked "not in trend".
- Wording: "harmonized fire-days", "raw detections"; no "number of fires", no prediction. Raw mode carries
  the warning about the VIIRS jump. Data dates in status logic come from meta.

## Phase 0 open items
- N1 (year totals with a partial month): fixed, calendar.ts:147-161. Not tested for its own path, see m1.
- N2 (`coverage` required): fixed, baseline.ts:13.
- N3 (partial marker in UI and CSV): fixed.
- Gate condition 2 (minimum-median floor before F03): NOT met, see M1.
- Gate condition 3 (`baselineNote` in the CSV): NOT met, see M4.
- Not made worse: m2, m6, m13 are now visible on screen but unchanged (see minors).

---

## MAJOR

### M1. Near-zero median still gives explosive ratios, and the UI now shows and colours them
- Where: lib/domain/baseline.ts:175-193 (only `med === 0` is handled); components/metric/headline.tsx:20-27,
  34-35 (the whole headline turns ember at ratio ≥ 1.25); components/calendar/palette.ts:45 (darkest orange
  class ≥ ×4); server/services/calendar-service.ts:117 (`ratio_to_median` exported).
- Misleading outcome: an AOI whose baseline Novembers alternate 0.1 / 0.2 harmonized fire-days and has 3 this
  November reads "×30.0 vs median of 23 Novembers" in large ember type, with the darkest cell in ratio mode
  and 30 in the CSV. This is Phase 0 M4, gate condition 2: "must be closed before F03 ships". It was
  harmless while nothing rendered a ratio; now it is the headline. Emergency managers sort and alert on it.
- Fix: the floor must come from meta, agreed with the science team (Q5). Do not invent it. Until it exists:
  (a) do not colour the headline by ratio; (b) put the absolute numbers in the headline sentence itself,
  e.g. "×30.0 (3 vs usual 0.1 harmonized fire-days)", not only in the small line below; (c) record the open
  gate in the PR. When the floor arrives: below it return a new kind (`low_usual_activity`), show absolute
  value + rank, and the cell uses the "no ratio" look. Add a test.

### M2. The trend section answers "Is burning increasing?" with a slope whatever the test says
- Where: components/explorer/explorer.tsx:230-245; lib/domain/calendar.ts:306-313; components/charts/
  yearly-charts.tsx:110-123.
- Three separate problems:
  1. The sentence is the same for p = 0.6 and p = 0.001: "+3.2 fire-days / year · Mann–Kendall p = 0.6".
     Under a heading phrased as a question, a reader without statistics takes the signed slope as "yes".
     The trend line is drawn solid ember in both cases.
  2. A trend is returned from 2 points up (calendar.ts:307), while `mannKendall` gives p = null below n = 10
     or for a constant series. The UI then prints a slope with "Mann–Kendall not computed". A slope without
     a test breaks the rule "p-value shown". n shrinks whenever meta lists all-platform gap days, because
     any partial month removes its year.
  3. The seam label "Includes MODIS-only estimate years before 2012" is true but too weak for the central
     question of this project. It gives no count (11 of 25 in the fixture), and a harmonization bias at the
     2012 seam appears as a trend. Phase 0 m4(a) asked for the count and a VIIRS-only sensitivity trend.
- Fix: (1) neutral heading, e.g. "Yearly burning activity and trend". Add a plain sentence from the test:
  p ≥ 0.05 → "No statistically detectable trend (p = 0.6, n = 25)" and draw the line dashed and grey;
  p < 0.05 → "Upward/downward trend in harmonized fire-days". The 0.05 level is a convention: state it in
  the copy. (2) Return `trend: null` when n < `MIN_MANN_KENDALL_N` or p is null; copy "Not enough complete
  years for a trend (n of 10)". (3) Say "includes 11 MODIS-only estimate years of 25" (count from the
  series), and compute the same fit for complete `final` years only; show both slopes and p-values when
  that subset has n ≥ 10. Tests for each.

### M3. In the yearly charts a withheld year looks exactly like a year with zero burning
- Where: components/charts/yearly-charts.tsx:100-108 (`value: p.total`, null → no bar), 154-155 (same for
  anomalies); components/explorer/explorer.tsx:241 ("Incomplete years (grey) are not in the trend").
- Misleading outcome: 2000 and 2026 (and any year with a gap month) are empty slots on a value axis that
  starts at 0. An empty slot and a zero-height bar are the same picture, so the current year reads as "no
  burning in 2026". Only the hover tooltip says otherwise. The sentence promises grey bars, but grey is
  used only for fully observed preliminary years; withheld years have no mark at all. The calendar margin
  does this correctly (hatched placeholder, burning-calendar.tsx:397-405); the chart does not. This is rule
  3 (no data ≠ zero) in chart form.
- Fix: draw withheld years as a hatched full-height band (markArea or a background bar with the no-data
  pattern) with "—" above it, in both charts. Change the sentence to "Hatched years are incomplete and have
  no total; grey years are preliminary. Neither is in the trend." Update the two `aria-label` texts too.

### M4. summary.csv cannot be read on its own
- Where: server/services/calendar-service.ts:79-94,103-129; app/api/export/summary/route.ts:18-25;
  components/export/export-panel.tsx:22-25 (metadata.json is deferred to ADR 0002).
- Missing from the only export that works today: units (`harmonized` and `percentile` are bare names),
  `dataset_version`, method, the AOI, the baseline actually used per row (`n`, first and last year, number
  of MODIS-only estimate years — Phase 0 gate condition 3), the export date and the FIRMS acknowledgement.
  The dataset version exists only in the file name, which is lost on the first rename or paste into a
  spreadsheet. A mock delivery therefore exports rows with nothing in them that says MOCK (Phase 0 m9).
- Misleading outcome: a forwarded CSV shows "ratio_to_median 1.8, status final" with no way to see that 9
  of the 22 baseline years are scaled MODIS, which dataset produced it, or that it is synthetic.
- Fix: add columns `dataset_version`, `baseline_n`, `baseline_from`, `baseline_to`,
  `baseline_estimate_years`; rename to `harmonized_fire_days`, `harm_lo_fire_days`, `harm_hi_fire_days`,
  `raw_modis_detections`, `raw_viirs_detections`, `percentile_rank`. Carry method, AOI, export date and the
  acknowledgement either as `#` preamble lines or by shipping metadata.json together with the CSV now, not
  after ADR 0002. Update SPEC F05 to match. Add a unit test for `summaryCsv` (none exists): a no_data row
  has empty value cells and never "0"; a partial row has a value, empty ratio and the note; future months
  are absent.

---

## MINOR

- m1. **N1 path is untested.** tests/unit/calendar.test.ts:74-80 covers 2000 and 2026, which are null
  because months are missing (`sumHonest`), not because of the new partial rule (calendar.ts:152-160). Add:
  one all-platform gap day in 2015 → 2015 total null with note "1 partly observed month", `complete`
  false, trend n = 24.
- m2. **Quantile colours per AOI.** calendar.ts:112-122; legend.tsx:64-65. The legend says "(classes of
  this area)" and prints the ranges, which is honest for one area. Two calendars side by side are not
  comparable by colour: quantiles spread the full palette over every area, so an area with 3 fire-days in
  its worst month is as bright as one with 3,000. Acceptable for the skeleton because there is no compare
  view. Add to the legend: "Colours are relative to this area; the same colour elsewhere is a different
  number." Any future compare view or share image with two areas must use shared breaks. Also: breaks
  include partial and preliminary months, so colours of old final cells shift with each delivery; compute
  breaks from fully observed final | estimate months.
- m3. **Partial months are coloured on the same value scale as full months** (palette.ts:47-49). The
  current month, the one a manager looks at first, is systematically pale. The corner marker and legend
  entry are there, so this is not a silent comparison, but consider the "no ratio" dashed look plus the
  number for partial cells in harm and raw mode.
- m4. **Degenerate breaks.** With few distinct non-zero values `valueBreaks` returns repeated breaks; the
  legend then prints "1 – 1" several times and uses the label as React key (legend.tsx:74-75). Collapse
  duplicate classes.
- m5. **Estimate year totals carry the preliminary hatch.** burning-calendar.tsx:409-411 hatches every
  non-final bar with `ft-hatch`, which the legend defines as preliminary. 2001–2011 bars look preliminary.
  Use the dotted estimate mark, as the yearly chart does.
- m6. **Month-median row in raw mode.** burning-calendar.tsx:433-463. The row always shows harmonized
  medians, labelled only "median", also under a grid coloured by raw detections. The year-total column is
  labelled "(raw)", this row is not. Label it "median, harmonized fire-days" or hide it in raw mode. Also
  its median includes every baseline year, while the cell ratio excludes the target year, so the two
  medians a user sees for the same month can differ; say "all baseline years" in the title.
- m7. **Headline tone and cell class disagree at ×0.8.** headline.tsx:25 uses `<= 0.8` → blue;
  `ratioClass(0.8)` is the neutral class (calendar.ts:133-138). Ratios are rounded to one decimal, so 0.8
  is common. Derive the tone from `ratioClass`.
- m8. **Tone by ratio alone.** headline.tsx:20-27. "×1.3" turns ember although it can sit at P55 of a
  noisy baseline. Colour only when the rank is also in the outer part of the baseline, or drop the tone
  (see M1 fix a).
- m9. **"×0.0" (Phase 0 m1) is now on screen**: headline via `ratioCopy`, tooltip
  (burning-calendar.tsx:520) and aria "0.0 times the median" (line 35). Render "<×0.1" for 0 < ratio < 0.05.
- m10. **"P100" (Phase 0 m2)**: headline.tsx:36-38. Jargon for the audience; prefer "highest of 22" /
  "higher than 19 of 22 Novembers".
- m11. **Slope display rounds to "+0".** `fmtSigned` → `fmt` keeps one decimal below 10 (format.ts:40-53).
  A small AOI with slope 0.04 prints "+0 fire-days / year", possibly with p < 0.05. Use two significant
  figures. Say "harmonized fire-days per year" (explorer.tsx:237) and "harmonized fire-days" in the chart
  tooltips (yearly-charts.tsx:87,141).
- m12. **Hard-coded year in a component.** legend.tsx:96 "when VIIRS starts (2012)". Take the year from
  `dataset.coverage`. Raw totals also step when NOAA-20 and NOAA-21 start; the note mentions only the first.
- m13. **"so far" for past months.** headline.tsx:54. A 2015 month with one gap day reads "29 of 30 days
  observed so far". Use "so far" only for the month that contains `nrtThrough`. The same fact is printed
  twice (headline copy and this line).
- m14. **Anomalies use the mean, everything else the median.** calendar.ts:286-287. One extreme year pulls
  the mean up and turns most years blue. The caption says "mean", so it is honest; prefer the median or
  add "(mean, sensitive to extreme years)". Tooltip "incomplete year" (yearly-charts.tsx:141) is also shown
  for a complete but preliminary year.
- m15. **Trend line crosses dropped years.** yearly-charts.tsx:116-120 draws the line over a year inside
  from–to that is not in the fit. Cosmetic once M3 marks such years.
- m16. **Tooltip lacks the baseline note and a label for the range.** burning-calendar.tsx:513-522: "vs
  median ×1.8 · n 22" without "8 MODIS-only estimates", and "(lo–hi)" unlabelled (Phase 0 m6: "range, sum
  of cell bounds").
- m17. **Sensor-era rail has no legend entry** (burning-calendar.tsx:318-330), and ember is used for four
  meanings: high ratio, selection, VIIRS era, trend line.
- m18. **Year-total title wording.** "10 of 12 parts observed" (honest-value.ts:127) → "months".
- m19. **Acknowledgement.** explorer.tsx:263-267 follows the FIRMS wording; check it against the current
  FIRMS citation page (I did not; the usual text also carries the FIRMS URL). Reuse one constant for footer
  and export.
- Still open from Phase 0 and unchanged: M1 (threshold for partial months, Q2), m3 reference tests, m4(b)
  autocorrelation (Q8), m6, m7, m8, m9 (mock label on charts and share images), m13, m14.

## Answers to the review questions
- Every displayed number carries a status: yes for cells, headline, year totals and month medians. The
  trend slope, p-value and anomaly mean have no status of their own; the estimate-years sentence stands in
  for it and needs the count (M2).
- no_data shown or exported as 0: not in the grid or the CSV. Yes, in effect, in the yearly charts (M3).
- Partial months compared or ranked: no ratio, no rank, not in baselines or totals. They do share the
  value colour scale and enter the quantile breaks (m2, m3).
- Year totals and trend use comparable years only: yes.
- Trend with estimate years labelled honestly enough: not yet (M2, point 3).
- Quantile classes per AOI: honest for one area, misleading across areas; label it now, shared breaks for
  any compare view (m2).
- "Is burning increasing?" and headline colour by ratio: both mislead as built (M2, M1, m8).

## Gate
Merge after M1 (interim a–c), M2, M3 and M4. The final fix of M1 waits for the floor from the science
team (Q5).
