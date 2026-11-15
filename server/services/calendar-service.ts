import type { AoiRef, CalendarResponse } from '@/lib/api/types';
import { buildCalendar } from '@/lib/domain/calendar';
import { corridorCoverage } from '@/lib/domain/corridor';
import { isMockDataset } from '@/lib/domain/meta';
import { aoiCells, aoiRing, aoiBbox, decodeAoi, describeAoi } from '@/lib/h3/aoi';
import { getActiveSource } from '@/server/repositories/fire-source';

export class NotFoundError extends Error {}
export class NoDatasetError extends Error {}
/** The area cannot be computed (geometry the H3 library rejects): a client error, not an outage. */
export class InvalidAreaError extends Error {}

/** Computes cells and maps any H3 failure to a readable 400. */
export function cellsOrThrow(input: Parameters<typeof aoiCells>[0]) {
  try {
    return aoiCells(input);
  } catch (error) {
    throw new InvalidAreaError(
      `This area cannot be computed (${error instanceof Error ? error.message : 'geometry error'}). Try a smaller area or move it away from the poles.`,
    );
  }
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getCalendar(ref: AoiRef, today: string): Promise<CalendarResponse> {
  const active = await getActiveSource();
  if (!active) throw new NoDatasetError('No dataset has been ingested yet.');
  const { meta, source, origin } = active;

  let aoi: CalendarResponse['aoi'];
  let rows;
  let forecast: CalendarResponse['forecast'] = null;
  let forecastCheck: CalendarResponse['forecastCheck'] = null;
  if (ref.kind === 'region') {
    const region = await source.region(ref.iso3);
    if (!region) throw new NotFoundError(`Unknown region ${ref.iso3}`);
    rows = await source.regionMonthly(ref.iso3);
    forecast = (await source.forecast?.(ref.iso3)) ?? null;
    if (forecast) {
      const history = await source.corridorHistory?.(ref.iso3);
      forecastCheck = history ? corridorCoverage(history) : null;
    }
    const [w, s, e, n] = region.bbox;
    aoi = {
      kind: 'region',
      id: region.iso3,
      label: region.nameEn,
      names: region.names ?? null,
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
    const cells = cellsOrThrow(input);
    rows = await source.aoiMonthly(cells.cells, cells.resolution);
    aoi = {
      kind: 'aoi',
      id: ref.id,
      label: describeAoi(input),
      names: null,
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
      unit: meta.harmonization.unit,
      coverage: meta.coverage,
      hasRaw: rows.some((r) => r.rawModis !== null && r.rawViirs !== null),
      hasRange: rows.some((r) => r.harmLo !== null && r.harmHi !== null),
    },
    today,
    calendar: buildCalendar(rows, meta, today),
    forecast,
    forecastCheck,
  };
}

const CSV_COLUMNS = [
  'year',
  'month',
  'status',
  'harmonized_fire_days',
  'harm_lo_fire_days',
  'harm_hi_fire_days',
  'raw_modis_detections',
  'raw_viirs_detections',
  'median_same_month_fire_days',
  'ratio_to_median',
  'percentile_rank',
  'baseline_n',
  'baseline_from',
  'baseline_to',
  'baseline_estimate_years',
  'observed_days',
  'days_in_month',
  'dataset_version',
  'note',
] as const;

const csvCell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return ''; // no_data stays empty, never 0
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/**
 * summary.csv of F05: one row per observed month, every row with its status, the baseline that
 * was actually used and the dataset version. Metadata (method, AOI, acknowledgement) is in
 * metadata.json (honest-labels skill: no comment rows in the CSV).
 */
export function summaryCsv(data: CalendarResponse): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const c of data.calendar.cells) {
    if (c.s === 'future') continue;
    const hasRatio = c.r.k === 'ratio' || c.r.k === 'no_usual_activity';
    lines.push(
      [
        c.y,
        c.m,
        c.s,
        c.h,
        c.lo,
        c.hi,
        c.rm,
        c.rv,
        c.r.md,
        c.r.v,
        c.r.p,
        hasRatio ? c.r.n : null,
        hasRatio ? c.r.by?.[0] : null,
        hasRatio ? c.r.by?.[1] : null,
        hasRatio ? c.r.ne : null,
        c.cov[0],
        c.cov[1],
        data.dataset.version,
        c.r.note,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export const FIRMS_ACKNOWLEDGEMENT =
  "We acknowledge the use of data and imagery from NASA's Fire Information for Resource Management System (FIRMS), part of NASA's Earth Science Data and Information System (ESDIS).";

/** metadata.json that travels with summary.csv (F05). */
export function exportMetadata(data: CalendarResponse, exportedAt: string) {
  return {
    dataset_version: data.dataset.version,
    is_mock: data.dataset.isMock,
    method: data.dataset.method,
    unit: data.dataset.unit,
    baseline_years: data.dataset.baselineYears,
    estimate_before_year: data.dataset.estimateBeforeYear,
    standard_processing_through: data.dataset.standardProcessingThrough,
    nrt_through: data.dataset.nrtThrough,
    aoi: {
      kind: data.aoi.kind,
      id: data.aoi.id,
      label: data.aoi.label,
      cells: data.aoi.cellsCount,
      h3_resolution: data.aoi.resolution,
      area_km2: data.aoi.areaKm2,
      geometry: data.aoi.ring ? { type: 'Polygon', coordinates: [data.aoi.ring] } : null,
    },
    statuses: {
      final: 'standard-processed data',
      estimate: 'MODIS-only year, scaled into VIIRS-equivalent units',
      preliminary: 'near real-time data, replaced by standard processing later',
      no_data: 'no observations; values are empty, never 0',
    },
    exported_at: exportedAt,
    acknowledgement: FIRMS_ACKNOWLEDGEMENT,
  };
}
