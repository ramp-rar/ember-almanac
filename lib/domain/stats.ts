import { median } from './baseline';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface TheilSenFit {
  /** Median of all pairwise slopes (units of y per unit of x). */
  readonly slope: number;
  /** Median of y − slope·x. */
  readonly intercept: number;
  readonly n: number;
}

/** Theil–Sen robust trend line. null when no pair of points has distinct x. */
export function theilSen(points: readonly Point[]): TheilSenFit | null {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      if (a.x !== b.x) slopes.push((b.y - a.y) / (b.x - a.x));
    }
  }
  const slope = median(slopes);
  if (slope === null) return null;
  const intercept = median(points.map((p) => p.y - slope * p.x)) as number;
  return { slope, intercept, n: points.length };
}

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation
 * (absolute error < 1.5e-7).
 */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** The normal approximation of the Mann–Kendall test is used only from this sample size. */
export const MIN_MANN_KENDALL_N = 10;

export interface MannKendallResult {
  readonly n: number;
  /** Σ sign(x_j − x_i) over i < j. */
  readonly s: number;
  /** Variance of S with the correction for ties. */
  readonly varS: number;
  /** Continuity-corrected standard score. */
  readonly z: number;
  /** Kendall's tau-a: S / (n(n−1)/2). */
  readonly tau: number;
  /** Two-sided p-value (normal approximation); null when n < 10 or the series is constant. */
  readonly p: number | null;
}

/** Mann–Kendall monotonic trend test on a series ordered in time. */
export function mannKendall(values: readonly number[]): MannKendallResult {
  const n = values.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(values[j]! - values[i]!);
  }
  if (s === 0) s = 0; // normalise -0

  const tieSizes = new Map<number, number>();
  for (const v of values) tieSizes.set(v, (tieSizes.get(v) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of tieSizes.values()) tieTerm += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;

  let z = 0;
  if (varS > 0 && s !== 0) z = (s - Math.sign(s)) / Math.sqrt(varS);

  const pairs = (n * (n - 1)) / 2;
  const tau = pairs > 0 ? s / pairs : 0;
  const p =
    n >= MIN_MANN_KENDALL_N && varS > 0 ? Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) : null;

  return { n, s, varS, z, tau, p };
}
