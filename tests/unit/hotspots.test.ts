import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import type { AoiRef } from '@/lib/api/types';
import type { DatasetMeta } from '@/lib/domain/meta';
import type { FireSource, MonthCellTarget } from '@/server/repositories/fire-source';
import { NotFoundError } from '@/server/services/calendar-service';
import { MAX_HOTSPOTS, buildHotspots } from '@/server/services/hotspots-service';
import { TODAY, contractMeta, metaWithMissingMonth } from '../fixtures/meta';

const REGION: AoiRef = { kind: 'region', iso3: 'ZZB' };
const CENTER = latLngToCell(45.123456, 70.654321, 6);

interface Call {
  target: MonthCellTarget;
  year: number;
  month: number;
}

function fakeSource(cells: { h3: string; harm: number }[]): FireSource & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async listRegions() {
      return [];
    },
    async region(iso3) {
      return iso3 === 'ZZB'
        ? { iso3, nameEn: 'Mock B', bbox: [60, 40, 80, 50] as const, cellsCount: 10 }
        : null;
    },
    async regionMonthly() {
      return [];
    },
    async aoiMonthly() {
      return [];
    },
    async monthCells(target, year, month) {
      calls.push({ target, year, month });
      return cells;
    },
  };
}

const run = (
  source: FireSource,
  ref: AoiRef,
  y: number,
  m: number,
  meta: DatasetMeta = contractMeta,
) => buildHotspots({ meta, source }, ref, y, m, TODAY);

describe('buildHotspots()', () => {
  it('returns rounded [lon, lat, harm] centroids with the month status', async () => {
    const res = await run(fakeSource([{ h3: CENTER, harm: 1.23456 }]), REGION, 2015, 8);
    const [lat, lon] = cellToLatLng(CENTER);
    expect(res).toMatchObject({
      y: 2015,
      m: 8,
      status: 'final',
      unit: 'fire_days_harm',
      resolution: 6,
      truncated: false,
      maxHarm: 1.235,
    });
    expect(res.points).toEqual([
      [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4, 1.235],
    ]);
  });

  it('labels months with the domain status (estimate / preliminary)', async () => {
    const src = fakeSource([{ h3: CENTER, harm: 2 }]);
    expect((await run(src, REGION, 2005, 8)).status).toBe('estimate');
    expect((await run(src, REGION, 2026, 9)).status).toBe('preliminary');
  });

  it('future and no_data months have no points and never query the source', async () => {
    const src = fakeSource([{ h3: CENTER, harm: 5 }]);
    const future = await run(src, REGION, 2026, 12);
    expect(future).toMatchObject({ status: 'future', points: [], maxHarm: null, truncated: false });
    const before = await run(src, REGION, 2000, 3);
    expect(before).toMatchObject({ status: 'no_data', points: [], maxHarm: null });
    const missing = await run(
      src,
      REGION,
      2014,
      2,
      metaWithMissingMonth(2014, 2, ['MODIS', 'VIIRS_SNPP']),
    );
    expect(missing).toMatchObject({ status: 'no_data', points: [] });
    expect(src.calls).toHaveLength(0);
  });

  it('drops zero and negative cells and sorts by harm descending', async () => {
    const [a, b, c, d, e] = gridDisk(CENTER, 1);
    const res = await run(
      fakeSource([
        { h3: a!, harm: 0 },
        { h3: b!, harm: 0.5 },
        { h3: c!, harm: 3 },
        { h3: d!, harm: -1 },
        { h3: e!, harm: 0.0001 }, // rounds to 0 → dropped, never shown as a zero point
      ]),
      REGION,
      2015,
      8,
    );
    expect(res.points.map((p) => p[2])).toEqual([3, 0.5]);
    expect(res.maxHarm).toBe(3);
  });

  it('caps at MAX_HOTSPOTS keeping the strongest cells', async () => {
    const cells = gridDisk(CENTER, 40); // 4921 cells
    expect(cells.length).toBeGreaterThan(MAX_HOTSPOTS);
    const res = await run(
      fakeSource(cells.map((h3, i) => ({ h3, harm: i + 1 }))),
      REGION,
      2015,
      8,
    );
    expect(MAX_HOTSPOTS).toBe(4000);
    expect(res.points).toHaveLength(MAX_HOTSPOTS);
    expect(res.truncated).toBe(true);
    expect(res.maxHarm).toBe(cells.length);
    expect(res.points[0]![2]).toBe(cells.length);
    expect(res.points.at(-1)![2]).toBe(cells.length - MAX_HOTSPOTS + 1);
  });

  it('unknown region is NotFound; region target is passed to the source', async () => {
    const src = fakeSource([]);
    await expect(run(src, { kind: 'region', iso3: 'XXX' }, 2015, 8)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const res = await run(src, REGION, 2015, 8);
    expect(res).toMatchObject({ points: [], maxHarm: null, truncated: false });
    expect(src.calls[0]).toEqual({ target: { kind: 'region', iso3: 'ZZB' }, year: 2015, month: 8 });
  });

  it('an area id queries its cells at the AOI resolution', async () => {
    const src = fakeSource([{ h3: CENTER, harm: 1 }]);
    const res = await run(src, { kind: 'aoi', id: 'pt_45_70_20' }, 2015, 8);
    const call = src.calls[0]!;
    expect(call.target.kind).toBe('cells');
    if (call.target.kind === 'cells') {
      expect(call.target.resolution).toBe(6);
      expect(call.target.cells.length).toBeGreaterThan(0);
    }
    expect(res.resolution).toBe(6);
    await expect(run(src, { kind: 'aoi', id: 'nonsense' }, 2015, 8)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
