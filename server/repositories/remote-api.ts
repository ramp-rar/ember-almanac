import { cellToChildren, cellToLatLng, cellToParent } from 'h3-js';
import { z } from 'zod';
import type { AoiMonthRow } from '@/lib/domain/calendar';
import { DatasetMetaSchema, type DatasetMeta } from '@/lib/domain/meta';
import type { ForecastMonth } from '@/lib/api/types';
import { REGION_NAMES } from '@/lib/i18n/places';
import type { Bbox, FireSource, RegionSummary } from './fire-source';

/**
 * Source backed by the data team's Fire Calendar API (FastAPI; see docs/adr/0004).
 * Every response is validated with Zod: the API is a trust boundary, not our code.
 * The API delivers monthly harmonized "cell-days" only: no uncertainty range and no raw
 * per-sensor counts, so those fields are null (never 0).
 */

const FETCH_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
/** The API accepts H3 res 3 or 5; areas are sent as res-5 cells. */
const API_RESOLUTION = 5;
const MAX_QUERY_HEXES = 60_000;

export class RemoteApiError extends Error {}
/** The requested area is outside the regions the API has data for: "no data", never "zero". */
export class OutsideCoverageError extends Error {}

export const RegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,60}$/),
  name: z.string().min(1),
  data_end: z.iso.date(),
  last_full_month: z.string().regex(/^\d{4}-\d{2}$/),
  first_month: z.string().regex(/^\d{4}-\d{2}$/),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  hexes_r5: z.number().int().nonnegative().optional(),
});
const RegionsSchema = z.array(RegionSchema);
export type ApiRegion = z.infer<typeof RegionSchema>;

export const CalendarRowSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.number().nonnegative().nullable(),
  source: z.enum(['estimate', 'observed', 'preliminary']),
  partial: z.boolean(),
});
const CalendarSchema = z.array(CalendarRowSchema);
export const ForecastRowSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  mean: z.number().nonnegative(),
  lo80: z.number().nonnegative(),
  hi80: z.number().nonnegative(),
  lo95: z.number().nonnegative(),
  hi95: z.number().nonnegative(),
});
const ForecastSchema = z.array(ForecastRowSchema);

/** Keeps only coherent rows (lo95 ≤ lo80 ≤ mean ≤ hi80 ≤ hi95): never show a broken corridor. */
export function toForecast(rows: readonly z.infer<typeof ForecastRowSchema>[]): ForecastMonth[] {
  return rows.flatMap((r) => {
    if (!(r.lo95 <= r.lo80 && r.lo80 <= r.mean && r.mean <= r.hi80 && r.hi80 <= r.hi95)) return [];
    const [y, m] = r.month.split('-').map(Number) as [number, number];
    return [{ y, m, mean: r.mean, lo80: r.lo80, hi80: r.hi80, lo95: r.lo95, hi95: r.hi95 }];
  });
}

const QuerySchema = z.object({ calendar: CalendarSchema });
const LocateSchema = z.object({ regions: z.array(z.string()) });
export type ApiRow = z.infer<typeof CalendarRowSchema>;

const cache = new Map<string, { at: number; value: unknown }>();

async function request(base: string, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch((error: unknown) => {
    throw new RemoteApiError(
      `The fire data service is unreachable (${error instanceof Error ? error.name : 'error'}).`,
    );
  });
  if (response.status === 404) throw new OutsideCoverageError(`Not covered: ${path}`);
  if (!response.ok) throw new RemoteApiError(`The fire data service answered ${response.status}.`);
  return response.json();
}

async function cached<T>(
  key: string,
  load: () => Promise<unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const parsed = schema.safeParse(await load());
  if (!parsed.success) {
    throw new RemoteApiError('The fire data service returned data in an unexpected format.');
  }
  cache.set(key, { at: Date.now(), value: parsed.data });
  return parsed.data;
}

/** Base URL from FIRE_API_URL; only http(s), no credentials, no trailing slash. */
export function remoteApiBase(raw = process.env.FIRE_API_URL): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RemoteApiError('FIRE_API_URL is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new RemoteApiError('FIRE_API_URL must be an http(s) URL without credentials.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export const toRows = (rows: readonly ApiRow[]): AoiMonthRow[] =>
  rows.flatMap((r) => {
    if (r.value === null) return []; // a month without a value stays absent, never becomes 0
    const [year, month] = r.month.split('-').map(Number) as [number, number];
    return [
      {
        year,
        month,
        harm: r.value,
        harmLo: null,
        harmHi: null,
        rawModis: null,
        rawViirs: null,
      },
    ];
  });

const lastDayBefore = (month: string): string => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
};

/**
 * One dataset description for the whole API, derived from what the API reports. Dates are the
 * API's own: estimate until its first `observed` month, preliminary from its first `preliminary`
 * month. Assumptions that need the data team's confirmation are listed in docs/adr/0004.
 */
export async function remoteMeta(base: string): Promise<DatasetMeta> {
  return deriveMeta(await listApiRegions(base), (id) => regionRows(base, id));
}

/** Meta from region descriptions and their monthly rows (shared by the live API and the snapshot). */
export async function deriveMeta(
  regions: readonly ApiRegion[],
  rowsOf: (id: string) => Promise<readonly ApiRow[]>,
  versionPrefix = 'fire-calendar-api',
): Promise<DatasetMeta> {
  if (regions.length === 0) throw new RemoteApiError('The fire data service has no regions.');
  let nrt = '0000-00-00';
  let sp = '9999-99-99';
  let firstObserved = '9999-99';
  for (const r of regions) {
    nrt = r.data_end > nrt ? r.data_end : nrt;
    const rows = await rowsOf(r.id);
    const prelim = rows.find((x) => x.source === 'preliminary')?.month;
    const sp1 = prelim ? lastDayBefore(prelim) : r.data_end;
    sp = sp1 < sp ? sp1 : sp;
    const obs = rows.find((x) => x.source === 'observed')?.month;
    if (obs && obs < firstObserved) firstObserved = obs;
  }
  const west = Math.min(...regions.map((r) => r.bbox[0]));
  const south = Math.min(...regions.map((r) => r.bbox[1]));
  const east = Math.max(...regions.map((r) => r.bbox[2]));
  const north = Math.max(...regions.map((r) => r.bbox[3]));
  return DatasetMetaSchema.parse({
    contract_version: '1',
    dataset_version: `${versionPrefix}-${nrt}`,
    harmonization: {
      method: `Fire Calendar API (data team): MODIS-based estimate before ${firstObserved}, VIIRS S-NPP observed after; unit = cell-days of ~1 km cells`,
      unit: 'harmonized cell-days, VIIRS S-NPP equivalent',
      h3_resolution: API_RESOLUTION,
      baseline_years: [2001, 2025],
    },
    coverage: {
      MODIS: { start: '2000-11-01', end: null },
      VIIRS_SNPP: { start: `${firstObserved}-01`, end: null },
    },
    standard_processing_through: sp,
    nrt_through: nrt,
    estimate_before_year: Number(firstObserved.slice(0, 4)),
    missing_days: [],
    region_bbox: [west, south, east, north],
  });
}

async function listApiRegions(base: string): Promise<ApiRegion[]> {
  return cached('regions', () => request(base, '/regions'), RegionsSchema);
}

async function regionRows(base: string, id: string): Promise<ApiRow[]> {
  return cached(
    `cal:${id}`,
    () => request(base, `/regions/${encodeURIComponent(id)}/calendar?start_year=2000`),
    CalendarSchema,
  );
}

/** Search across the API name, the id and our names in every UI language. */
export function matchesRegion(r: ApiRegion, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const names = [r.name, r.id, ...Object.values(REGION_NAMES[r.id.toUpperCase()] ?? {})];
  return names.some((n) => n.toLowerCase().includes(q));
}

export const summary = (r: ApiRegion): RegionSummary => ({
  iso3: r.id.toUpperCase(),
  nameEn: r.name,
  bbox: r.bbox as Bbox,
});

/** Res-5 cells covering the given cells (res 6 → parents, res 4 → children). Deduplicated. */
export function toApiHexes(cells: readonly string[], resolution: number): string[] {
  const out = new Set<string>();
  for (const cell of cells) {
    if (resolution > API_RESOLUTION) out.add(cellToParent(cell, API_RESOLUTION));
    else if (resolution < API_RESOLUTION) {
      for (const child of cellToChildren(cell, API_RESOLUTION)) out.add(child);
    } else out.add(cell);
    if (out.size > MAX_QUERY_HEXES) {
      throw new OutsideCoverageError('This area is too large for the fire data service.');
    }
  }
  return [...out];
}

export function remoteApiSource(base: string): FireSource {
  return {
    // Per-cell monthly values are not served by the API (it has per-hex means only): no points.
    async monthCells() {
      return [];
    },
    async forecast(iso3) {
      try {
        return toForecast(
          await cached(
            `fc:${iso3}`,
            () => request(base, `/regions/${encodeURIComponent(iso3.toLowerCase())}/forecast`),
            ForecastSchema,
          ),
        );
      } catch (error) {
        if (error instanceof OutsideCoverageError) return null;
        throw error;
      }
    },
    async listRegions(query) {
      return (await listApiRegions(base)).filter((r) => matchesRegion(r, query)).map(summary);
    },
    async region(iso3) {
      const r = (await listApiRegions(base)).find((x) => x.id === iso3.toLowerCase());
      return r ? { ...summary(r), cellsCount: r.hexes_r5 ?? 0 } : null;
    },
    async regionMonthly(iso3) {
      const r = (await listApiRegions(base)).find((x) => x.id === iso3.toLowerCase());
      return r ? toRows(await regionRows(base, r.id)) : [];
    },
    async aoiMonthly(cells, resolution) {
      if (cells.length === 0) return [];
      const hexes = toApiHexes(cells, resolution);
      // The API answers inside one region: find it from the middle of the area.
      const mid = cells[Math.floor(cells.length / 2)]!;
      const [lat, lon] = cellToLatLng(mid);
      let regionId: string | undefined;
      try {
        const located = LocateSchema.parse(await request(base, `/locate?lat=${lat}&lon=${lon}`));
        regionId = located.regions[0];
      } catch (error) {
        if (error instanceof OutsideCoverageError) regionId = undefined;
        else if (error instanceof z.ZodError) {
          throw new RemoteApiError('The fire data service returned data in an unexpected format.');
        } else throw error;
      }
      if (!regionId) {
        throw new OutsideCoverageError(
          'There is no fire data for this place yet. Pick a place inside a covered region (see the region list).',
        );
      }
      const body = JSON.stringify({ area: { hexes }, start_year: 2000 });
      const parsed = QuerySchema.safeParse(
        await request(base, `/regions/${encodeURIComponent(regionId)}/query`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }),
      );
      if (!parsed.success) {
        throw new RemoteApiError('The fire data service returned data in an unexpected format.');
      }
      return toRows(parsed.data.calendar);
    },
  };
}

/** Test hook. */
export function clearRemoteCache(): void {
  cache.clear();
}
