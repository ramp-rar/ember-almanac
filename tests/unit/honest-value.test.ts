import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  STATUSES,
  future,
  hasValue,
  honest,
  noData,
  sumHonest,
  worstStatus,
  type Status,
} from '@/lib/domain/honest-value';

describe('honest()', () => {
  it('builds a frozen value that carries its status and unit', () => {
    const v = honest({ value: 412, status: 'preliminary', unit: 'fire_days_harm' });
    expect(v).toMatchObject({ value: 412, status: 'preliminary', unit: 'fire_days_harm' });
    expect(Object.isFrozen(v)).toBe(true);
    expect(hasValue(v)).toBe(true);
  });

  it('keeps zero as a real observed value (zero is not no_data)', () => {
    const v = honest({ value: 0, status: 'final', unit: 'detections_raw' });
    expect(v.value).toBe(0);
    expect(v.status).toBe('final');
  });

  it.each(['no_data', 'future'] as const)('rejects a number for status %s', (status) => {
    expect(() => honest({ value: 0, status, unit: 'fire_days_harm' })).toThrow();
  });

  it.each(['final', 'estimate', 'preliminary'] as const)(
    'rejects null for status %s unless a note explains why',
    (status) => {
      expect(() => honest({ value: null, status, unit: 'ratio' })).toThrow();
      const v = honest({ value: null, status, unit: 'ratio', note: 'insufficient baseline' });
      expect(v.value).toBeNull();
      expect(hasValue(v)).toBe(false);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('rejects invalid number %s', (value) => {
    expect(() => honest({ value, status: 'final', unit: 'fire_days_harm' })).toThrow();
  });

  it('noData() and future() never carry a number', () => {
    expect(noData('fire_days_harm')).toMatchObject({ value: null, status: 'no_data' });
    expect(future('fire_days_harm')).toMatchObject({ value: null, status: 'future' });
  });
});

describe('worstStatus()', () => {
  it('orders no_data > future > preliminary > estimate > final', () => {
    expect(worstStatus(['final', 'estimate'])).toBe('estimate');
    expect(worstStatus(['estimate', 'preliminary', 'final'])).toBe('preliminary');
    expect(worstStatus(['preliminary', 'future'])).toBe('future');
    expect(worstStatus(['future', 'no_data', 'final'])).toBe('no_data');
    expect(worstStatus(['final', 'final'])).toBe('final');
  });

  it('treats an empty set of parts as no_data', () => {
    expect(worstStatus([])).toBe('no_data');
  });

  it('does not depend on order and is idempotent', () => {
    const statusArb = fc.constantFrom<Status>(...STATUSES);
    fc.assert(
      fc.property(fc.array(statusArb, { minLength: 1 }), (statuses) => {
        const w = worstStatus(statuses);
        expect(worstStatus([...statuses].reverse())).toBe(w);
        expect(worstStatus([...statuses, w])).toBe(w);
        expect(statuses).toContain(w);
      }),
    );
  });
});

describe('sumHonest()', () => {
  const fd = (value: number, status: 'final' | 'estimate' | 'preliminary') =>
    honest({ value, status, unit: 'fire_days_harm' });

  it('sums values and takes the worst status (a year with a preliminary month is preliminary)', () => {
    const total = sumHonest(
      [fd(10, 'final'), fd(5.5, 'preliminary'), fd(0, 'final')],
      'fire_days_harm',
    );
    expect(total.value).toBeCloseTo(15.5);
    expect(total.status).toBe('preliminary');
  });

  it('never turns a missing part into zero: any no_data part makes the total no_data', () => {
    const total = sumHonest([fd(10, 'final'), noData('fire_days_harm')], 'fire_days_harm');
    expect(total.value).toBeNull();
    expect(total.status).toBe('no_data');
    expect(total.note).toMatch(/1 of 2/);
  });

  it('a year with future months is future, not a partial number', () => {
    const total = sumHonest([fd(3, 'preliminary'), future('fire_days_harm')], 'fire_days_harm');
    expect(total).toMatchObject({ value: null, status: 'future' });
  });

  it('an empty aggregate is no_data', () => {
    expect(sumHonest([], 'fire_days_harm')).toMatchObject({ value: null, status: 'no_data' });
  });

  it('refuses to mix units', () => {
    const ratio = honest({ value: 1.2, status: 'final', unit: 'ratio' });
    expect(() => sumHonest([fd(1, 'final'), ratio], 'fire_days_harm')).toThrow();
  });
});
