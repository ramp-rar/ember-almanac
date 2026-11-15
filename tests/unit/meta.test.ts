import { describe, expect, it } from 'vitest';
import { DatasetMetaSchema, isMockDataset } from '@/lib/domain/meta';
import { contractMeta, rawContractMeta } from '../fixtures/meta';

const parse = (patch: Record<string, unknown>) =>
  DatasetMetaSchema.safeParse({ ...rawContractMeta, ...patch });

describe('DatasetMetaSchema (contract v1)', () => {
  it('accepts the example from docs/DATA_CONTRACT.md', () => {
    expect(contractMeta.coverage.MODIS.start).toBe('2000-11-01');
    expect(contractMeta.harmonization.baseline_years).toEqual([2003, 2025]);
  });

  it('rejects another contract version', () => {
    expect(parse({ contract_version: '2' }).success).toBe(false);
  });

  it('requires MODIS coverage (the no_data rule depends on it)', () => {
    const { MODIS: _omit, ...withoutModis } = rawContractMeta.coverage;
    void _omit;
    expect(parse({ coverage: withoutModis }).success).toBe(false);
  });

  it('accepts a platform we have not seen yet', () => {
    const r = parse({
      coverage: { ...rawContractMeta.coverage, VIIRS_NOAA22: { start: '2027-01-01', end: null } },
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ['impossible date', { standard_processing_through: '2026-02-30' }],
    ['non-ISO date', { nrt_through: '14/11/2026' }],
    ['NRT date before SP date', { nrt_through: '2026-01-01' }],
    ['reversed baseline years', { harmonization: { ...rawContractMeta.harmonization, baseline_years: [2025, 2003] } }],
    ['H3 resolution out of range', { harmonization: { ...rawContractMeta.harmonization, h3_resolution: 16 } }],
    ['bbox with west > east', { region_bbox: [88, 35, 46, 56] }],
    ['coverage end before start', { coverage: { MODIS: { start: '2000-11-01', end: '1999-01-01' } } }],
    ['missing day on an unknown platform', { missing_days: [{ date: '2016-02-11', platform: 'LANDSAT' }] }],
  ])('rejects %s', (_name, patch) => {
    expect(parse(patch).success).toBe(false);
  });

  it('recognises mock datasets by their version prefix', () => {
    expect(isMockDataset(contractMeta)).toBe(true);
    expect(isMockDataset({ ...contractMeta, dataset_version: '2026-11-15a' })).toBe(false);
  });
});
