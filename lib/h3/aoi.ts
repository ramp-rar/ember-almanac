import { cellArea, polygonToCells } from 'h3-js';
import {
  COARSE_RESOLUTION,
  FINE_RESOLUTION,
  MAX_FINE_CELLS,
  aoiRing,
  estimateFineCells,
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

/**
 * H3 cells covering the AOI (cell centres inside). The resolution is chosen from the estimated
 * cell count, so a large area never materialises millions of r6 cells first.
 * Callers must validate the input first (validateAoi).
 */
export function aoiCells(input: AoiInput): AoiCells {
  const ring = aoiRing(input);
  let resolution = estimateFineCells(input) > MAX_FINE_CELLS ? COARSE_RESOLUTION : FINE_RESOLUTION;
  let cells = polygonToCells([ring], resolution, true);
  if (resolution === FINE_RESOLUTION && cells.length > MAX_FINE_CELLS) {
    resolution = COARSE_RESOLUTION;
    cells = polygonToCells([ring], resolution, true);
  }
  const areaKm2 = cells.reduce((sum, c) => sum + cellArea(c, 'km2'), 0);
  return { cells, resolution, areaKm2, coarse: resolution !== FINE_RESOLUTION };
}
