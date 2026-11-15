import { describe, expect, it } from 'vitest';
import { HonestValue, honest, noData } from '@/lib/domain/honest-value';

describe('HonestValue cannot be forged', () => {
  it('a spread copy or a literal is not an HonestValue', () => {
    const real = noData('ratio');
    // @ts-expect-error a spread copy loses the private brand
    const forged: HonestValue = { ...real, value: 42 };
    // @ts-expect-error a literal has no brand
    const literal: HonestValue = { value: 1, status: 'final', unit: 'ratio' };
    expect(HonestValue.is(forged)).toBe(false);
    expect(HonestValue.is(literal)).toBe(false);
    expect(HonestValue.is(real)).toBe(true);
  });

  it('is immutable and serialises to plain fields', () => {
    const v = honest({ value: 3, status: 'estimate', unit: 'fire_days_harm' });
    expect(() => {
      (v as { value: number }).value = 4;
    }).toThrow();
    expect(JSON.parse(JSON.stringify(v))).toEqual({
      value: 3,
      status: 'estimate',
      unit: 'fire_days_harm',
    });
  });

  it('rejects a blank note as the reason for a missing value', () => {
    expect(() => honest({ value: null, status: 'final', unit: 'ratio', note: '  ' })).toThrow();
  });
});
