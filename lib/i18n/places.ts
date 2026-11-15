import type { AoiRef } from '@/lib/api/types';
import { decodeAoi } from '@/lib/h3/aoi-id';
import type { Locale } from './messages';
import type { I18n } from './use-locale';

/**
 * Names in the reader's language. Region names come with the data (data/snapshot/index.json,
 * generated from CLDR by `pnpm snapshot`); tests/unit/places.test.ts fails if a delivered region
 * lacks a name in any UI language.
 */
type Names = { readonly en: string; readonly ru: string; readonly tg: string } | null | undefined;

export function regionLabel(names: Names, fallback: string, locale: Locale): string {
  return names?.[locale] ?? fallback;
}

const deg = (v: number, i: I18n) => {
  const s = String(Math.round(v * 1000) / 1000);
  return i.locale === 'en' ? s : s.replace('.', ',');
};

/** The heading of an area in the current language; `fallback` is the server's label. */
export function placeName(ref: AoiRef, fallback: string, names: Names, i: I18n): string {
  if (ref.kind === 'region') return regionLabel(names, fallback, i.locale);
  const input = decodeAoi(ref.id);
  if (!input) return fallback;
  if (input.kind === 'point') {
    return i.t.place.point(input.radiusKm, deg(input.lat, i), deg(input.lon, i));
  }
  return i.t.place.bbox(
    deg(input.west, i),
    deg(input.east, i),
    deg(input.south, i),
    deg(input.north, i),
  );
}
