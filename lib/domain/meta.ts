import { z } from 'zod';
import { isIsoDate } from './iso-date';

/**
 * `meta.json` of a science-team delivery — docs/DATA_CONTRACT.md, contract v1.
 * Every data date used by the product (MODIS start, SP date, estimate year) comes from here.
 */
const IsoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'expected a real date as YYYY-MM-DD' });

const CoverageEntrySchema = z
  .object({ start: IsoDateSchema, end: IsoDateSchema.nullable() })
  .refine((c) => c.end === null || c.end >= c.start, { message: 'coverage end is before start' });

export type CoverageEntry = z.infer<typeof CoverageEntrySchema>;
type Coverage = Record<string, CoverageEntry> & { MODIS: CoverageEntry };

const CoverageSchema = z
  .record(z.string().min(1), CoverageEntrySchema)
  .refine((c) => c.MODIS !== undefined, { message: 'coverage.MODIS is required' })
  .transform((c) => c as Coverage);

export const DatasetMetaSchema = z
  .object({
    contract_version: z.literal('1'),
    dataset_version: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    harmonization: z.object({
      method: z.string().min(1),
      unit: z.string().min(1),
      h3_resolution: z.number().int().min(0).max(15),
      baseline_years: z
        .tuple([z.number().int(), z.number().int()])
        .refine(([from, to]) => from <= to, { message: 'baseline_years must be [from, to]' }),
    }),
    coverage: CoverageSchema,
    standard_processing_through: IsoDateSchema,
    nrt_through: IsoDateSchema,
    estimate_before_year: z.number().int(),
    missing_days: z.array(z.object({ date: IsoDateSchema, platform: z.string().min(1) })),
    region_bbox: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .refine(
        ([west, south, east, north]) =>
          west < east &&
          south < north &&
          west >= -180 &&
          east <= 180 &&
          south >= -90 &&
          north <= 90,
        { message: 'region_bbox must be [west, south, east, north] in degrees' },
      ),
  })
  .refine((m) => m.nrt_through >= m.standard_processing_through, {
    message: 'nrt_through is before standard_processing_through',
    path: ['nrt_through'],
  })
  .refine((m) => m.missing_days.every((d) => m.coverage[d.platform] !== undefined), {
    message: 'missing_days refers to a platform absent from coverage',
    path: ['missing_days'],
  });

export type DatasetMeta = z.infer<typeof DatasetMetaSchema>;

/** Generated fixtures are versioned `mock-*`; the UI must show a "MOCK DATA" banner for them. */
export function isMockDataset(meta: Pick<DatasetMeta, 'dataset_version'>): boolean {
  return meta.dataset_version.startsWith('mock-');
}
