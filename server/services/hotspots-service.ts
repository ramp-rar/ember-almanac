import { cellToLatLng } from 'h3-js';
import type { AoiRef, HotspotsResponse } from '@/lib/api/types';
import type { DatasetMeta } from '@/lib/domain/meta';
import { statusOf } from '@/lib/domain/status';
import { decodeAoi } from '@/lib/h3/aoi';
import {
  getActiveSource,
  type FireSource,
  type MonthCellTarget,
} from '@/server/repositories/fire-source';
import { NoDatasetError, NotFoundError, cellsOrThrow } from './calendar-service';

/** Point budget for the globe: more than this and the weakest cells are left out. */
export const MAX_HOTSPOTS = 4000;

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

type Point = [lon: number, lat: number, harm: number];

/**
 * Hotspots of one month for an AOI. The month status comes from `statusOf` (meta + today, same as
 * the calendar); `no_data` and `future` months return no points instead of zeros.
 */
export async function buildHotspots(
  active: { readonly meta: DatasetMeta; readonly source: FireSource },
  ref: AoiRef,
  y: number,
  m: number,
  today: string,
): Promise<HotspotsResponse> {
  const { meta, source } = active;

  let target: MonthCellTarget;
  let resolution: number;
  if (ref.kind === 'region') {
    const region = await source.region(ref.iso3);
    if (!region) throw new NotFoundError(`Unknown region ${ref.iso3}`);
    target = { kind: 'region', iso3: region.iso3 };
    resolution = meta.harmonization.h3_resolution;
  } else {
    const input = decodeAoi(ref.id);
    if (!input) throw new NotFoundError(`Invalid area id ${ref.id}`);
    const cells = cellsOrThrow(input);
    target = { kind: 'cells', cells: cells.cells, resolution: cells.resolution };
    resolution = cells.resolution;
  }

  const status = statusOf(y, m, meta, today);
  const base = { y, m, status, unit: 'fire_days_harm', resolution } as const;
  if (status === 'no_data' || status === 'future') {
    return { ...base, points: [], truncated: false, maxHarm: null };
  }

  const kept: { h3: string; harm: number }[] = [];
  for (const c of await source.monthCells(target, y, m)) {
    const harm = round(c.harm, 3);
    if (Number.isFinite(harm) && harm > 0) kept.push({ h3: c.h3, harm });
  }
  // Strongest first; ties by cell id so the output (and its cache) is deterministic.
  kept.sort((a, b) => b.harm - a.harm || (a.h3 < b.h3 ? -1 : a.h3 > b.h3 ? 1 : 0));
  const truncated = kept.length > MAX_HOTSPOTS;
  const points = kept.slice(0, MAX_HOTSPOTS).map(({ h3, harm }): Point => {
    const [lat, lon] = cellToLatLng(h3);
    return [round(lon, 4), round(lat, 4), harm];
  });
  return { ...base, points, truncated, maxHarm: points[0]?.[2] ?? null };
}

export async function getHotspots(
  ref: AoiRef,
  y: number,
  m: number,
  today: string,
): Promise<HotspotsResponse> {
  const active = await getActiveSource();
  if (!active) throw new NoDatasetError('No dataset has been ingested yet.');
  return buildHotspots(active, ref, y, m, today);
}
