import { expect, test } from '@playwright/test';

/** GET /api/{regions/:iso3|aoi/:aoiId}/hotspots?y&m — where fire activity was in one month. */
test.describe('Hotspots API', () => {
  test('region month in the past returns sorted centroids with a status', async ({ request }) => {
    const res = await request.get('/api/regions/ZZB/hotspots?y=2015&m=8');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('s-maxage');
    const body = await res.json();
    expect(body).toMatchObject({ y: 2015, m: 8, status: 'final', unit: 'fire_days_harm' });
    expect(body.resolution).toBe(6);
    expect(body.points.length).toBeGreaterThan(0);
    expect(body.points.length).toBeLessThanOrEqual(4000);
    const harms = body.points.map((p: number[]) => p[2]);
    expect(harms.every((h: number) => h > 0)).toBe(true);
    expect([...harms].sort((a, b) => b - a)).toEqual(harms);
    expect(body.maxHarm).toBe(harms[0]);
    for (const [lon, lat] of body.points.slice(0, 50)) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
  });

  test('area id works the same way', async ({ request }) => {
    const res = await request.get('/api/aoi/pt_45_70_150/hotspots?y=2015&m=8');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('final');
    expect(Array.isArray(body.points)).toBe(true);
  });

  test('bad month or year is 400 with the ApiError shape', async ({ request }) => {
    for (const q of ['y=2015&m=13', 'y=2015&m=0', 'y=2015', 'y=1999&m=5', 'y=2015.5&m=1']) {
      const res = await request.get(`/api/regions/ZZB/hotspots?${q}`);
      expect(res.status(), q).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('bad_request');
      expect(typeof body.message).toBe('string');
    }
    expect((await request.get('/api/aoi/pt_45_70_150/hotspots?y=2015&m=13')).status()).toBe(400);
  });

  test('unknown region is 404', async ({ request }) => {
    const res = await request.get('/api/regions/XXX/hotspots?y=2015&m=8');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  test('future month has status future and no points (never zeros)', async ({ request }) => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const res = await request.get(
      `/api/regions/ZZB/hotspots?y=${next.getUTCFullYear()}&m=${next.getUTCMonth() + 1}`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'future', points: [], maxHarm: null, truncated: false });
  });
});
