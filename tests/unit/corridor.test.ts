import { describe, expect, it } from 'vitest';
import { corridorCoverage, type CorridorRow } from '@/lib/domain/corridor';

const row = (month: string, actual: number | null): CorridorRow => ({
  month,
  actual,
  lo80: 10,
  hi80: 20,
  lo95: 5,
  hi95: 30,
});

describe('corridorCoverage', () => {
  it('counts inside the 80% and 95% corridors, bounds included', () => {
    const c = corridorCoverage([row('2020-02', 10), row('2020-01', 25), row('2020-03', 40)]);
    expect(c).toEqual({ n: 3, in80: 1, in95: 2, from: '2020-01', to: '2020-03' });
  });

  it('skips months without an actual value and incoherent corridors', () => {
    const broken = { ...row('2020-04', 15), lo80: 25 };
    expect(corridorCoverage([row('2020-01', null), broken])).toBeNull();
    expect(corridorCoverage([row('2020-01', null), row('2020-02', 15)])?.n).toBe(1);
  });

  it('is null for no data, never 0 of 0', () => {
    expect(corridorCoverage([])).toBeNull();
  });
});
