import type { Status } from './honest-value';
import { assertIsoDate, daysOfMonth, monthEnd, monthStart, type IsoDate } from './iso-date';
import type { DatasetMeta } from './meta';

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
 * First match wins (honest-labels skill):
 *  1. month starts after today                        → future
 *  2. month ends before MODIS start                   → no_data
 *  3. month missing on every active platform          → no_data
 *  4. month starts after standard_processing_through  → preliminary
 *  5. year < estimate_before_year                     → estimate
 *  6. otherwise                                       → final
 *
 * Rule 4 looks at the month start, so a month that straddles the SP date is not preliminary
 * by this function alone; the per-row `processing` column of the delivery is the finer signal.
 */
export function statusOf(year: number, month: number, meta: DatasetMeta, today: IsoDate): Status {
  assertIsoDate(today, 'today');
  const start = monthStart(year, month);

  if (start > today) return 'future';
  if (monthEnd(year, month) < meta.coverage.MODIS.start) return 'no_data';
  if (isMonthFullyMissing(year, month, meta)) return 'no_data';
  if (start > meta.standard_processing_through) return 'preliminary';
  if (year < meta.estimate_before_year) return 'estimate';
  return 'final';
}
