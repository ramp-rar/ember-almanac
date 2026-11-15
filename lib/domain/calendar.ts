import { MIN_BASELINE_YEARS, median, percentile, ratioToMedian, type MonthPoint } from './baseline';
import {
  honest,
  sumHonest,
  toPlain,
  worstStatus,
  type HonestValue,
  type PlainHonest,
  type Status,
} from './honest-value';
import type { IsoDate } from './iso-date';
import type { DatasetMeta } from './meta';
import { buildMonthSeries } from './series';
import { mannKendall, theilSen } from './stats';

/**
 * Everything the Burning Calendar, the headline metric and the yearly charts need, computed on
 * the server from AOI totals (rows already summed over cells). Pure: no I/O, `today` is passed in.
 */

export interface AoiMonthRow {
  readonly year: number;
  readonly month: number;
  readonly harm: number;
  readonly harmLo: number;
  readonly harmHi: number;
  readonly rawModis: number;
  readonly rawViirs: number;
}

export type RatioKind = ReturnType<typeof ratioToMedian>['kind'];

export interface CalendarCell {
  readonly y: number;
  readonly m: number;
  readonly s: Status;
  /** [observed days, days in month] */
  readonly cov: readonly [number, number];
  /** harmonized fire-days; null when no_data | future */
  readonly h: number | null;
  readonly lo: number | null;
  readonly hi: number | null;
  /** raw detections; null when no_data | future */
  readonly rm: number | null;
  readonly rv: number | null;
  /** ratio to the median of the same month (harmonized values only) */
  readonly r: {
    readonly k: RatioKind;
    readonly v: number | null;
    readonly note?: string;
    readonly n: number;
    readonly by: readonly [number, number] | null;
    readonly ne: number;
    readonly p: number | null;
    readonly md: number | null;
  };
}

export interface YearTotal {
  readonly y: number;
  readonly harm: PlainHonest;
  readonly raw: PlainHonest;
}

export interface MonthMedian {
  readonly m: number;
  readonly harm: PlainHonest;
  readonly n: number;
}

export interface YearPoint {
  readonly y: number;
  readonly total: number | null;
  readonly s: Status;
  /** in the trend: all 12 months fully observed and final | estimate */
  readonly complete: boolean;
  readonly anomaly: number | null;
}

export interface CalendarData {
  readonly cells: readonly CalendarCell[];
  readonly yearTotals: readonly YearTotal[];
  readonly monthMedians: readonly MonthMedian[];
  /** Upper bounds of the non-zero classes 1–5 (class 6 is above the last); class 0 = zero. */
  readonly breaks: { readonly harm: readonly number[]; readonly raw: readonly number[] };
  readonly selected: { readonly y: number; readonly m: number } | null;
  /** True when no observed month has any fire: show "no fire observations", not an empty grid. */
  readonly empty: boolean;
  readonly series: {
    readonly years: readonly YearPoint[];
    readonly trend: {
      readonly slope: number;
      readonly intercept: number;
      readonly n: number;
      readonly from: number;
      readonly to: number;
    } | null;
    readonly mk: { readonly p: number | null; readonly tau: number; readonly n: number } | null;
    readonly anomalyBase: {
      readonly from: number;
      readonly to: number;
      readonly mean: number;
      readonly n: number;
    } | null;
  };
}

/** Number of colour classes for values (class 0 = zero, then 6 quantile classes). */
export const VALUE_CLASSES = 7;

/** Quantile breaks of the AOI's own non-zero values, so a small AOI is not all dark. */
export function valueBreaks(values: readonly (number | null)[]): number[] {
  const nonZero = values.filter((v): v is number => v !== null && v > 0);
  if (nonZero.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i < VALUE_CLASSES - 1; i++) {
    breaks.push(percentile(nonZero, (i / (VALUE_CLASSES - 1)) * 100) as number);
  }
  return breaks;
}

/** Colour class 0–6 of a value: 0 for zero, otherwise by the AOI's quantile breaks. */
export function valueClass(value: number, breaks: readonly number[]): number {
  if (value <= 0) return 0;
  let cls = 1;
  for (const b of breaks) if (value > b) cls += 1;
  return Math.min(cls, VALUE_CLASSES - 1);
}

/** Diverging ratio classes from the calendar-heatmap skill: ≤0.5, …, ≥4. */
export const RATIO_LIMITS = [0.5, 0.8, 1.25, 2, 4] as const;
export function ratioClass(ratio: number): number {
  let cls = 0;
  for (const limit of RATIO_LIMITS) if (ratio >= limit) cls += 1;
  return cls;
}

function isFull(p: MonthPoint): boolean {
  return p.coverage.observed === p.coverage.total;
}

function yearTotal(points: readonly MonthPoint[], unit: 'fire_days_harm' | 'detections_raw') {
  const total = sumHonest(
    points.map((p) => p.value),
    unit,
  );
  const partial = points.filter((p) => p.value.value !== null && !isFull(p)).length;
  if (total.value === null || partial === 0) return total;
  // A year containing a partly observed month is not comparable with full years.
  return honest({
    value: null,
    status: total.status,
    unit,
    note: `${partial} partly observed month${partial > 1 ? 's' : ''}`,
  });
}

export function buildCalendar(
  rows: readonly AoiMonthRow[],
  meta: DatasetMeta,
  today: IsoDate,
): CalendarData {
  const byKey = new Map(rows.map((r) => [r.year * 12 + r.month, r]));
  const harm = buildMonthSeries(
    rows.map((r) => ({ year: r.year, month: r.month, value: r.harm })),
    meta,
    today,
    'fire_days_harm',
  );
  const raw = buildMonthSeries(
    rows.map((r) => ({ year: r.year, month: r.month, value: r.rawModis + r.rawViirs })),
    meta,
    today,
    'detections_raw',
  );
  const baselineYears = meta.harmonization.baseline_years;

  const cells: CalendarCell[] = harm.map((p) => {
    const row = byKey.get(p.year * 12 + p.month);
    const observed = p.value.value !== null;
    const ratio = ratioToMedian(harm, p.year, p.month, baselineYears);
    return {
      y: p.year,
      m: p.month,
      s: p.value.status,
      cov: [p.coverage.observed, p.coverage.total],
      h: p.value.value,
      lo: observed ? (row?.harmLo ?? 0) : null,
      hi: observed ? (row?.harmHi ?? 0) : null,
      rm: observed ? (row?.rawModis ?? 0) : null,
      rv: observed ? (row?.rawViirs ?? 0) : null,
      r: {
        k: ratio.kind,
        v: ratio.ratio.value,
        ...(ratio.ratio.note === undefined ? {} : { note: ratio.ratio.note }),
        n: ratio.n,
        by: ratio.baselineYears,
        ne: ratio.baselineEstimateYears,
        p: ratio.percentile,
        md: ratio.median,
      },
    };
  });

  const years = [...new Set(harm.map((p) => p.year))];
  const yearTotals: YearTotal[] = years.map((y) => ({
    y,
    harm: toPlain(
      yearTotal(
        harm.filter((p) => p.year === y),
        'fire_days_harm',
      ),
    ),
    raw: toPlain(
      yearTotal(
        raw.filter((p) => p.year === y),
        'detections_raw',
      ),
    ),
  }));

  const monthMedians: MonthMedian[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const base = harm.filter(
      (p) =>
        p.month === month &&
        p.year >= baselineYears[0] &&
        p.year <= baselineYears[1] &&
        p.value.value !== null &&
        isFull(p) &&
        (p.value.status === 'final' || p.value.status === 'estimate'),
    );
    const status = worstStatus(base.map((p) => p.value.status));
    let value: HonestValue;
    if (base.length < MIN_BASELINE_YEARS) {
      value = honest({
        value: null,
        status,
        unit: 'fire_days_harm',
        note: 'insufficient baseline',
      });
    } else {
      value = honest({
        value: median(base.map((p) => p.value.value as number)) as number,
        status,
        unit: 'fire_days_harm',
      });
    }
    return { m: month, harm: toPlain(value), n: base.length };
  });

  const selectedCell = [...cells].reverse().find((c) => c.h !== null && c.cov[0] === c.cov[1]);

  return {
    cells,
    yearTotals,
    monthMedians,
    breaks: {
      harm: valueBreaks(cells.map((c) => c.h)),
      raw: valueBreaks(raw.map((p) => p.value.value)),
    },
    selected: selectedCell ? { y: selectedCell.y, m: selectedCell.m } : null,
    empty: !cells.some((c) => c.h !== null && c.h > 0),
    series: yearlySeries(yearTotals, baselineYears),
  };
}

/**
 * Yearly series for F04: totals, Theil–Sen trend and Mann–Kendall test over complete years only
 * (all months fully observed, status final | estimate), anomalies against the mean of complete
 * years inside the baseline window.
 */
export function yearlySeries(
  totals: readonly YearTotal[],
  baselineYears: readonly [number, number],
): CalendarData['series'] {
  const complete = totals.filter(
    (t) => t.harm.v !== null && (t.harm.s === 'final' || t.harm.s === 'estimate'),
  );
  const base = complete.filter((t) => t.y >= baselineYears[0] && t.y <= baselineYears[1]);
  const mean =
    base.length > 0 ? base.reduce((sum, t) => sum + (t.harm.v as number), 0) / base.length : null;

  const years: YearPoint[] = totals.map((t) => {
    const isComplete = complete.includes(t);
    return {
      y: t.y,
      total: t.harm.v,
      s: t.harm.s,
      complete: isComplete,
      anomaly: isComplete && mean !== null ? (t.harm.v as number) - mean : null,
    };
  });

  const points = complete.map((t) => ({ x: t.y, y: t.harm.v as number }));
  const fit = theilSen(points);
  const mk = points.length > 0 ? mannKendall(points.map((p) => p.y)) : null;

  return {
    years,
    trend:
      fit && points.length >= 2
        ? {
            ...fit,
            from: points[0]!.x,
            to: points[points.length - 1]!.x,
          }
        : null,
    mk: mk ? { p: mk.p, tau: mk.tau, n: mk.n } : null,
    anomalyBase:
      mean !== null
        ? {
            from: base[0]!.y,
            to: base[base.length - 1]!.y,
            mean,
            n: base.length,
          }
        : null,
  };
}

/** p-value for display: two significant figures, floored at "< 0.001". */
export function formatP(p: number | null): string {
  if (p === null) return 'not computed';
  if (p < 0.001) return 'p < 0.001';
  return `p = ${Number(p.toPrecision(2))}`;
}
