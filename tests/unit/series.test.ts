import { describe, expect, it } from 'vitest';
import { ratioToMedian } from '@/lib/domain/baseline';
import { buildMonthSeries } from '@/lib/domain/series';
import { TODAY, contractMeta } from '../fixtures/meta';

const at = (series: ReturnType<typeof buildMonthSeries>, y: number, m: number) =>
  series.find((p) => p.year === y && p.month === m)!;

describe('buildMonthSeries()', () => {
  const rows = [
    { year: 2000, month: 11, value: 4 },
    { year: 2020, month: 8, value: 12.5 },
    { year: 2026, month: 11, value: 3 },
  ];
  const series = buildMonthSeries(rows, contractMeta, TODAY, 'fire_days_harm');

  it('is dense: 27 years × 12 months', () => {
    expect(series).toHaveLength(27 * 12);
  });

  it('no row in an observed month is a real zero with the month status', () => {
    expect(at(series, 2020, 7).value).toMatchObject({ value: 0, status: 'final' });
    expect(at(series, 2005, 1).value).toMatchObject({ value: 0, status: 'estimate' });
    expect(at(series, 2026, 8).value).toMatchObject({ value: 0, status: 'preliminary' });
    expect(at(series, 2020, 8).value.value).toBe(12.5);
  });

  it('no row in an unobserved month stays no_data / future, never zero', () => {
    for (let m = 1; m <= 10; m++) {
      expect(at(series, 2000, m).value).toMatchObject({ value: null, status: 'no_data' });
    }
    expect(at(series, 2026, 12).value).toMatchObject({ value: null, status: 'future' });
  });

  it('marks the partly observed current month', () => {
    expect(at(series, 2026, 11).coverage).toEqual({ observed: 14, total: 30 });
    expect(at(series, 2026, 10).coverage).toEqual({ observed: 31, total: 31 });
  });

  it('rejects duplicates and values in unobserved months', () => {
    expect(() =>
      buildMonthSeries([rows[0]!, rows[0]!], contractMeta, TODAY, 'fire_days_harm'),
    ).toThrow();
    expect(() =>
      buildMonthSeries([{ year: 2000, month: 3, value: 1 }], contractMeta, TODAY, 'fire_days_harm'),
    ).toThrow();
  });

  it('feeds ratioToMedian: zero-fire years count in the baseline', () => {
    // Fire in only 9 Octobers of the baseline; the other 14 are real zeros → median 0, n = 23.
    const sparse = Array.from({ length: 9 }, (_, i) => ({ year: 2012 + i, month: 10, value: 5 }));
    const dense = buildMonthSeries(
      [...sparse, { year: 2026, month: 10, value: 5 }],
      contractMeta,
      TODAY,
      'fire_days_harm',
    );
    const r = ratioToMedian(dense, 2026, 10, contractMeta.harmonization.baseline_years);
    expect(r.n).toBe(23);
    expect(r.kind).toBe('no_usual_activity');

    const quiet = ratioToMedian(dense, 2025, 9, contractMeta.harmonization.baseline_years);
    expect(quiet.target.value).toBe(0); // a zero-fire target is 0, not "no data"
  });

  it('the current, partly observed month gets no ratio', () => {
    const r = ratioToMedian(series, 2026, 11, contractMeta.harmonization.baseline_years);
    expect(r.kind).toBe('partial_month');
  });

  it('a duplicate (year, month) in a series is rejected by ratioToMedian', () => {
    const dup = [...series, at(series, 2020, 8)];
    expect(() => ratioToMedian(dup, 2026, 8, contractMeta.harmonization.baseline_years)).toThrow();
  });
});
