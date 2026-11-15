import { describe, expect, it } from 'vitest';
import { aoiCells, decodeAoi, encodeAoi, validateAoi, type AoiInput } from '@/lib/h3/aoi';

describe('AOI ids', () => {
  it('round-trips point and bbox inputs', () => {
    const pt: AoiInput = { kind: 'point', lat: 43.25, lon: 76.95, radiusKm: 50 };
    const bb: AoiInput = { kind: 'bbox', west: 66, south: 37, east: 75, north: 41 };
    expect(encodeAoi(pt)).toBe('pt_43.25_76.95_50');
    expect(decodeAoi(encodeAoi(pt))).toEqual(pt);
    expect(decodeAoi(encodeAoi(bb))).toEqual(bb);
  });

  it('rejects malformed or out-of-range ids', () => {
    for (const id of [
      '',
      'pt_1_2',
      'pt_91_0_50',
      'pt_0_0_500',
      'bb_10_0_5_1',
      'xx_1_2_3',
      'pt_a_b_c',
      'pt__1_50',
    ]) {
      expect(decodeAoi(id)).toBeNull();
    }
  });

  it('explains every validation problem', () => {
    expect(validateAoi({ kind: 'point', lat: 95, lon: 200, radiusKm: 1 })).toHaveLength(3);
    expect(validateAoi({ kind: 'bbox', west: 10, south: 5, east: 0, north: 1 })).toHaveLength(2);
    expect(validateAoi({ kind: 'point', lat: 0, lon: 0, radiusKm: 5 })).toEqual([]);
  });
});

describe('aoiCells()', () => {
  it('a 50 km circle is a few hundred r6 cells with about the right area', () => {
    const r = aoiCells({ kind: 'point', lat: 43, lon: 77, radiusKm: 50 });
    expect(r.resolution).toBe(6);
    expect(r.coarse).toBe(false);
    expect(r.areaKm2).toBeGreaterThan(Math.PI * 50 * 50 * 0.85);
    expect(r.areaKm2).toBeLessThan(Math.PI * 50 * 50 * 1.15);
  });

  it('switches to r4 above 50 000 r6 cells', () => {
    const r = aoiCells({ kind: 'bbox', west: 50, south: 40, east: 80, north: 55 });
    expect(r.resolution).toBe(4);
    expect(r.coarse).toBe(true);
  });
});
