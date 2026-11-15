import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STATUSES } from '@/lib/domain/honest-value';
import { daysInMonth, daysOfMonth, monthEnd, monthStart } from '@/lib/domain/iso-date';
import { DatasetMetaSchema } from '@/lib/domain/meta';
import { statusOf } from '@/lib/domain/status';
import { TODAY, contractMeta, metaWithMissingMonth, rawContractMeta } from '../fixtures/meta';

describe('iso-date helpers', () => {
  it('computes month boundaries without timezones', () => {
    expect(monthStart(2000, 11)).toBe('2000-11-01');
    expect(monthEnd(2000, 10)).toBe('2000-10-31');
    expect(monthEnd(2024, 2)).toBe('2024-02-29');
    expect(monthEnd(2023, 2)).toBe('2023-02-28');
    expect(monthEnd(1900, 2)).toBe('1900-02-28');
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysOfMonth(2026, 2)).toHaveLength(28);
    expect(daysOfMonth(2026, 2)[27]).toBe('2026-02-28');
  });

  it('rejects impossible months', () => {
    expect(() => monthStart(2020, 0)).toThrow();
    expect(() => monthStart(2020, 13)).toThrow();
    expect(() => monthEnd(2020.5, 1)).toThrow();
  });
});

describe('statusOf() with the contract example meta, today = 2026-11-15', () => {
  const s = (y: number, m: number) => statusOf(y, m, contractMeta, TODAY);

  it('2000 Jan–Oct are no_data (before MODIS start), never zero', () => {
    for (let m = 1; m <= 10; m++) expect(s(2000, m)).toBe('no_data');
    expect(s(1999, 12)).toBe('no_data');
  });

  it('MODIS-only years before estimate_before_year are estimates', () => {
    expect(s(2000, 11)).toBe('estimate');
    expect(s(2005, 7)).toBe('estimate');
    expect(s(2011, 12)).toBe('estimate');
  });

  it('2012 up to the standard-processing date is final', () => {
    expect(s(2012, 1)).toBe('final');
    expect(s(2020, 8)).toBe('final');
    expect(s(2026, 6)).toBe('final');
  });

  it('months starting after the SP date are preliminary, including the current month', () => {
    expect(s(2026, 7)).toBe('preliminary');
    expect(s(2026, 11)).toBe('preliminary');
  });

  it('months starting after today are future', () => {
    expect(s(2026, 12)).toBe('future');
    expect(s(2027, 1)).toBe('future');
  });

  it('a single missing day on one platform does not blank the month', () => {
    expect(s(2016, 2)).toBe('final');
  });
});

describe('statusOf() rule order and data-driven dates', () => {
  it('future wins over no_data when today precedes the month', () => {
    expect(statusOf(2000, 3, contractMeta, '2000-05-10')).toBe('no_data');
    expect(statusOf(2000, 6, contractMeta, '2000-05-10')).toBe('future');
  });

  it('a month missing on every active platform is no_data', () => {
    // Feb 2014: only MODIS and VIIRS S-NPP were flying.
    const meta = metaWithMissingMonth(2014, 2, ['MODIS', 'VIIRS_SNPP']);
    expect(statusOf(2014, 2, meta, TODAY)).toBe('no_data');
    expect(statusOf(2014, 3, meta, TODAY)).toBe('final');
  });

  it('a month missing on only some active platforms keeps its data', () => {
    const meta = metaWithMissingMonth(2014, 2, ['VIIRS_SNPP']);
    expect(statusOf(2014, 2, meta, TODAY)).toBe('final');
  });

  it('missing-month no_data wins over preliminary and estimate', () => {
    const early = metaWithMissingMonth(2005, 6, ['MODIS']);
    expect(statusOf(2005, 6, early, TODAY)).toBe('no_data');
    const late = metaWithMissingMonth(2026, 8, [
      'MODIS',
      'VIIRS_SNPP',
      'VIIRS_NOAA20',
      'VIIRS_NOAA21',
    ]);
    expect(statusOf(2026, 8, late, TODAY)).toBe('no_data');
  });

  it('follows the dates in meta, not constants', () => {
    const meta = DatasetMetaSchema.parse({
      ...rawContractMeta,
      standard_processing_through: '2025-12-31',
      estimate_before_year: 2015,
    });
    expect(statusOf(2026, 1, meta, TODAY)).toBe('preliminary');
    expect(statusOf(2025, 12, meta, TODAY)).toBe('final');
    expect(statusOf(2014, 5, meta, TODAY)).toBe('estimate');
    expect(statusOf(2015, 5, meta, TODAY)).toBe('final');
  });

  it('preliminary beats estimate when both apply', () => {
    const meta = DatasetMetaSchema.parse({
      ...rawContractMeta,
      standard_processing_through: '2010-12-31',
    });
    expect(statusOf(2011, 3, meta, TODAY)).toBe('preliminary');
  });

  it('rejects a malformed today', () => {
    expect(() => statusOf(2020, 1, contractMeta, '15.11.2026')).toThrow();
  });

  it('always returns a known status; months after today are always future', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1995, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2000, max: 2028 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (y, m, ty, tm, td) => {
          const today = `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
          const status = statusOf(y, m, contractMeta, today);
          expect(STATUSES).toContain(status);
          expect(status === 'future').toBe(monthStart(y, m) > today);
        },
      ),
    );
  });
});
