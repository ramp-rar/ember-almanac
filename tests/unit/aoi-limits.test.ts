import { describe, expect, it } from 'vitest';
import {
  MAX_AREA_KM2,
  aoiAreaKm2,
  aoiCells,
  decodeAoi,
  encodeAoi,
  validateAoi,
} from '@/lib/h3/aoi';

/** Review 2026-11-15 (skeleton code review B1, M1, M2, m3, m4). */
describe('AOI limits', () => {
  it('B1: rejects areas above the limit with a readable error, before computing cells', () => {
    const huge = { kind: 'bbox', west: 0, south: -60, east: 90, north: 60 } as const;
    expect(validateAoi(huge).join(' ')).toMatch(/too large/);
    expect(decodeAoi('bb_-89_-80_89_80')).toBeNull();
    expect(aoiAreaKm2({ kind: 'bbox', west: 46, south: 40, east: 87, north: 55 })).toBeLessThan(
      MAX_AREA_KM2,
    );
  });

  it('B1: a large valid area goes straight to r4 and stays fast', () => {
    const started = performance.now();
    const r = aoiCells({ kind: 'bbox', west: 46, south: 40, east: 87, north: 55 });
    expect(r.resolution).toBe(4);
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it('M1: boxes wider than 90° of longitude are refused (antimeridian)', () => {
    expect(
      validateAoi({ kind: 'bbox', west: -170, south: -1, east: 170, north: 1 }).join(' '),
    ).toMatch(/90°/);
  });

  it('M1: circles crossing the 180° meridian are refused', () => {
    expect(validateAoi({ kind: 'point', lat: 0, lon: 179.9, radiusKm: 50 }).join(' ')).toMatch(
      /180°/,
    );
    expect(validateAoi({ kind: 'point', lat: 0, lon: 170, radiusKm: 50 })).toEqual([]);
  });

  it('M2: circles reaching the poles are refused instead of crashing', () => {
    expect(validateAoi({ kind: 'point', lat: 89, lon: 0, radiusKm: 200 }).join(' ')).toMatch(
      /pole/,
    );
  });

  it('m3: only canonical ids decode (no 1e1, hex, spaces or newlines)', () => {
    for (const id of [
      'pt_1e1_70_50',
      'pt_0x10_70_50',
      'pt_ 45_70_50',
      'pt_45_70_50\n',
      'pt_45.0_70_50',
    ]) {
      expect(decodeAoi(id)).toBeNull();
    }
    expect(decodeAoi('pt_45_70_50')).not.toBeNull();
  });

  it('m4: an id produced from any valid input decodes back', () => {
    const input = { kind: 'point', lat: 45.00049, lon: 70.12345, radiusKm: 5.0004 } as const;
    expect(decodeAoi(encodeAoi(input))).not.toBeNull();
  });
});
