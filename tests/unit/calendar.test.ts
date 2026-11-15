import { describe, expect, it } from 'vitest';
import {
  buildCalendar,
  formatP,
  ratioClass,
  valueBreaks,
  valueClass,
  type AoiMonthRow,
} from '@/lib/domain/calendar';
import { TODAY, contractMeta } from '../fixtures/meta';

/** Every observed month burns `base + month` fire-days; 2005 is a big year. */
function rows(): AoiMonthRow[] {
  const out: AoiMonthRow[] = [];
  for (let y = 2000; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2000 && m < 11) continue;
      if (y === 2026 && m > 11) continue;
      const harm = (y === 2005 ? 50 : 10) + m;
      out.push({
        year: y,
        month: m,
        harm,
        harmLo: harm * 0.9,
        harmHi: harm * 1.1,
        rawModis: 2,
        rawViirs: y >= 2012 ? 6 : 0,
      });
    }
  }
  return out;
}

const cal = buildCalendar(rows(), contractMeta, TODAY);
const cell = (y: number, m: number) => cal.cells.find((c) => c.y === y && c.m === m)!;

describe('buildCalendar()', () => {
  it('has 27 years × 12 months', () => {
    expect(cal.cells).toHaveLength(324);
  });

  it('2000 Jan–Oct are no_data with no number (never 0)', () => {
    for (let m = 1; m <= 10; m++) {
      expect(cell(2000, m)).toMatchObject({ s: 'no_data', h: null, rm: null, rv: null, lo: null });
    }
    expect(cell(2000, 11).s).toBe('estimate');
  });

  it('labels statuses from meta: estimate < 2012, preliminary after SP, future after today', () => {
    expect(cell(2011, 6).s).toBe('estimate');
    expect(cell(2012, 6).s).toBe('final');
    expect(cell(2026, 7).s).toBe('preliminary');
    expect(cell(2026, 12)).toMatchObject({ s: 'future', h: null });
  });

  it('the current month is partial and gets no ratio', () => {
    expect(cell(2026, 11).cov).toEqual([14, 30]);
    expect(cell(2026, 11).r.k).toBe('partial_month');
  });

  it('default selection is the last complete month', () => {
    expect(cal.selected).toEqual({ y: 2026, m: 10 });
  });

  it('ratio per cell is against the same-month median of other baseline years', () => {
    const c = cell(2005, 8);
    expect(c.r.k).toBe('ratio');
    expect(c.r.md).toBe(18);
    expect(c.r.v).toBe(3.2); // 58 / 18
    expect(c.r.n).toBe(22);
    expect(c.r.ne).toBe(8);
  });

  it('year totals: complete years sum, 2000 and 2026 have no total', () => {
    const t = (y: number) => cal.yearTotals.find((x) => x.y === y)!;
    expect(t(2010).harm).toEqual({ v: 12 * 10 + 78, s: 'estimate' });
    expect(t(2010).raw.v).toBe(24);
    expect(t(2000).harm).toMatchObject({ v: null, s: 'no_data' });
    expect(t(2026).harm).toMatchObject({ v: null, s: 'future' });
  });

  it('month medians use baseline years only and carry the worst status', () => {
    const nov = cal.monthMedians.find((x) => x.m === 11)!;
    expect(nov.n).toBe(23);
    expect(nov.harm).toEqual({ v: 21, s: 'estimate' });
  });

  it('trend uses complete final|estimate years only', () => {
    const { series } = cal;
    expect(series.trend).toMatchObject({ from: 2001, to: 2025, slope: 0 });
    expect(series.mk?.n).toBe(25);
    expect(series.years.find((y) => y.y === 2000)!.complete).toBe(false);
    expect(series.years.find((y) => y.y === 2026)!.complete).toBe(false);
    expect(series.anomalyBase).toMatchObject({ from: 2003, to: 2025, n: 23 });
    expect(series.years.find((y) => y.y === 2005)!.anomaly).toBeCloseTo(
      678 - (198 * 22 + 678) / 23,
      6,
    );
  });

  it('an AOI without fire is flagged empty, and its months are zeros, not no_data', () => {
    const none = buildCalendar([], contractMeta, TODAY);
    expect(none.empty).toBe(true);
    expect(none.cells.find((c) => c.y === 2015 && c.m === 5)).toMatchObject({ s: 'final', h: 0 });
    expect(none.breaks.harm).toEqual([]);
    expect(cal.empty).toBe(false);
  });
});

describe('colour classes', () => {
  it('zero is class 0; non-zero values use the AOI quantile breaks', () => {
    const breaks = valueBreaks([0, null, 1, 2, 3, 4, 5, 6, 7]);
    expect(breaks).toHaveLength(5);
    expect(valueClass(0, breaks)).toBe(0);
    expect(valueClass(1, breaks)).toBe(1);
    expect(valueClass(7, breaks)).toBe(6);
    expect(valueClass(0.001, [])).toBe(1);
  });

  it('ratio classes follow ≤0.5, 0.5–0.8, 0.8–1.25, 1.25–2, 2–4, ≥4', () => {
    expect([0.2, 0.5, 0.9, 1.25, 3, 4, 30].map(ratioClass)).toEqual([0, 1, 2, 3, 4, 5, 5]);
  });

  it('formats p-values with two significant figures and a floor', () => {
    expect(formatP(0.04321)).toBe('p = 0.043');
    expect(formatP(0.0004)).toBe('p < 0.001');
    expect(formatP(null)).toBe('not computed');
  });
});
