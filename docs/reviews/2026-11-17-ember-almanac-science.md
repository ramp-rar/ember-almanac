# Science-integrity review — cities, map layers, forecast panel, watch list (2026-11-17)

Reviewer: science-integrity reviewer · Verdict: **CHANGES REQUIRED** (5 major, 16 minor).
Verified sound: per-cell values in `hex.parquet` add up to the region calendars (Tajikistan,
Kazakhstan, Texas), so summing cells for a city circle is valid; ratio/baseline logic correct.

## Major
1. City circles drop everything across the border; cell count and outline overstated the counted area.
2. Watch list rendered only `ratio`, hid `no_usual_activity`, showed ratios without absolute values
   (small-number cities could read "×3.0 unusually high" for 3 vs 1 fire-days).
3. Forecast panel: single "middle estimate", bands called "likely / almost certain" while the in-sample
   check gives 78% / 92% for the 80% / 95% bands; reads as a prediction.
4. API `null` months and per-region data ends could become zeros (latent: none today).
5. Map showed the average-year layer with a false reason for months inside the 12-month window that
   simply had no hexagon above the threshold.

## Minor (summary)
January 2012 labelled final though the API calls it estimate; hard-coded baseline years; sensor
details collapsed (Terra-only, NOAA-20 months); year-to-date baseline not windowed; percentile
wording with ties; average-layer units; no status on monthly map layers; city window anchor; city
rounding; forecast first row overlaps the partial month; "Usual" column without n; corridor note said
"upper bound"; "final will not change" overclaims; ytdZero wording; stale no_coverage text; Tajik
"median" wording.

## Resolution
Tracked in the commit messages "fix(science): …" that follow this note.
