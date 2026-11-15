import { cellArea, polygonToCells } from 'h3-js';
import {
  COARSE_RESOLUTION,
  FINE_RESOLUTION,
  MAX_FINE_CELLS,
  aoiRing,
  type AoiInput,
} from './aoi-id';

/** H3 cell computation for AOIs. Server only: h3-js is a large WebAssembly-style bundle. */
export * from './aoi-id';

export interface AoiCells {
  readonly cells: string[];
  readonly resolution: number;
  readonly areaKm2: number;
  readonly coarse: boolean;
}

/** H3 cells covering the AOI (cell centres inside), switching to r4 above 50 000 r6 cells. */
export function aoiCells(input: AoiInput): AoiCells {
  const ring = aoiRing(input);
  let resolution = FINE_RESOLUTION;
  let cells = polygonToCells([ring], resolution, true);
  if (cells.length > MAX_FINE_CELLS) {
    resolution = COARSE_RESOLUTION;
    cells = polygonToCells([ring], resolution, true);
  }
  const areaKm2 = cells.reduce((sum, c) => sum + cellArea(c, 'km2'), 0);
  return { cells, resolution, areaKm2, coarse: resolution !== FINE_RESOLUTION };
}
