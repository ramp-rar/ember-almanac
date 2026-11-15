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
