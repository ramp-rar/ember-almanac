# Code review — Phase 0 (foundation)

Reviewer: code reviewer (independent; did not write the change)
Scope: `git diff cbdfe5a HEAD` (6 commits, 37 files)
Checks run: `pnpm test` (77 passed), `pnpm typecheck`, `pnpm lint`, `pnpm format:check` all green.
Not run: e2e, dev server, ingest (no database available).

Verdict: CHANGES REQUESTED

One BLOCKER (a domain rule that shows "no data" as zero in a routine situation) and eight MAJOR
issues, mostly in the domain API contracts and in ingest. Build, typing and lint are clean.

---

## BLOCKER

### B1. `statusOf` labels months after `nrt_through` as `preliminary`, so missing data reads as zero
- `lib/domain/status.ts:33-43` (rules at :37 and :40). `nrt_through` is never read.
- What is wrong: `cell_month` is sparse, and an absent row means 0 whenever the month counts as
  observed. The validator (`scripts/lib/contract.ts:152-159`) refuses rows after `nrt_through`, so
  every month between `nrt_through` and `today` has no rows. `statusOf` still calls those months
  `preliminary`, which is an observed status.
- Failing scenario: a delivery with `nrt_through = 2026-10-31`, and `today = 2026-11-15`.
  `statusOf(2026, 11, meta, today)` returns `preliminary`. The AOI total is 0, because no rows exist.
  `ratioToMedian` then prints "×0.0 vs median of 23 Novembers (preliminary)" and the calendar cell
  is coloured as 0. Emergency services are told nothing is burning when nothing has been delivered
  yet. This breaks docs/PROJECT_RULES.md rule 3. Science-team deliveries are periodic, so `nrt_through` will
  routinely lag `today` by days or weeks. The fixture hides the bug: `nrt_through = 2026-11-14`
  and `TODAY = 2026-11-15` (`tests/fixtures/meta.ts:21,44`). The test at
  `tests/unit/status.test.ts:48-51` treats "current month = preliminary" as correct with no regard
  to `nrt_through`.
- Fix: add a rule after rule 1: `if (start > meta.nrt_through) return 'no_data'`. Add
  `nrt_through` to the honest-labels skill rule list. Test with `nrt_through = 2026-10-31`,
  `today = 2026-11-15` and expect November = `no_data`. Also see M3 (partial months).

---

## MAJOR

### M1. An `HonestValue` can be forged without `honest()` by spreading an existing one
- `lib/domain/honest-value.ts:10-21`. The comment at :19 says "only `honest()` can produce this
  type". That is false.
- Failing scenario: these lines type-check under the project's strict settings (verified with `tsc`):

      const a: HonestValue = { ...noData('ratio'), value: 42 };            // no_data carrying 42
      const c: HonestValue = { ...noData('ratio'), value: -5, status: 'final' };

  The spread copies the symbol-keyed brand property type. `Object.freeze` does not stop a spread.
  So "no_data never carries a number" (rule 3) and "value ≥ 0, finite" hold only by convention.
  The same goes for `as HonestValue` casts on parsed JSON from the API.
- Fix: make the brand nominal through an ECMAScript private field. Spreading drops it, so the
  forgery becomes a compile error (verified: TS2739 "missing #brand"):
  `class HonestValueImpl { #brand = true; private constructor(...) {} }`, built only inside `honest()`.
  Class instances do not cross the RSC or JSON boundary. Client components therefore need a
  `fromJson(raw): HonestValue` that runs `honest()` again, and an ESLint `no-restricted-syntax`
  rule against `as HonestValue`. If you keep the interface, at least add a
  `WeakSet`-backed `isHonest()` assertion at component boundaries, and a test proving the spread
  forgery fails at runtime.

### M2. `ratioToMedian` treats an absent month as `no_data`, but the stored data is sparse (absent = 0)
- `lib/domain/baseline.ts:87-105`. A missing target becomes `noData` at :95. Missing baseline
  years are silently dropped at :98-105. The test `tests/unit/baseline.test.ts:168`
  ("a target absent from the series is no_data") locks this behaviour in.
- Failing scenario: `region_month` and AOI sums over `cell_month` have one row per month *with
  fire*. Take a steppe region that burned in 14 of 23 Novembers. A series built from those rows
  has n = 14 instead of 23. The 9 zero-Novembers are excluded, so the median is inflated, the
  ratio is understated, and P-rank is wrong. With 9 burning Novembers you get "insufficient
  baseline" for a region with 23 perfectly valid years. A target month with zero fire shows
  "no data" instead of ×0.0. The metric is skewed exactly where the absence of fire matters.
- Fix: make densification part of the domain API. Add
  `buildMonthSeries(sparseRows, meta, today, unit)`, which emits one `MonthPoint` per (year,
  month) from 2000 to today, with value 0 when `statusOf` gives an observed status and the row is
  absent. Make `ratioToMedian` reject (throw) a series that lacks any year in `baselineYears`.
  Duplicate (year, month) points should also throw (they are accepted today). Replace the test at
  :168 with "absent observed month = 0" and "sparse series rejected".

### M3. A partial month (the one containing `nrt_through`) is compared against full-month medians
- `lib/domain/baseline.ts:152-157`, `lib/domain/status.ts:40`.
- Failing scenario: on 2026-11-15 the user clicks November 2026, which holds data for 1–14 Nov.
  The headline reads "×0.5 vs median of 23 Novembers (preliminary)", because half a month is
  divided by a full-month median. The word "preliminary" does not say "partial". Users read the
  number as "half the usual activity", which is wrong.
- Fix: when `monthStart ≤ nrt_through < monthEnd`, give the target a note, e.g.
  `observed through 2026-11-14 (14 of 30 days)`. Then either withhold the ratio (kind
  `partial_month`) or compare against the medians of the same day-range. Withholding is the
  honest minimum. Test it.

### M4. Re-running ingest on an older, inactive version silently rolls production back to it
- `scripts/ingest.ts:112-117, 165, 228-229`.
- Failing scenario: ingest `2026-11-15a`, then `2026-12-01a`. Someone retries the first command
  from shell history: `pnpm ingest delivery/2026-11-15a`. The early return checks only
  `is_active`, so the old version is deleted, reloaded and **made active**. Users now see
  stale SP/NRT dates and older data with no warning. The skill says "Re-running the same version
  is a no-op". Here it is a no-op only if the version is currently active. Also, the existence check
  runs outside the transaction (TOCTOU: two concurrent runs both pass it).
- Fix: if the version row exists at all and is complete, print "already ingested" and exit 0.
  Activate an existing older version only with an explicit `--activate` (rollback) flag. Move the
  check into the transaction with `select ... for update`, or take a
  `pg_advisory_xact_lock(hashtext('ingest'))` first.

### M5. Region tables are not versioned, so mock regions leak into real versions and the region search
- `db/schema.ts:65-83` (`region`, `region_cell` have no `version_id`), `scripts/ingest.ts:191-225`.
- Failing scenario: run `pnpm ingest delivery/mock-2026-11-15a`. It upserts `ZZA/ZZB/ZZC` "Mock
  Region ... (fixture)" and their `region_cell`. Then ingest the first real delivery, which has no
  `regions.geojson` (the contract makes it optional). The loop is skipped, and the `region_month`
  for the **real** version is computed over the three fake strips (`ingest.ts:218-225`).
  `/api/regions?q=` (F01) will list "Mock Region West (fixture)" next to real countries. The same
  thing happens with stale countries: a region missing from a newer `regions.geojson` keeps its
  old cells forever. Because there is no unique constraint, only a convention keeps a cell from
  ending up in two regions.
- Fix: either add `version_id` to `region_cell` (and to `region`, or a `region_set_id`
  referenced by `dataset_version`), or make ingest replace the entire region set when
  `regions.geojson` is present. In both cases, refuse a non-mock ingest while `ZZ*` regions
  exist, and refuse to ingest `mock-*` into a database that already holds a non-mock version
  unless `--allow-mock` is given. That last guard also prevents a developer whose `.env.local`
  points at production from activating MOCK DATA there.

### M6. Ingest loads the whole `cell_month` into JS memory. That works for the mock and will not survive a real delivery (decision 6)
- `scripts/ingest.ts:127-153` (`rows()` -> `getRowObjects()` materialises every row, plus a
  second `Map` for r4, plus batch copies).
- Failing scenario: the mock has 73,764 rows. A real Central Asia delivery: bbox ≈ 4.5 M km² ≈
  125 k r6 cells, and around 20 % of 300 cell-months burning, gives roughly 2–7 M rows, i.e.
  several GB of JS objects. The product promises "any area on Earth". A global delivery is
  10^7–10^8 rows and fails with a certain OOM. It also ignores the data-contract skill's specified
  path ("COPY cell_month into a staging table, then INSERT…SELECT").
- Fix: stream. DuckDB `COPY (SELECT ..., h3 hex -> BIGINT) TO 'x.csv'`, then postgres.js
  `COPY cell_month_stage FROM STDIN` (the `.writable()` stream) piped from the file. Then
  `INSERT ... SELECT` into `cell_month` in the same transaction. Compute r4 in SQL: either the H3
  parent by bit arithmetic on the bigint (set the resolution field, set digits r5..r6 to 7), or
  the `h3` extension that Neon offers, or DuckDB's `h3` extension before export. Log the row count
  and memory high-water mark. This blocks the first real delivery, not Phase 0 itself, but the
  decision should be reversed now, before F02 depends on the ingest shape.

### M7. CI e2e on Vercel previews will get HTTP 401 under Vercel's default Deployment Protection
- `.github/workflows/ci.yml:39-60`, `playwright.config.ts:13-16`.
- Failing scenario: new Vercel projects protect preview deployments with Vercel Authentication by
  default. `request.get('/api/health')` from the GitHub runner receives 401 or a login redirect,
  so `expect(res.status()).toBe(200)` fails on every PR. People then learn to ignore the red check.
- Fix: set the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret and pass it through the job env.
  In `playwright.config.ts`, when `E2E_BASE_URL` is set, add `use.extraHTTPHeaders` with
  `x-vercel-protection-bypass: <secret>` and `x-vercel-set-bypass-cookie: true`. Alternatively,
  document in the release skill that protection is disabled for previews.

### M8. The contract gate has no failure-path tests
- `scripts/lib/contract.ts:62-255`. Coverage covers only `lib/domain/**` (`vitest.config.mts:47`).
  Nothing tests that an invalid delivery is rejected.
- Failing scenario: a regression that makes a check always pass goes unnoticed, because the mock
  delivery passes either way, and the CI step only proves the happy path. Examples:
  `NOT (lo <= harm AND harm <= hi)` edited to `<`; the NRT check comparing counts the wrong way
  round; `afterNrt` arithmetic off by one. The project rule "an invalid delivery is not loaded" is
  then unenforced. The same applies to ingest (atomicity, idempotency), which was verified once by
  hand.
- Fix: add `tests/unit/contract.test.ts`. Use DuckDB to write tiny Parquet files into a temp dir,
  one per violation: duplicate key, lo > hi, NaN, Infinity (see m2), bad resolution, row before
  MODIS start, SP row after the SP date, row after `nrt_through`, all-zero row, detection count
  off by one, missing detections dir, folder != `dataset_version`. Assert `ok === false` and the
  check name for each. For ingest, add a PGlite-backed test covering: an invalid delivery makes no
  writes; a re-run is a no-op; a failure mid-transaction leaves the previous version active; two
  versions keep exactly one active.

---

## MINOR

- m1. `lib/domain/status.ts:40` — rule 4 uses the month *start*. With
  `standard_processing_through = 2026-06-15`, June 2026 is `final` although half its rows are NRT.
  The validator (`contract.ts:201-203`) checks only months starting after the SP date, and
  `region_month` drops `processing`, so the "finer signal" mentioned in the doc comment (:30-31)
  is lost for countries. Fix: `monthEnd(y, m) > SP -> preliminary` (the worst status of the
  month's days), and amend the skill. Alternatively, have `meta.json` require SP to be a month end.
- m2. `scripts/lib/contract.ts:145-149` — only `isnan` is checked, on two columns. `+Infinity` in
  `fire_days_harm`/`_hi`/`frp_sum_mw` passes every check (Inf >= 0; lo <= Inf <= Inf). Postgres
  `real` stores it. Then `honest()` throws at request time, so the whole calendar returns 500.
  Fix: `NOT isfinite(col)` for every float column, including `_lo`.
- m3. `lib/domain/honest-value.ts:92-112` (decision 3) — agreed in principle. Two consequences:
  the 2026 year total is `{ value: null, status: 'future' }`, so the SPEC F02 "year sum on the
  right" is blank and labelled *future* for a year that is 87 % observed; and any null-valued
  observed part (e.g. a ratio with a note) withholds the total. Fix: add a separate
  `sumObserved(parts)` returning the partial sum with the worst observed status and a note
  "Jan–Nov only". Keep `sumHonest` for complete-year statistics (trend uses complete years only).
- m4. `lib/domain/baseline.ts:153` — rounding to one decimal turns any ratio < 0.05 into "×0.0",
  which reads as "no fire" even when the target value is positive (e.g. 0.4 vs a median of 12).
  Fix: show "<×0.1" for `0 < ratio < 0.05`, or use 2 significant digits below 1.
- m5. `lib/domain/baseline.ts:172-176` — the copy adds "(preliminary)" but not "(estimate)" for
  a pre-2012 target. `baselineEstimateYears` is computed but never surfaced. The status is still
  on `ratio.status`, but the headline string is what gets copied into reports. Fix: append
  "(estimate)" for estimate targets. Consider "... of which 9 MODIS-only".
- m6. `.github/workflows/ci.yml:10-12` — `cancel-in-progress: true` also applies to pushes on `main`.
  A second merge cancels the first run, including a `migrate` job in flight. Fix: set
  `cancel-in-progress` to the expression `github.event_name == 'pull_request'`.
- m7. `.github/workflows/ci.yml:68-90` — migrations on `main` race the Vercel production build,
  which starts on the same push independently. New code can serve before its migration is
  applied. Preview deployments never get the PR's migrations applied to their Neon branch.
  Fix: document expand/contract migrations in the release skill. Gate production promotion on the
  `migrate` check (Vercel Deployment Checks), or run migrations in the Vercel build for previews
  against the branch database.
- m8. `tests/e2e/smoke.spec.ts:33-36` — the MOCK DATA assertion is conditional. On Vercel previews,
  `/api/meta` is 503 (`VERCEL` is set, no DB), so the banner is never tested in CI. Fix: add a
  local e2e project that runs with the fixture fallback and asserts the banner unconditionally.
- m9. `scripts/ingest.ts:197-200` — `Math.min(...lons)` spreads every vertex as call arguments.
  geoBoundaries ADM0 polygons (Russia, Canada) can exceed V8's argument limit, causing
  `RangeError: Maximum call stack size exceeded`. Also, a bbox computed by min/max and
  `polygonToCells` are both wrong for antimeridian-crossing countries (Russia, Fiji, USA-Alaska).
  Fix: compute the bbox with a reduce loop; split polygons at ±180 before `polygonToCells`.
- m10. `db/schema.ts:38-53` — `source_mode` from the contract is dropped at ingest, and
  `region_month` (:86-104) drops `processing` and `frp`. Phase 2 (Sensor Lab) and m1 need them.
  Adding columns later means re-ingesting. Fix: keep `source_mode` (varchar) in `cell_month`, and
  `processing` (or an `nrt_cells` count) in `region_month`.
- m11. `db/migrations/0000_init.sql:22` and the other tables — no CHECK constraints
  (`month between 1 and 12`, `processing in ('SP','NRT')`, `harm_lo <= harm and harm <= harm_hi`,
  `harm >= 0`). The validator is the only guard. Fix: add the CHECK constraints in a new migration.
  They are cheap defence in depth. Decision 1 (varchar(3)) is correct.
- m12. `lib/domain/meta.ts:32,39,54` — `estimate_before_year` and `baseline_years` are unbounded,
  and `nrt_through` may be in the future. `baseline_years: [203, 2025]` passes. Fix: bound years
  to [2000, 2100] and baseline within [2000, year(nrt_through)]. In the validator, flag
  `nrt_through` after the validation date.
- m13. `scripts/lib/contract.ts:239-246` — detections are reconciled only by monthly totals, not per
  (h3, year, month), and detection `h3` is not checked for validity or resolution. Swapping
  detections between cells passes. Fix: reconcile on `(h3, year, month)` and validate detection h3
  the same way as `cell_month`.

## NIT

- n1. `server/repositories/dataset-repository.ts:62` — the local-fixture fallback (decision 4) is
  gated on `!process.env.VERCEL`, so a self-hosted `next start` with a `delivery/` folder serves
  mock meta in production. The banner says MOCK, so the risk is low. Gate on
  `NODE_ENV !== 'production' || process.env.ALLOW_FIXTURE_META === '1'` (set by the Playwright
  webServer) to match the comment.
- n2. `components/dataset-banner.tsx:11` — `catch {}` swallows the error without logging. The
  route handler logs; the banner should too.
- n3. `lib/domain/honest-value.ts:47` — a whitespace-only note (`' '`) satisfies "null only with
  a note". Use `!note?.trim()`.
- n4. `db/schema.ts:71` — `geom_blob_url` is never written. Ingest uploads `regions.geojson` to
  Blob but does not record the URL. Either populate it from `put()`'s result or drop it until F01.
- n5. `scripts/lib/contract.ts:106` — the DuckDB connection or instance is never closed
  (`closeSync`). Ingest therefore holds two DuckDB instances.
- n6. `scripts/lib/duck.ts:9-11` — `sqlPath` escapes quotes, but `read_parquet` also treats
  `* ? [` as glob characters, so a parent directory containing `[` misreads. Not a security issue
  (CLI input), but worth a comment. No SQL injection found: every Postgres value in `ingest.ts`
  is parameterised, `tx(table)` takes a closed union, and DuckDB interpolations are numbers from
  Zod-validated meta or quote-escaped paths. No secrets are logged (only `error.message`; the DB
  URL is never printed).
- n7. `package.json:31` and others — `"latest"` for `@vercel/blob`, `clsx`, `lucide-react`,
  `tailwind-merge`, `class-variance-authority` (from the scaffold commit). The lockfile pins them,
  but `pnpm update` becomes unpredictable. Pin caret ranges. `postgres` is a runtime dependency
  used only by scripts. Move it to devDependencies.
- n8. `scripts/make-fixtures.ts:253` — `source_mode` is never `viirs_only`, so that enum value is
  never exercised.
- n9. `app/api/meta/route.ts:16` — `s-maxage=60, stale-while-revalidate=300` means up to ~6 min
  of the previous version after an ingest. That is fine if calendar URLs carry the version. State
  it in the ADR or the release skill so nobody "fixes" it by keying caches on time.

## Deliberate decisions — judgement
1. `varchar(3)` instead of `char(3)`: agree.
2. `honest()` with null and a note for observed statuses: agree. The note check should reject
   whitespace (n3).
3. `sumHonest` null when any part is null: agree for statistics. A partial-sum variant is needed
   for the calendar's year column (m3).
4. Local fixture fallback: acceptable, with a tighter gate (n1).
5. No INCLUDE index yet: agree. The PK prefix (version_id, h3) serves `h3 = any(...)`. Measure
   in F07.
6. All rows in memory: **reject** for anything beyond the mock (M6).

## Next.js 16 `cacheComponents`
Used correctly. Both route handlers call `await connection()` before any I/O. `DatasetBanner`
calls it and sits inside a `<Suspense>` in `app/page.tsx`. The removal of `export const runtime`
is right (it is incompatible with `cacheComponents`, and Node is the default). `no-store` on
health and errors, plus a short `s-maxage` on meta, are appropriate. The partial unique index
`dataset_version_one_active` is correct, and the swap order (deactivate, then activate, in one
transaction) satisfies it.

---

# Second pass (fixes 07ad660..HEAD)

Verdict: APPROVE

Scope: `git diff 07ad660 HEAD` and `docs/reviews/2026-11-15-phase0-resolution.md`.
`pnpm test` (117 passed) and `pnpm typecheck` are clean. I also ran a scratch probe
against the domain functions; it is not committed.

## Fix verification

| Finding | Holds? | How I tried to break it |
|---|---|---|
| B1 | Yes | `nrt_through = 2026-10-31`, `today = 2026-11-15` gives November `no_data` and October `preliminary` (31/31 days). 2000-10 is `no_data`, 2000-11 is `estimate`. |
| M1 | Yes | A spread or a literal fails to compile (`@ts-expect-error` in `honest-brand.test.ts`), and `HonestValue.is()` rejects both at runtime. The constructor validates, freezes, and keeps a blank note from justifying a null. Only explicit `as unknown as` casts remain, which no type system stops. |
| M2 | Yes, with a residual (m-2a) | `buildMonthSeries` with fire in only 5 of 23 Novembers gives n = 22, median 0, kind `no_usual_activity`, which is correct. A value in a `no_data` month throws. Duplicate rows throw in both functions. |
| M3 | Yes | `nrt_through = 2026-11-14` gives kind `partial_month` with the note "partial month: 14 of 30 days observed". Partial months stay out of baselines. |
| M4 | Yes | An existing inactive version is a no-op without `--activate`. The advisory lock plus the re-check inside the transaction closes the TOCTOU. |
| M5 | Yes, with a residual (m-2b) | The delivered set replaces older regions (`delete … not in`, guarded against an empty list). `mock-*` is refused once real data exists. `regions.geojson` is required. |
| M7 | Yes | The bypass header is sent only when `E2E_BASE_URL` is set, and the secret is set only on the test step. |
| M8 | Yes (validator half) | 19 failure cases, each asserting the exact failing check name, plus a happy path. |
| Minor fixes | Yes | `isfinite` on all float columns. `lo < 0` rejected. CI cancels only PR runs. bbox computed in a loop. |

## Deferrals — judgement

- **M6 (in-memory ingest): acceptable for the Phase 0 gate.** Only the mock (74 k rows) and a
  pilot region are in scope, and the limit is documented in the `scripts/ingest.ts` header.
  Condition: before any non-pilot delivery, either do the COPY-to-staging rewrite or at least
  add a fail-fast guard, e.g. abort when `count(*)` of `cell_month.parquet` exceeds ~3 M rows.
  Then nobody finds the limit by OOM. Track it as a release blocker for the first real delivery.
- **Automated PGlite ingest test: acceptable for Phase 0, not beyond F07.** Ingest now has
  more branches than when I first reviewed it: rollback, the mock guard, region replacement and
  the lock. Six hand-run scenarios are evidence, not regression protection. Automate it before
  the first real delivery, together with the M6 rewrite, which will change this code anyway.

## Remaining BLOCKER / MAJOR

None.

## New or residual MINOR

- m-2a. `lib/domain/baseline.ts:105-130` — `ratioToMedian` still accepts a hand-built sparse
  series and treats absent years as unobserved. A probe series of 5 Novembers returned a quiet
  `insufficient_baseline` or `target_unavailable` instead of an error. `coverage` is optional,
  and "absent = fully observed" means a caller that skips `buildMonthSeries` also skips the
  partial-month guard. Fix: make `coverage` required, or brand the dense series type returned by
  `buildMonthSeries` and accept only that type in `ratioToMedian`.
- m-2b. `scripts/ingest.ts` (region replacement) together with `db/schema.ts:92-94`
  (`region_month.iso3 … on delete cascade`) — deleting regions absent from the new delivery
  cascades to `region_month` rows of **every** version. `--activate` rollback to an older
  version then silently lacks those countries. Fix: version the region set, or refuse
  `--activate` when the target version's `region_month` covers regions that no longer exist
  (or rebuild them).
- m-2c. Rollback path in `scripts/ingest.ts` (the `--activate` branch) — it does not take
  the advisory lock, so it can interleave with a concurrent ingest's swap. The unique index
  prevents two active rows, but the outcome is order-dependent. Fix: take the same
  `pg_advisory_xact_lock` in that transaction.
- m-2d. `regions.geojson` is now required by ingest, but `docs/DATA_CONTRACT.md` still says
  "optional" and `contract:validate` passes a delivery without it, so a "PASS" delivery fails at
  ingest. `lo >= 0` is likewise a new rule not in the contract. Fix: add both checks to the
  validator and update DATA_CONTRACT.md, with an ADR, as the contract header requires.
- m-2e. `lib/domain/status.ts` (`monthCoverage`) — a single day missing on every flying
  platform makes the month partial, which excludes it from all baselines. That is common for
  MODIS-only years. This is a conservative stop-gap pending science Q2, as the resolution notes.
  Revisit it with the threshold.
- m-2f. `lib/domain/honest-value.ts` — class instances cannot be passed as props to Client
  Components (RSC needs plain objects). There is no `fromJson`/`toPlain` helper yet. Add one
  before F02 starts, so nobody falls back to `as HonestValue`.

## NIT
- The `deployment_status` e2e job runs checked-out PR code with the bypass secret in its env.
  If Vercel ever deploys fork PRs, that code can read the secret. The impact is low (preview
  access only), but keep fork deployments gated.
- The class declares `note` as a field, so every instance has an own `note: undefined`. JSON
  output is unaffected, but `'note' in v` is always true.
