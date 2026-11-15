import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mannKendall, normalCdf, theilSen } from '@/lib/domain/stats';

describe('normalCdf()', () => {
  it('matches reference values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 5);
    expect(normalCdf(-1.96)).toBeCloseTo(0.0249979, 5);
    expect(normalCdf(3)).toBeCloseTo(0.9986501, 5);
  });
});

describe('theilSen()', () => {
  it('recovers an exact line', () => {
    const pts = [0, 1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x + 1 }));
    const fit = theilSen(pts)!;
    expect(fit.slope).toBeCloseTo(2, 12);
    expect(fit.intercept).toBeCloseTo(1, 12);
    expect(fit.n).toBe(6);
  });

  it('is robust to a single outlier', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 100 },
    ];
    const fit = theilSen(pts)!;
    expect(fit.slope).toBe(1);
    expect(fit.intercept).toBe(0);
  });

  it('returns null when a slope is undefined', () => {
    expect(theilSen([])).toBeNull();
    expect(theilSen([{ x: 2020, y: 5 }])).toBeNull();
    expect(
      theilSen([
        { x: 2020, y: 5 },
        { x: 2020, y: 9 },
      ]),
    ).toBeNull();
  });

  it('recovers the slope of any noiseless line', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.integer({ min: 2, max: 30 }),
        (slope, intercept, n) => {
          const pts = Array.from({ length: n }, (_, i) => ({
            x: 2000 + i,
            y: slope * (2000 + i) + intercept,
          }));
          const fit = theilSen(pts)!;
          expect(fit.slope).toBeCloseTo(slope, 6);
        },
      ),
    );
  });
});

describe('mannKendall()', () => {
  it('strictly increasing series of 10: S = 45, Var(S) = 125', () => {
    const r = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.s).toBe(45);
    expect(r.varS).toBe(125);
    expect(r.tau).toBe(1);
    expect(r.z).toBeCloseTo(44 / Math.sqrt(125), 12);
    expect(r.p).not.toBeNull();
    expect(r.p!).toBeGreaterThan(8.2e-5);
    expect(r.p!).toBeLessThan(8.4e-5);
  });

  it('applies the tie correction to the variance', () => {
    const r = mannKendall([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(r.s).toBe(40);
    expect(r.varS).toBe(120);
    expect(r.z).toBeCloseTo(39 / Math.sqrt(120), 12);
  });

  it('no trend → S = 0, z = 0, p = 1', () => {
    const r = mannKendall([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2].map((v, i) => (i < 6 ? v : 3 - v)));
    expect(r.s).toBe(0);
    expect(r.z).toBe(0);
    expect(r.p).toBeCloseTo(1, 6);
  });

  it('does not report a p-value for short or constant series', () => {
    expect(mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9]).p).toBeNull();
    expect(mannKendall([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]).p).toBeNull();
    expect(mannKendall([]).p).toBeNull();
  });

  it('reversing the series flips the sign of S and keeps p', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 10, maxLength: 30 }),
        (xs) => {
          const a = mannKendall(xs);
          const b = mannKendall([...xs].reverse());
          expect(b.s).toBe(-a.s === 0 ? 0 : -a.s);
          expect(b.varS).toBe(a.varS);
          if (a.p === null) expect(b.p).toBeNull();
          else {
            expect(b.p!).toBeCloseTo(a.p, 12);
            expect(a.p).toBeGreaterThanOrEqual(0);
            expect(a.p).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });
});
