import type { AoiRef } from '@/lib/api/types';
import { decodeAoi } from '@/lib/h3/aoi-id';
import type { Locale } from './messages';
import type { I18n } from './use-locale';

/**
 * Region names in every UI language. Data sources name regions in one language only (the data
 * team's API answers in Russian), so the UI owns the translations. tests/unit/places.test.ts fails
 * when a delivered region has no entry here.
 */
export const REGION_NAMES: Readonly<Record<string, Readonly<Record<Locale, string>>>> = {
  KAZAKHSTAN: { en: 'Kazakhstan', ru: 'Казахстан', tg: 'Қазоқистон' },
  TEXAS: { en: 'Texas (USA)', ru: 'Техас (США)', tg: 'Техас (ИМА)' },
};

export function regionName(iso3: string, fallback: string, locale: Locale): string {
  return REGION_NAMES[iso3.toUpperCase()]?.[locale] ?? fallback;
}

const deg = (v: number, i: I18n) => {
  const s = String(Math.round(v * 1000) / 1000);
  return i.locale === 'en' ? s : s.replace('.', ',');
};

/** The heading of an area in the current language; `fallback` is the server's label. */
export function placeName(ref: AoiRef, fallback: string, i: I18n): string {
  if (ref.kind === 'region') return regionName(ref.iso3, fallback, i.locale);
  const input = decodeAoi(ref.id);
  if (!input) return fallback;
  if (input.kind === 'point')
    return i.t.place.point(input.radiusKm, deg(input.lat, i), deg(input.lon, i));
  return i.t.place.bbox(
    deg(input.west, i),
    deg(input.east, i),
    deg(input.south, i),
    deg(input.north, i),
  );
}
