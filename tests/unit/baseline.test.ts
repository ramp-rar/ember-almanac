import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  baselineNote,
  median,
  percentile,
  percentileRank,
  ratioCopy,
  ratioToMedian,
  type MonthPoint,
} from '@/lib/domain/baseline';
import { honest, noData, type Status } from '@/lib/domain/honest-value';

const BASELINE: readonly [number, number] = [2003, 2025];

function point(year: number, month: number, value: number | null, status: Status): MonthPoint {
  return {
    year,
    month,
    value:
      value === null
        ? noData('fire_days_harm')
        : honest({ value, status: status as 'final', unit: 'fire_days_harm' }),
  };
}

/** Novembers 2003–2025 with values 1..23 (median 12), plus a target. */
function novembers(target: MonthPoint, valueOf: (year: number) => number = (y) => y - 2002) {
  const series: MonthPoint[] = [];
  for (let y = 2003; y <= 2025; y++) {
    series.push(point(y, 11, valueOf(y), y < 2012 ? 'estimate' : 'final'));
    series.push(point(y, 7, 1000, 'final')); // other months must be ignored
  }
  return [...series, target];
}

describe('median / percentile / percentileRank', () => {
  it('median of odd and even samples', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBeNull();
  });

  it('percentile interpolates linearly between order statistics', () => {
    const v = [10, 20, 30, 40, 50];
    expect(percentile(v, 0)).toBe(10);
    expect(percentile(v, 50)).toBe(30);
    expect(percentile(v, 100)).toBe(50);
    expect(percentile(v, 25)).toBe(20);
    expect(percentile([1, 2], 50)).toBe(1.5);
    expect(percentile([], 50)).toBeNull();
    expect(() => percentile(v, 101)).toThrow();
  });

  it('percentileRank uses the mid-rank for ties', () => {
    expect(percentileRank([1, 2, 3, 4], 5)).toBe(100);
    expect(percentileRank([1, 2, 3, 4], 0)).toBe(0);
    expect(percentileRank([1, 2, 3, 4], 2)).toBe(37.5); // 1 below + half of 1 equal, of 4
    expect(percentileRank([0, 0, 0, 0], 0)).toBe(50);
    expect(percentileRank([], 1)).toBeNull();
  });

  it('median lies within the sample range and ignores order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1e6, noNaN: true }), { minLength: 1 }),
        (xs) => {
          const m = median(xs)!;
          expect(m).toBeGreaterThanOrEqual(Math.min(...xs));
          expect(m).toBeLessThanOrEqual(Math.max(...xs));
          expect(median([...xs].reverse())).toBe(m);
          expect(percentile(xs, 50)).toBeCloseTo(m, 6);
        },
      ),
    );
  });
});

describe('ratioToMedian()', () => {
  it('computes ×ratio against the median of the same month in other years', () => {
    const series = novembers(point(2026, 11, 21.6, 'preliminary'));
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.kind).toBe('ratio');
    expect(r.median).toBe(12);
    expect(r.n).toBe(23);
    expect(r.baselineYears).toEqual([2003, 2025]);
    expect(r.ratio).toMatchObject({ value: 1.8, status: 'preliminary', unit: 'ratio' });
    expect(r.percentile).toBe(91); // 21 of 23 baseline values are below 21.6
    expect(r.baselineEstimateYears).toBe(9);
  });

  it('rounds the ratio to one decimal', () => {
    const series = novembers(point(2026, 11, 13, 'final'));
    expect(ratioToMedian(series, 2026, 11, BASELINE).ratio.value).toBe(1.1); // 13 / 12 = 1.083
  });

  it('excludes the target year from its own baseline', () => {
    // Target 2014 has a huge value; if it leaked into the baseline the median would move.
    const series = novembers(point(2026, 11, 5, 'final'), (y) => (y === 2014 ? 10_000 : 10));
    const r = ratioToMedian(series, 2014, 11, BASELINE);
    expect(r.n).toBe(22);
    expect(r.median).toBe(10);
    expect(r.ratio.value).toBe(1000);
    expect(r.percentile).toBe(100);
  });

  it('uses only years inside baseline_years', () => {
    const series = [...novembers(point(2026, 11, 12, 'final')), point(2001, 11, 9999, 'estimate')];
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.n).toBe(23);
    expect(r.median).toBe(12);
  });

  it('keeps preliminary, no_data and future years out of the baseline', () => {
    const series = novembers(point(2026, 11, 12, 'final')).map((p) => {
      if (p.month !== 11) return p;
      if (p.year === 2024) return point(2024, 11, 500, 'preliminary');
      if (p.year === 2025) return point(2025, 11, null, 'no_data');
      return p;
    });
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.n).toBe(21);
    expect(r.baselineYears).toEqual([2003, 2023]);
    expect(r.median).toBe(11);
  });

  it('n < 10 → no ratio, status of the target, note "insufficient baseline"', () => {
    const series: MonthPoint[] = [];
    for (let y = 2017; y <= 2025; y++) series.push(point(y, 11, 10, 'final'));
    series.push(point(2026, 11, 30, 'preliminary'));
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.kind).toBe('insufficient_baseline');
    expect(r.n).toBe(9);
    expect(r.ratio).toMatchObject({
      value: null,
      status: 'preliminary',
      note: 'insufficient baseline',
    });
    expect(r.median).toBeNull();
    expect(r.percentile).toBeNull();
  });

  it('exactly 10 baseline years is enough', () => {
    const series: MonthPoint[] = [];
    for (let y = 2016; y <= 2025; y++) series.push(point(y, 11, 10, 'final'));
    series.push(point(2026, 11, 30, 'final'));
    expect(ratioToMedian(series, 2026, 11, BASELINE)).toMatchObject({ kind: 'ratio', n: 10 });
  });

  it('median = 0 → no ratio, absolute value stays, "no usual activity"', () => {
    const series = novembers(point(2026, 11, 4, 'final'), (y) => (y >= 2020 ? 3 : 0));
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.kind).toBe('no_usual_activity');
    expect(r.median).toBe(0);
    expect(r.ratio.value).toBeNull();
    expect(r.ratio.note).toBe('no usual activity in this month');
    expect(r.target.value).toBe(4);
    expect(r.percentile).toBe(100);
  });

  it('a no_data target yields no ratio and is never treated as zero', () => {
    const series = novembers(point(2026, 11, null, 'no_data'));
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.kind).toBe('target_unavailable');
    expect(r.ratio).toMatchObject({ value: null, status: 'no_data' });
  });

  it('a target absent from the series is no_data', () => {
    const series = novembers(point(2026, 11, 5, 'final'));
    const r = ratioToMedian(series, 2026, 3, BASELINE);
    expect(r.kind).toBe('target_unavailable');
    expect(r.target.status).toBe('no_data');
  });

  it('a zero target against a positive median is ×0.0, not missing', () => {
    const series = novembers(point(2026, 11, 0, 'final'));
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.ratio.value).toBe(0);
    expect(r.percentile).toBe(0);
  });

  it('rejects series whose values are not fire-day or detection totals of one unit', () => {
    const series = [
      ...novembers(point(2026, 11, 5, 'final')),
      { year: 2010, month: 11, value: honest({ value: 1, status: 'final', unit: 'frp_mw' }) },
    ];
    expect(() => ratioToMedian(series, 2026, 11, BASELINE)).toThrow();
  });
});

describe('ratioCopy()', () => {
  it('writes the headline with the real n and the real year range', () => {
    const r = ratioToMedian(novembers(point(2026, 11, 21.6, 'final')), 2026, 11, BASELINE);
    expect(ratioCopy(r, 'Novembers')).toBe('×1.8 vs median of 23 Novembers (2003–2025)');
  });

  it('marks a preliminary target', () => {
    const r = ratioToMedian(novembers(point(2026, 11, 21.6, 'preliminary')), 2026, 11, BASELINE);
    expect(ratioCopy(r, 'Novembers')).toBe(
      '×1.8 vs median of 23 Novembers (2003–2025) (preliminary)',
    );
  });

  it('explains the cases without a ratio', () => {
    const zero = ratioToMedian(
      novembers(point(2026, 11, 4, 'final'), () => 0),
      2026,
      11,
      BASELINE,
    );
    expect(ratioCopy(zero, 'Novembers')).toBe('no usual activity in this month');
    const few = ratioToMedian([point(2026, 11, 4, 'final')], 2026, 11, BASELINE);
    expect(ratioCopy(few, 'Novembers')).toBe('insufficient baseline (0 of 10 years needed)');
    const missing = ratioToMedian(novembers(point(2026, 11, null, 'no_data')), 2026, 11, BASELINE);
    expect(ratioCopy(missing, 'Novembers')).toBe('no data');
  });
});

describe('ratioToMedian() — review fixes (2026-11-15 science review)', () => {
  it('B2: refuses a ratio for a partly observed target month', () => {
    const target = { ...point(2026, 11, 6, 'preliminary'), coverage: { observed: 14, total: 30 } };
    const r = ratioToMedian(novembers(target), 2026, 11, BASELINE);
    expect(r.kind).toBe('partial_month');
    expect(r.ratio).toMatchObject({
      value: null,
      status: 'preliminary',
      note: 'partial month: 14 of 30 days observed',
    });
    expect(r.percentile).toBeNull();
    expect(ratioCopy(r, 'Novembers')).toBe('partial month: 14 of 30 days observed');
  });

  it('B2/M1: partly observed months stay out of the baseline', () => {
    const series = novembers(point(2026, 11, 12, 'final')).map((p) =>
      p.month === 11 && p.year === 2014 ? { ...p, coverage: { observed: 1, total: 30 } } : p,
    );
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(r.n).toBe(22);
  });

  it('a fully observed month with coverage given behaves as before', () => {
    const target = { ...point(2026, 11, 21.6, 'final'), coverage: { observed: 30, total: 30 } };
    expect(ratioToMedian(novembers(target), 2026, 11, BASELINE).ratio.value).toBe(1.8);
  });

  it('M3: discloses MODIS-only estimate years in the baseline', () => {
    const r = ratioToMedian(novembers(point(2026, 11, 21.6, 'final')), 2026, 11, BASELINE);
    expect(baselineNote(r)).toBe('baseline includes 9 MODIS-only estimate years of 23');
    const few = ratioToMedian([point(2026, 11, 4, 'final')], 2026, 11, BASELINE);
    expect(baselineNote(few)).toBeNull();
  });

  it('m5: the median is taken after aggregating cells, not summed from per-cell medians', () => {
    // Three cells burning in rotation: every cell's own median is 0, the AOI total is always 10.
    const cells: number[][] = [[], [], []];
    const series: MonthPoint[] = [];
    for (let y = 2003; y <= 2025; y++) {
      const perCell = [0, 1, 2].map((c) => (y % 3 === c ? 10 : 0));
      perCell.forEach((v, c) => cells[c]!.push(v));
      series.push(point(y, 11, perCell[0]! + perCell[1]! + perCell[2]!, 'final'));
    }
    series.push(point(2026, 11, 20, 'final'));
    const sumOfCellMedians = cells.reduce((sum, c) => sum + median(c)!, 0);
    const r = ratioToMedian(series, 2026, 11, BASELINE);
    expect(sumOfCellMedians).toBe(0);
    expect(r.median).toBe(10);
    expect(r.ratio.value).toBe(2);
  });
});
