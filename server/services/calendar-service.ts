import type { AoiRef, CalendarResponse } from '@/lib/api/types';
import { buildCalendar } from '@/lib/domain/calendar';
import { isMockDataset } from '@/lib/domain/meta';
import { aoiCells, aoiRing, aoiBbox, decodeAoi, describeAoi } from '@/lib/h3/aoi';
import { getActiveSource } from '@/server/repositories/fire-source';

export class NotFoundError extends Error {}
export class NoDatasetError extends Error {}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getCalendar(ref: AoiRef, today: string): Promise<CalendarResponse> {
  const active = await getActiveSource();
  if (!active) throw new NoDatasetError('No dataset has been ingested yet.');
  const { meta, source, origin } = active;

  let aoi: CalendarResponse['aoi'];
  let rows;
  if (ref.kind === 'region') {
    const region = await source.region(ref.iso3);
    if (!region) throw new NotFoundError(`Unknown region ${ref.iso3}`);
    rows = await source.regionMonthly(ref.iso3);
    const [w, s, e, n] = region.bbox;
    aoi = {
      kind: 'region',
      id: region.iso3,
      label: region.nameEn,
      bbox: region.bbox,
      ring: [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
      cellsCount: region.cellsCount,
      areaKm2: null,
      resolution: meta.harmonization.h3_resolution,
      coarse: false,
    };
  } else {
    const input = decodeAoi(ref.id);
    if (!input) throw new NotFoundError(`Invalid area id ${ref.id}`);
    const cells = aoiCells(input);
    rows = await source.aoiMonthly(cells.cells, cells.resolution);
    aoi = {
      kind: 'aoi',
      id: ref.id,
      label: describeAoi(input),
      bbox: aoiBbox(input),
      ring: aoiRing(input),
      cellsCount: cells.cells.length,
      areaKm2: cells.areaKm2,
      resolution: cells.resolution,
      coarse: cells.coarse,
    };
  }

  return {
    aoi,
    dataset: {
      version: meta.dataset_version,
      isMock: isMockDataset(meta),
      source: origin,
      standardProcessingThrough: meta.standard_processing_through,
      nrtThrough: meta.nrt_through,
      baselineYears: meta.harmonization.baseline_years,
      estimateBeforeYear: meta.estimate_before_year,
      method: meta.harmonization.method,
      coverage: meta.coverage,
    },
    today,
    calendar: buildCalendar(rows, meta, today),
  };
}

const CSV_COLUMNS = [
  'year',
  'month',
  'harmonized',
  'harm_lo',
  'harm_hi',
  'raw_modis',
  'raw_viirs',
  'median_same_month',
  'ratio_to_median',
  'percentile',
  'status',
  'observed_days',
  'days_in_month',
  'note',
] as const;

const csvCell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return ''; // no_data stays empty, never 0
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** summary.csv of F05: one row per month, every row with its status. */
export function summaryCsv(data: CalendarResponse): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const c of data.calendar.cells) {
    if (c.s === 'future') continue;
    lines.push(
      [
        c.y,
        c.m,
        c.h,
        c.lo,
        c.hi,
        c.rm,
        c.rv,
        c.r.md,
        c.r.v,
        c.r.p,
        c.s,
        c.cov[0],
        c.cov[1],
        c.r.note,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
