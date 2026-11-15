import { describe, expect, it } from 'vitest';
import snapshot from '@/data/snapshot/regions.json';
import { LOCALES } from '@/lib/i18n/messages';
import { REGION_NAMES, regionName } from '@/lib/i18n/places';
import { matchesRegion } from '@/server/repositories/remote-api';

describe('region names', () => {
  it('every delivered region has a name in every UI language', () => {
    for (const r of snapshot.regions) {
      const names = REGION_NAMES[r.id.toUpperCase()];
      expect(names, `add ${r.id} to REGION_NAMES in lib/i18n/places.ts`).toBeDefined();
      for (const l of LOCALES) expect(names?.[l]?.trim(), `${r.id}:${l}`).toBeTruthy();
    }
  });

  it('falls back to the source name for an unknown region', () => {
    expect(regionName('ZZB', 'Mock Region', 'ru')).toBe('Mock Region');
    expect(regionName('KAZAKHSTAN', 'Казахстан', 'en')).toBe('Kazakhstan');
  });

  it('search finds a region by its name in any language', () => {
    const kz = snapshot.regions.find((r) => r.id === 'kazakhstan')!;
    const region = { ...kz, bbox: kz.bbox as [number, number, number, number] };
    for (const q of ['kazakh', 'Казах', 'Қазоқ', 'KAZ'])
      expect(matchesRegion(region, q), q).toBe(true);
    expect(matchesRegion(region, 'texas')).toBe(false);
  });
});

describe('regionAt', () => {
  it('finds the region whose box holds the point, or none', async () => {
    const { regionAt } = await import('@/components/aoi/aoi-picker');
    const regions = snapshot.regions.map((r) => ({
      iso3: r.id.toUpperCase(),
      nameEn: r.name,
      bbox: r.bbox as [number, number, number, number],
    }));
    expect(regionAt(regions, 43.24, 76.95)?.iso3).toBe('KAZAKHSTAN'); // Almaty
    expect(regionAt(regions, 29.76, -95.37)?.iso3).toBe('TEXAS'); // Houston
    expect(regionAt(regions, 38.56, 68.79)).toBeNull(); // Dushanbe: not delivered yet
  });
});
