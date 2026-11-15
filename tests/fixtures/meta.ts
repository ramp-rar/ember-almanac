import { daysOfMonth } from '@/lib/domain/iso-date';
import { DatasetMetaSchema, type DatasetMeta } from '@/lib/domain/meta';

/** The example from docs/DATA_CONTRACT.md, verbatim (raw JSON shape, before validation). */
export const rawContractMeta = {
  contract_version: '1',
  dataset_version: 'mock-2026-11-15a',
  harmonization: {
    method: 'log-linear per month, chain Aqua→S-NPP→NOAA-20',
    unit: 'harmonized fire-days, VIIRS(NOAA-20)-equivalent',
    h3_resolution: 6,
    baseline_years: [2003, 2025],
  },
  coverage: {
    MODIS: { start: '2000-11-01', end: null },
    VIIRS_SNPP: { start: '2012-01-20', end: '2026-11-02' },
    VIIRS_NOAA20: { start: '2018-04-01', end: null },
    VIIRS_NOAA21: { start: '2023-03-01', end: null },
  },
  standard_processing_through: '2026-06-30',
  nrt_through: '2026-11-14',
  estimate_before_year: 2012,
  missing_days: [{ date: '2016-02-11', platform: 'VIIRS_SNPP' }],
  region_bbox: [46.0, 35.0, 88.0, 56.0],
} as const;

export const contractMeta: DatasetMeta = DatasetMetaSchema.parse(rawContractMeta);

/** Same meta, plus every day of the given month missing on the given platforms. */
export function metaWithMissingMonth(
  year: number,
  month: number,
  platforms: readonly string[],
): DatasetMeta {
  const missing = daysOfMonth(year, month).flatMap((date) =>
    platforms.map((platform) => ({ date, platform })),
  );
  return DatasetMetaSchema.parse({
    ...rawContractMeta,
    missing_days: [...rawContractMeta.missing_days, ...missing],
  });
}

export const TODAY = '2026-11-15';
