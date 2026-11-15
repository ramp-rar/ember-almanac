import { honest, noData, type HonestValue } from './honest-value';

/** AOI total for one month, AFTER summing cells (medians are not additive across cells). */
export interface MonthPoint {
  readonly year: number;
  readonly month: number;
  readonly value: HonestValue;
}

/** Baseline needs at least this many valid years of the same month. */
export const MIN_BASELINE_YEARS = 10;

function sorted(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Median; mean of the two middle values for an even sample. null for an empty sample. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = sorted(values);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * p-th percentile (0–100) with linear interpolation between order statistics
 * (Hyndman & Fan type 7, the default of NumPy and R). null for an empty sample.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (!(p >= 0 && p <= 100)) throw new RangeError(`Percentile must be within 0–100, got ${p}`);
  if (values.length === 0) return null;
  const s = sorted(values);
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return s[lo]! + (s[hi]! - s[lo]!) * (rank - lo);
}

/**
 * Percentile rank of `x` within `baseline`, 0–100: share of baseline values below `x`,
 * counting ties as half (mid-rank). null for an empty baseline.
 */
export function percentileRank(baseline: readonly number[], x: number): number | null {
  if (baseline.length === 0) return null;
  let below = 0;
  let equal = 0;
  for (const v of baseline) {
    if (v < x) below += 1;
    else if (v === x) equal += 1;
  }
  return ((below + equal / 2) / baseline.length) * 100;
}

export interface RatioToMedian {
  readonly kind: 'ratio' | 'insufficient_baseline' | 'no_usual_activity' | 'target_unavailable';
  /** unit `ratio`; status of the target month; value null unless kind = 'ratio'. */
  readonly ratio: HonestValue;
  readonly target: HonestValue;
  /** Median of the baseline; null when the baseline is insufficient. */
  readonly median: number | null;
  /** Number of baseline years actually used. */
  readonly n: number;
  /** First and last baseline year actually used. */
  readonly baselineYears: readonly [number, number] | null;
  /** How many of the baseline years are MODIS-only estimates. */
  readonly baselineEstimateYears: number;
  /** Percentile rank of the target within the baseline, rounded to an integer. */
  readonly percentile: number | null;
}

/**
 * Main emergency metric: the target month relative to the median of the same month in
 * other years.
 * - baseline = same month, years within `baselineYears`, excluding the target year,
 *   status final | estimate only;
 * - fewer than 10 baseline years → no ratio ("insufficient baseline");
 * - median = 0 → no ratio ("no usual activity in this month"), the absolute value stands;
 * - otherwise ratio = value / median, rounded to one decimal.
 * The ratio carries the status of the target month.
 */
export function ratioToMedian(
  series: readonly MonthPoint[],
  year: number,
  month: number,
  baselineYears: readonly [number, number],
): RatioToMedian {
  const sameMonth = series.filter((p) => p.month === month);
  const found = sameMonth.find((p) => p.year === year);
  const unit = found?.value.unit ?? sameMonth[0]?.value.unit ?? 'fire_days_harm';
  if (unit === 'ratio') throw new TypeError('ratioToMedian needs totals, not ratios');
  for (const p of sameMonth) {
    if (p.value.unit !== unit)
      throw new TypeError(`Mixed units in series: ${p.value.unit} and ${unit}`);
  }
  const target = found?.value ?? noData(unit);

  const [from, to] = baselineYears;
  const baseline = sameMonth.filter(
    (p) =>
      p.year !== year &&
      p.year >= from &&
      p.year <= to &&
      p.value.value !== null &&
      (p.value.status === 'final' || p.value.status === 'estimate'),
  );
  const values = baseline.map((p) => p.value.value as number);
  const years = baseline.map((p) => p.year);
  const n = baseline.length;
  const common = {
    target,
    n,
    baselineYears: n > 0 ? ([Math.min(...years), Math.max(...years)] as const) : null,
    baselineEstimateYears: baseline.filter((p) => p.value.status === 'estimate').length,
  };

  if (target.value === null) {
    const ratio =
      target.status === 'no_data' || target.status === 'future'
        ? honest({ value: null, status: target.status, unit: 'ratio' })
        : honest({
            value: null,
            status: target.status,
            unit: 'ratio',
            note: target.note ?? 'no value',
          });
    return { kind: 'target_unavailable', ratio, median: null, percentile: null, ...common };
  }

  if (n < MIN_BASELINE_YEARS) {
    const ratio = honest({
      value: null,
      status: target.status,
      unit: 'ratio',
      note: 'insufficient baseline',
    });
    return { kind: 'insufficient_baseline', ratio, median: null, percentile: null, ...common };
  }

  const med = median(values) as number;
  const rank = Math.round(percentileRank(values, target.value) as number);

  if (med === 0) {
    const ratio = honest({
      value: null,
      status: target.status,
      unit: 'ratio',
      note: 'no usual activity in this month',
    });
    return { kind: 'no_usual_activity', ratio, median: 0, percentile: rank, ...common };
  }

  const ratio = honest({
    value: Math.round((target.value / med) * 10) / 10,
    status: target.status,
    unit: 'ratio',
  });
  return { kind: 'ratio', ratio, median: med, percentile: rank, ...common };
}

/**
 * Headline copy, e.g. "×1.8 vs median of 23 Novembers (2003–2025)".
 * `monthPlural` is the plural month name ("Novembers"). n and the years are the real ones used.
 */
export function ratioCopy(result: RatioToMedian, monthPlural: string): string {
  switch (result.kind) {
    case 'target_unavailable':
      return result.target.status === 'future' ? 'not yet observed' : 'no data';
    case 'insufficient_baseline':
      return `insufficient baseline (${result.n} of ${MIN_BASELINE_YEARS} years needed)`;
    case 'no_usual_activity':
      return 'no usual activity in this month';
    case 'ratio': {
      const [from, to] = result.baselineYears as readonly [number, number];
      const base = `×${(result.ratio.value as number).toFixed(1)} vs median of ${result.n} ${monthPlural} (${from}–${to})`;
      return result.ratio.status === 'preliminary' ? `${base} (preliminary)` : base;
    }
  }
}
