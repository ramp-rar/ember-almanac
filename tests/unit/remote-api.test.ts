import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { latLngToCell } from 'h3-js';
import {
  OutsideCoverageError,
  RemoteApiError,
  clearRemoteCache,
  remoteApiBase,
  remoteApiSource,
  remoteMeta,
  toApiHexes,
} from '@/server/repositories/remote-api';
import { buildCalendar } from '@/lib/domain/calendar';

const BASE = 'http://api.test';

const region = {
  id: 'kazakhstan',
  name: 'Казахстан',
  data_end: '2026-11-14',
  last_full_month: '2026-10',
  first_month: '2000-11',
  bbox: [46.46, 40.56, 86.76, 55.47],
  hexes_r5: 7946,
};

function months(): { month: string; value: number; source: string; partial: boolean }[] {
  const out = [];
  for (let y = 2000; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2000 && m < 11) continue;
      if (y === 2026 && m > 11) continue;
      const month = `${y}-${String(m).padStart(2, '0')}`;
      out.push({
        month,
        value: 10 + m,
        source: month < '2012-02' ? 'estimate' : month >= '2026-08' ? 'preliminary' : 'observed',
        partial: month === '2026-11',
      });
    }
  }
  return out;
}

function mockFetch(handlers: Record<string, () => Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(BASE, '');
      const key = `${init?.method ?? 'GET'} ${path}`;
      const hit = Object.entries(handlers).find(([k]) => key.startsWith(k));
      if (!hit) return new Response('not found', { status: 404 });
      return hit[1]();
    }),
  );
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => clearRemoteCache());
afterEach(() => vi.unstubAllGlobals());

describe('remoteApiBase', () => {
  it('is null when unset and normalises a valid URL', () => {
    expect(remoteApiBase('')).toBeNull();
    expect(remoteApiBase('http://localhost:8000/')).toBe('http://localhost:8000');
  });
  it('rejects other schemes and embedded credentials', () => {
    expect(() => remoteApiBase('file:///etc/passwd')).toThrow(RemoteApiError);
    expect(() => remoteApiBase('http://user:pw@host')).toThrow(RemoteApiError);
    expect(() => remoteApiBase('not a url')).toThrow(RemoteApiError);
  });
});

describe('remote source', () => {
  it('maps monthly values and leaves range and raw counts null, never 0', async () => {
    mockFetch({
      'GET /regions/kazakhstan/calendar': () => json(months()),
      'GET /regions': () => json([region]),
    });
    const source = remoteApiSource(BASE);
    const rows = await source.regionMonthly('KAZAKHSTAN');
    expect(rows[0]).toEqual({
      year: 2000,
      month: 11,
      harm: 21,
      harmLo: null,
      harmHi: null,
      rawModis: null,
      rawViirs: null,
    });
    expect((await source.listRegions('казах'))[0]?.iso3).toBe('KAZAKHSTAN');
    expect(await source.region('NOPE')).toBeNull();
  });

  it('derives meta from the API: estimate years and the preliminary boundary', async () => {
    mockFetch({
      'GET /regions/kazakhstan/calendar': () => json(months()),
      'GET /regions': () => json([region]),
    });
    const meta = await remoteMeta(BASE);
    expect(meta.estimate_before_year).toBe(2012);
    expect(meta.standard_processing_through).toBe('2026-07-31');
    expect(meta.nrt_through).toBe('2026-11-14');
    expect(meta.dataset_version.startsWith('mock-')).toBe(false);
  });

  it('feeds the calendar: no range, no raw view, honest statuses', async () => {
    mockFetch({
      'GET /regions/kazakhstan/calendar': () => json(months()),
      'GET /regions': () => json([region]),
    });
    const source = remoteApiSource(BASE);
    const meta = await remoteMeta(BASE);
    const cal = buildCalendar(await source.regionMonthly('KAZAKHSTAN'), meta, '2026-11-15');
    const jan2000 = cal.cells.find((c) => c.y === 2000 && c.m === 1)!;
    expect(jan2000.s).toBe('no_data');
    expect(jan2000.h).toBeNull();
    const oct2026 = cal.cells.find((c) => c.y === 2026 && c.m === 10)!;
    expect(oct2026.s).toBe('preliminary');
    expect(oct2026.lo).toBeNull();
    expect(oct2026.rm).toBeNull();
    expect(cal.cells.find((c) => c.y === 2005 && c.m === 6)!.s).toBe('estimate');
    // Raw is unavailable: no month may show a raw zero.
    expect(cal.yearTotals.every((t) => t.raw.v === null)).toBe(true);
  });

  it('refuses an area outside the covered regions instead of showing zeros', async () => {
    mockFetch({
      'GET /regions': () => json([region]),
      'GET /locate': () => json({ detail: 'outside' }, 404),
    });
    const cell = latLngToCell(-10, 20, 6);
    await expect(remoteApiSource(BASE).aoiMonthly([cell], 6)).rejects.toBeInstanceOf(
      OutsideCoverageError,
    );
  });

  it('queries the located region with res-5 hexes', async () => {
    let body = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = url.replace(BASE, '');
        if (path.startsWith('/locate')) return json({ regions: ['kazakhstan'] });
        if (path.startsWith('/regions/kazakhstan/query')) {
          body = String(init?.body);
          return json({ calendar: months() });
        }
        return new Response('nf', { status: 404 });
      }),
    );
    const cell = latLngToCell(48, 68, 6);
    const rows = await remoteApiSource(BASE).aoiMonthly([cell], 6);
    expect(rows.length).toBeGreaterThan(0);
    const sent = JSON.parse(body) as { area: { hexes: string[] } };
    expect(sent.area.hexes).toHaveLength(1);
    expect(sent.area.hexes[0]).toBe(toApiHexes([cell], 6)[0]);
  });

  it('turns a malformed or failing response into a RemoteApiError', async () => {
    mockFetch({ 'GET /regions': () => json({ not: 'a list' }) });
    await expect(remoteApiSource(BASE).listRegions('')).rejects.toBeInstanceOf(RemoteApiError);
    clearRemoteCache();
    mockFetch({ 'GET /regions': () => new Response('x', { status: 500 }) });
    await expect(remoteApiSource(BASE).listRegions('')).rejects.toBeInstanceOf(RemoteApiError);
  });
});
