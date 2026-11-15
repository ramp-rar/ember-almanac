import { MIN_BASELINE_YEARS, median } from './baseline';
import type { CalendarCell } from './calendar';
import { worstStatus, type Status } from './honest-value';

/**
 * "This year so far vs usual": the sum of the complete months of the latest year (January to the
 * last fully observed month) against the median of the same months in other years. Same rules as
 * the monthly metric: only fully observed months count, the target year is never in its own
 * baseline, at least MIN_BASELINE_YEARS comparable years are required.
 */
export interface YearToDate {
  readonly year: number;
  /** Months 1..toMonth are included. */
  readonly toMonth: number;
  readonly value: number;
  readonly status: Status;
  readonly median: number | null;
  readonly n: number;
  readonly from: number | null;
  readonly to: number | null;
  /** null when there is no comparable baseline or the usual value is 0. */
  readonly ratio: number | null;
}

const full = (c: CalendarCell | undefined): c is CalendarCell & { h: number } =>
  c !== undefined && c.h !== null && c.cov[0] === c.cov[1] && c.s !== 'no_data' && c.s !== 'future';

export function yearToDate(cells: readonly CalendarCell[]): YearToDate | null {
  if (cells.length === 0) return null;
  const at = new Map(cells.map((c) => [c.y * 12 + c.m, c]));
  const year = Math.max(...cells.map((c) => c.y));

  let toMonth = 0;
  for (let m = 1; m <= 12; m++) {
    if (!full(at.get(year * 12 + m))) break;
    toMonth = m;
  }
  if (toMonth === 0) return null;

  const months = Array.from({ length: toMonth }, (_, i) => i + 1);
  const target = months.map((m) => at.get(year * 12 + m)!);
  const value = target.reduce((s, c) => s + (c.h ?? 0), 0);
  const status = worstStatus(target.map((c) => c.s));

  const baseline: { y: number; v: number }[] = [];
  for (const y of new Set(cells.map((c) => c.y))) {
    if (y === year) continue;
    const row = months.map((m) => at.get(y * 12 + m));
    if (row.every(full)) baseline.push({ y, v: row.reduce((s, c) => s + (c?.h ?? 0), 0) });
  }
  const n = baseline.length;
  const med = n >= MIN_BASELINE_YEARS ? median(baseline.map((b) => b.v)) : null;
  return {
    year,
    toMonth,
    value: Math.round(value * 1000) / 1000,
    status,
    median: med === null ? null : Math.round(med * 1000) / 1000,
    n,
    from: n ? Math.min(...baseline.map((b) => b.y)) : null,
    to: n ? Math.max(...baseline.map((b) => b.y)) : null,
    ratio: med !== null && med > 0 ? Math.round((value / med) * 100) / 100 : null,
  };
}
