/**
 * Pure AOI description (no h3-js, safe for the browser bundle).
 * Areas of interest that can be described by numbers alone. The aoiId encodes the normalised
 * input, so `/a/<aoiId>` is shareable without storing anything; drawn polygons (F01, terra-draw)
 * will need the `aoi` table.
 *   pt_<lat>_<lon>_<radiusKm>     point + radius (5–200 km)
 *   bb_<west>_<south>_<east>_<north>
 */
export type AoiInput =
  | {
      readonly kind: 'point';
      readonly lat: number;
      readonly lon: number;
      readonly radiusKm: number;
    }
  | {
      readonly kind: 'bbox';
      readonly west: number;
      readonly south: number;
      readonly east: number;
      readonly north: number;
    };

export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 200;
/** Above this many r6 cells the AOI is computed on the coarser r4 table. */
export const MAX_FINE_CELLS = 50_000;
export const FINE_RESOLUTION = 6;
export const COARSE_RESOLUTION = 4;
/** Largest area served: covers a Kazakhstan-size bounding box (~5 M km²); computed at r4 (~6 000 cells). */
export const MAX_AREA_KM2 = 10_000_000;
/** Bounding boxes wider than this would be read as crossing the 180° meridian by H3. */
export const MAX_LON_SPAN = 90;
/** Mean area of an H3 resolution-6 cell, km² (H3 documentation). */
const R6_CELL_KM2 = 36.129;
const EARTH_R_KM = 6371.0088;
const KM_PER_DEG_LAT = 111.32;

/** Approximate area of the AOI in km² (spherical), used for limits and to choose a resolution. */
export function aoiAreaKm2(input: AoiInput): number {
  if (input.kind === 'point') return Math.PI * input.radiusKm ** 2;
  const rad = Math.PI / 180;
  return (
    EARTH_R_KM ** 2 *
    (input.east - input.west) *
    rad *
    Math.abs(Math.sin(input.north * rad) - Math.sin(input.south * rad))
  );
}

/** Expected number of resolution-6 cells, before computing any. */
export function estimateFineCells(input: AoiInput): number {
  return aoiAreaKm2(input) / R6_CELL_KM2;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Returns a list of human-readable problems; empty when the input is valid. */
export function validateAoi(input: AoiInput): string[] {
  const errors: string[] = [];
  const finite = (v: number) => Number.isFinite(v);
  if (input.kind === 'point') {
    if (!finite(input.lat) || input.lat < -90 || input.lat > 90)
      errors.push('Latitude must be between −90 and 90.');
    if (!finite(input.lon) || input.lon < -180 || input.lon > 180)
      errors.push('Longitude must be between −180 and 180.');
    if (!finite(input.radiusKm) || input.radiusKm < MIN_RADIUS_KM || input.radiusKm > MAX_RADIUS_KM)
      errors.push(`Radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km.`);
    if (errors.length === 0) {
      const dLat = input.radiusKm / KM_PER_DEG_LAT;
      if (Math.abs(input.lat) + dLat > 85) {
        errors.push(
          'This circle reaches too close to a pole; choose a lower latitude or a smaller radius.',
        );
      } else {
        const dLon = dLat / Math.cos((input.lat * Math.PI) / 180);
        if (input.lon - dLon < -180 || input.lon + dLon > 180) {
          errors.push('Areas crossing the 180° meridian are not supported yet.');
        }
      }
    }
  } else {
    const { west, south, east, north } = input;
    if (![west, south, east, north].every(finite)) errors.push('All four bounds are required.');
    else {
      if (west < -180 || east > 180) errors.push('West and east must be between −180 and 180.');
      if (south < -90 || north > 90) errors.push('South and north must be between −90 and 90.');
      if (west >= east) errors.push('West must be less than east.');
      if (south >= north) errors.push('South must be less than north.');
      if (east - west > MAX_LON_SPAN) {
        errors.push(
          `A box may span at most ${MAX_LON_SPAN}° of longitude (areas crossing the 180° meridian are not supported yet).`,
        );
      }
    }
  }
  if (errors.length === 0 && aoiAreaKm2(input) > MAX_AREA_KM2) {
    errors.push(
      `This area is too large (about ${Math.round(aoiAreaKm2(input) / 1e6)} million km²; the limit is ${MAX_AREA_KM2 / 1e6} million km²).`,
    );
  }
  return errors;
}

export function encodeAoi(input: AoiInput): string {
  if (input.kind === 'point') {
    return `pt_${round3(input.lat)}_${round3(input.lon)}_${round3(input.radiusKm)}`;
  }
  return `bb_${round3(input.west)}_${round3(input.south)}_${round3(input.east)}_${round3(input.north)}`;
}

/** Only canonical ids decode (the exact output of encodeAoi), so one area has one URL and one cache entry. */
export function decodeAoi(id: string): AoiInput | null {
  if (!/^(pt|bb)(_-?\d+(\.\d{1,3})?){3,4}$/.test(id)) return null;
  const parts = id.split('_');
  const nums = parts.slice(1).map(Number);
  if (!nums.every((n) => Number.isFinite(n)) || parts.slice(1).some((p) => p === '')) return null;
  let input: AoiInput | null = null;
  if (parts[0] === 'pt' && nums.length === 3) {
    input = { kind: 'point', lat: nums[0]!, lon: nums[1]!, radiusKm: nums[2]! };
  } else if (parts[0] === 'bb' && nums.length === 4) {
    input = { kind: 'bbox', west: nums[0]!, south: nums[1]!, east: nums[2]!, north: nums[3]! };
  }
  if (!input || validateAoi(input).length > 0 || encodeAoi(input) !== id) return null;
  return input;
}

/** Closed ring of [lon, lat] (GeoJSON order). A circle is a 64-gon on a local flat approximation. */
export function aoiRing(input: AoiInput): [number, number][] {
  if (input.kind === 'bbox') {
    const { west, south, east, north } = input;
    return [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ];
  }
  const ring: [number, number][] = [];
  const dLat = (input.radiusKm / 6371) * (180 / Math.PI);
  const dLon = dLat / Math.max(Math.cos((input.lat * Math.PI) / 180), 0.01);
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI;
    ring.push([
      input.lon + dLon * Math.sin(t),
      Math.max(-90, Math.min(90, input.lat + dLat * Math.cos(t))),
    ]);
  }
  return ring;
}

export function aoiBbox(input: AoiInput): [number, number, number, number] {
  const ring = aoiRing(input);
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

export function describeAoi(input: AoiInput): string {
  if (input.kind === 'point') {
    return `${input.radiusKm} km around ${round3(input.lat)}°, ${round3(input.lon)}°`;
  }
  return `${input.west}° to ${input.east}° E, ${input.south}° to ${input.north}° N`;
}
