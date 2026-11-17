import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { regionAt } from '@/components/aoi/aoi-picker';
import { LOCALES } from '@/lib/i18n/messages';
import { regionLabel } from '@/lib/i18n/places';
import { matchesQuery } from '@/server/repositories/snapshot-index';

interface IndexRegion {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  names: { en: string; ru: string; tg: string };
}
const index = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/snapshot/index.json'), 'utf8'),
) as { regions: IndexRegion[] };
const files = new Set(
  readdirSync(path.join(process.cwd(), 'data/snapshot/regions')).map((f) =>
    f.replace(/\.json$/, ''),
  ),
);

describe('snapshot regions', () => {
  it('every region has a data file and a non-empty name in every UI language', () => {
    expect(index.regions.length).toBeGreaterThan(100);
    for (const r of index.regions) {
      expect(files.has(r.id), `missing data/snapshot/regions/${r.id}.json`).toBe(true);
      for (const l of LOCALES) expect(r.names[l]?.trim(), `${r.id}:${l}`).toBeTruthy();
    }
  });

  it('Russian and Tajik names are written in Cyrillic (no untranslated Latin names)', () => {
    for (const r of index.regions) {
      for (const l of ['ru', 'tg'] as const) {
        expect(/[A-Za-z]/.test(r.names[l]), `${r.id}:${l} "${r.names[l]}"`).toBe(false);
      }
    }
  });

  it('names Tajikistan and Kazakhstan correctly in Tajik', () => {
    const tj = index.regions.find((r) => r.id === 'tajikistan')!;
    expect(tj.names).toMatchObject({ en: 'Tajikistan', ru: 'Таджикистан', tg: 'Тоҷикистон' });
    expect(index.regions.find((r) => r.id === 'kazakhstan')!.names.tg).toBe('Қазоқистон');
  });

  it('search finds a region by its name in any language', () => {
    const kz = index.regions.find((r) => r.id === 'kazakhstan')!;
    for (const q of ['kazakh', 'Казах', 'Қазоқ', 'KAZ']) {
      expect(matchesQuery(q, kz.id, kz.name, kz.names), q).toBe(true);
    }
    expect(matchesQuery('texas', kz.id, kz.name, kz.names)).toBe(false);
  });

  it('falls back to the source name when names are unknown', () => {
    expect(regionLabel(null, 'Mock Region', 'ru')).toBe('Mock Region');
    expect(regionLabel({ en: 'Kazakhstan', ru: 'Казахстан', tg: 'Қазоқистон' }, 'x', 'tg')).toBe(
      'Қазоқистон',
    );
  });
});

describe('regionAt', () => {
  it('finds a region whose box holds the point, or none', () => {
    const regions = index.regions
      .filter((r) => ['kazakhstan', 'texas'].includes(r.id))
      .map((r) => ({ iso3: r.id.toUpperCase(), nameEn: r.name, bbox: r.bbox }));
    expect(regionAt(regions, 43.24, 76.95)?.iso3).toBe('KAZAKHSTAN'); // Almaty
    expect(regionAt(regions, 29.76, -95.37)?.iso3).toBe('TEXAS'); // Houston
    expect(regionAt(regions, 38.56, 68.79)).toBeNull(); // Dushanbe is outside both boxes
  });
});

describe('cities', () => {
  const cities = index.regions.filter((r) => r.id.startsWith('city_')) as (IndexRegion & {
    country: string;
  })[];

  it('ships Central Asian and Texas cities with data, a fire-map layer and names', () => {
    expect(cities.length).toBeGreaterThanOrEqual(15);
    for (const id of ['city_dushanbe', 'city_khujand', 'city_almaty', 'city_tashkent']) {
      expect(
        cities.some((c) => c.id === id),
        id,
      ).toBe(true);
    }
    for (const c of cities) {
      expect(files.has(c.id), c.id).toBe(true);
      expect(
        readdirSync(path.join(process.cwd(), 'public/geo', c.id)).includes('index.json'),
        c.id,
      ).toBe(true);
      expect(c.names.tg).toMatch(/· 50 км$/);
    }
  });

  // 0.5° slack: coastal or border capitals (e.g. Lomé) sit on the edge of the data's box; a city
  // attached to the wrong country is far outside and still fails.
  it('each city centre lies inside (or at the edge of) its country box', () => {
    for (const c of cities) {
      const country = index.regions.find((r) => r.id === c.country)!;
      const [w, s, e, n] = c.bbox;
      const [lon, lat] = [(w + e) / 2, (s + n) / 2];
      const [cw, cs, ce, cn] = country.bbox;
      const m = 0.5;
      expect(lon >= cw - m && lon <= ce + m && lat >= cs - m && lat <= cn + m, c.id).toBe(true);
    }
  });
});
