import type { MonthPoint } from './baseline';
import { future, honest, noData, type Unit } from './honest-value';
import type { IsoDate } from './iso-date';
import type { DatasetMeta } from './meta';
import { monthCoverage, statusOf } from './status';

export interface SparseMonthRow {
  readonly year: number;
  readonly month: number;
  readonly value: number;
}

/**
 * Turns sparse storage into a dense monthly series for an AOI (rows already summed over cells).
 * The delivery omits zero rows, so for a month that meta marks as observed, an absent row is a
 * real 0; for a month that was not observed it stays no_data / future and never becomes 0.
 * Covers January of `fromYear` through December of the year of `today`.
 */
export function buildMonthSeries(
  rows: readonly SparseMonthRow[],
  meta: DatasetMeta,
  today: IsoDate,
  unit: Exclude<Unit, 'ratio'>,
  fromYear = 2000,
): MonthPoint[] {
  const byMonth = new Map<number, number>();
  for (const row of rows) {
    const key = row.year * 12 + row.month;
    if (byMonth.has(key)) throw new RangeError(`Duplicate row for ${row.year}-${row.month}`);
    byMonth.set(key, row.value);
  }

  const series: MonthPoint[] = [];
  const lastYear = Number(today.slice(0, 4));
  for (let year = fromYear; year <= lastYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const status = statusOf(year, month, meta, today);
      const stored = byMonth.get(year * 12 + month);
      if (status === 'future' || status === 'no_data') {
        if (stored !== undefined && stored !== 0) {
          throw new RangeError(`Row with a value in a ${status} month: ${year}-${month}`);
        }
        series.push({
          year,
          month,
          value: status === 'future' ? future(unit) : noData(unit),
          coverage: monthCoverage(year, month, meta, today),
        });
      } else {
        series.push({
          year,
          month,
          value: honest({ value: stored ?? 0, status, unit }),
          coverage: monthCoverage(year, month, meta, today),
        });
      }
    }
  }
  return series;
}
