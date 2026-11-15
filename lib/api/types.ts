import type { CalendarData } from '@/lib/domain/calendar';

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
    readonly source: 'database' | 'local_fixture';
    readonly standardProcessingThrough: string;
    readonly nrtThrough: string;
    readonly baselineYears: readonly [number, number];
    readonly estimateBeforeYear: number;
    readonly method: string;
  };
  readonly today: string;
  readonly calendar: CalendarData;
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
