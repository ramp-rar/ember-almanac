import { describe, expect, it } from 'vitest';
import { trendVerdict, yearlySeries, type YearTotal } from '@/lib/domain/calendar';

/** Science review 2026-11-15, M2: the trend speaks only when the test allows it. */
function totals(
  values: readonly (readonly [number, number | null, 'final' | 'estimate' | 'preliminary'])[],
): YearTotal[] {
  return values.map(([y, v, s]) => ({
    y,
    harm: v === null ? { v: null, s: 'no_data', note: 'gap' } : { v, s },
    raw: { v: 0, s },
  }));
}

describe('yearlySeries() trend', () => {
  it('no trend line below 10 complete years', () => {
    const s = yearlySeries(
      totals(Array.from({ length: 8 }, (_, i) => [2010 + i, 10 + i, 'final'] as const)),
      [2003, 2025],
    );
    expect(s.trend).toBeNull();
    expect(trendVerdict(s)).toBe('Not enough complete years for a trend (8 of 10 needed).');
  });

  it('a clear rise is called a trend; a flat series is not', () => {
    const up = yearlySeries(
      totals(Array.from({ length: 20 }, (_, i) => [2003 + i, 100 + 10 * i, 'final'] as const)),
      [2003, 2025],
    );
    expect(up.trend?.significant).toBe(true);
    expect(trendVerdict(up)).toMatch(/^Upward trend/);

    const flat = yearlySeries(
      totals(
        Array.from({ length: 20 }, (_, i) => [2003 + i, i % 2 === 0 ? 100 : 104, 'final'] as const),
      ),
      [2003, 2025],
    );
    expect(flat.trend?.significant).toBe(false);
    expect(trendVerdict(flat)).toMatch(/^No statistically detectable trend/);
  });

  it('counts MODIS-only estimate years and fits final years separately when there are enough', () => {
    const s = yearlySeries(
      totals(
        Array.from(
          { length: 23 },
          (_, i) => [2003 + i, 100 + i, 2003 + i < 2012 ? 'estimate' : 'final'] as const,
        ),
      ),
      [2003, 2025],
    );
    expect(s.trend?.estimateYears).toBe(9);
    expect(s.finalOnly?.n).toBe(14);
  });

  it('years without a total are kept out', () => {
    const s = yearlySeries(
      totals([
        ...Array.from({ length: 12 }, (_, i) => [2003 + i, 50, 'final'] as const),
        [2015, null, 'final'],
      ]),
      [2003, 2025],
    );
    expect(s.years.find((y) => y.y === 2015)?.complete).toBe(false);
    expect(s.mk?.n).toBe(12);
  });
});
