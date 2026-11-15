import type { CalendarData } from '@/lib/domain/calendar';
import type { CorridorCheck } from '@/lib/domain/corridor';

/** JSON contracts between route handlers and the UI. */

export type AoiRef =
  | { readonly kind: 'region'; readonly iso3: string }
  | { readonly kind: 'aoi'; readonly id: string };

export interface CalendarResponse {
  readonly aoi: {
    readonly kind: 'region' | 'aoi';
    readonly id: string;
    readonly label: string;
    readonly bbox: readonly [number, number, number, number];
    /** Outline for the map ([lon, lat]); regions served from the database have only a bbox. */
    readonly ring: readonly (readonly [number, number])[] | null;
    readonly cellsCount: number;
    readonly areaKm2: number | null;
    readonly resolution: number;
    readonly coarse: boolean;
  };
  readonly dataset: {
    readonly version: string;
    readonly isMock: boolean;
    readonly source: 'database' | 'local_fixture' | 'remote_api' | 'snapshot';
    /** false when the source has no per-sensor raw counts (the raw view is then unavailable). */
    readonly hasRaw: boolean;
    /** false when the source has no uncertainty range. */
    readonly hasRange: boolean;
    readonly standardProcessingThrough: string;
    readonly nrtThrough: string;
    readonly baselineYears: readonly [number, number];
    readonly estimateBeforeYear: number;
    readonly method: string;
    readonly unit: string;
    /** Sensor coverage from meta.json, for the era rail. */
    readonly coverage: Readonly<
      Record<string, { readonly start: string; readonly end: string | null }>
    >;
  };
  readonly today: string;
  readonly calendar: CalendarData;
  /** Only for whole regions whose source provides it; otherwise null. */
  readonly forecast: readonly ForecastMonth[] | null;
  /** How often past months fell inside the same model's corridors (in-sample); null if unknown. */
  readonly forecastCheck: CorridorCheck | null;
}

/** Statistical projection delivered by the data team: 6 months with 80% / 95% corridors. */
export interface ForecastMonth {
  readonly y: number;
  readonly m: number;
  readonly mean: number;
  readonly lo80: number;
  readonly hi80: number;
  readonly lo95: number;
  readonly hi95: number;
}

export interface RegionItem {
  readonly iso3: string;
  readonly nameEn: string;
  readonly bbox: readonly [number, number, number, number];
}

export interface AoiCreated {
  readonly aoiId: string;
  readonly cellsCount: number;
  readonly areaKm2: number;
  readonly resolution: number;
  readonly coarse: boolean;
}

/**
 * Where fire activity was in one month (3D globe). One point per H3 cell centroid with
 * harm > 0, strongest first. `no_data` and `future` months have no points (never zeros).
 */
export interface HotspotsResponse {
  readonly y: number;
  readonly m: number;
  readonly status: 'final' | 'estimate' | 'preliminary' | 'no_data' | 'future';
  readonly unit: 'fire_days_harm';
  /** H3 resolution of the cells behind the points (6, or 4 for coarse AOIs). */
  readonly resolution: number;
  readonly points: readonly (readonly [lon: number, lat: number, harm: number])[];
  /** True when more cells had activity than the point cap; the weakest were left out. */
  readonly truncated: boolean;
  readonly maxHarm: number | null;
}

export interface ApiError {
  readonly error: string;
  readonly message: string;
}

export function aoiPath(ref: AoiRef): string {
  return ref.kind === 'region' ? `/r/${ref.iso3}` : `/a/${ref.id}`;
}

export function aoiApiBase(ref: AoiRef): string {
  return ref.kind === 'region' ? `/api/regions/${ref.iso3}` : `/api/aoi/${ref.id}`;
}
