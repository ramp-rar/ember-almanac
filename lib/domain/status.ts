import type { Status } from './honest-value';
import { assertIsoDate, daysOfMonth, monthEnd, monthStart, type IsoDate } from './iso-date';
import type { DatasetMeta } from './meta';

export interface MonthCoverage {
  /** Days observed by at least one platform, delivered (≤ nrt_through) and not after today. */
  readonly observed: number;
  /** Calendar days in the month. */
  readonly total: number;
}

/**
 * How much of a month has actually been observed. A day counts when at least one platform was
 * flying, is not listed in `meta.missing_days` for that day, and the day is within
 * `nrt_through` and `today`. A month with `observed < total` must not be compared with full
 * months (see ratioToMedian).
 */
export function monthCoverage(
  year: number,
  month: number,
  meta: DatasetMeta,
  today: IsoDate,
): MonthCoverage {
  assertIsoDate(today, 'today');
  const missing = new Set(meta.missing_days.map((d) => `${d.platform}|${d.date}`));
  const platforms = Object.entries(meta.coverage);
  const days = daysOfMonth(year, month);
  const observed = days.filter(
    (day) =>
      day <= today &&
      day <= meta.nrt_through &&
      platforms.some(
        ([platform, { start, end }]) =>
          start <= day && (end === null || day <= end) && !missing.has(`${platform}|${day}`),
      ),
  ).length;
  return { observed, total: days.length };
}

/**
 * True when, on every day of the month, every platform flying that day is listed in
 * `meta.missing_days`. A month with no platform flying at all is also unobserved.
 */
function isMonthFullyMissing(year: number, month: number, meta: DatasetMeta): boolean {
  const missing = new Set(meta.missing_days.map((d) => `${d.platform}|${d.date}`));
  const platforms = Object.entries(meta.coverage);
  return daysOfMonth(year, month).every((day) =>
    platforms.every(([platform, { start, end }]) => {
      const active = start <= day && (end === null || day <= end);
      return !active || missing.has(`${platform}|${day}`);
    }),
  );
}

/**
 * Data status of a calendar cell. Pure: all dates come from `meta` and `today`.
 * First match wins (honest-labels skill, plus two stricter rules from the 2026-11-15 review):
 *  1. month starts after today                        → future
 *  2. month ends before MODIS start                   → no_data
 *  3. month starts after nrt_through                  → no_data (not delivered yet; the sparse
 *     format would otherwise read the absent rows as zero)
 *  4. month missing on every active platform          → no_data
 *  5. month ends after standard_processing_through    → preliminary (a month that straddles
 *     the SP date still contains NRT days)
 *  6. year < estimate_before_year                     → estimate
 *  7. otherwise                                       → final
 */
export function statusOf(year: number, month: number, meta: DatasetMeta, today: IsoDate): Status {
  assertIsoDate(today, 'today');
  const start = monthStart(year, month);
  const end = monthEnd(year, month);

  if (start > today) return 'future';
  if (end < meta.coverage.MODIS.start) return 'no_data';
  if (start > meta.nrt_through) return 'no_data';
  if (isMonthFullyMissing(year, month, meta)) return 'no_data';
  if (end > meta.standard_processing_through) return 'preliminary';
  if (year < meta.estimate_before_year) return 'estimate';
  return 'final';
}
