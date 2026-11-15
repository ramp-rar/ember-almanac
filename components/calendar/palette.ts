import { ratioClass, valueClass, type CalendarCell } from '@/lib/domain/calendar';

/** Colour-vision-deficiency-safe scales (calendar-heatmap skill). Never red/green. */
export const SEQUENTIAL = {
  inferno: ['#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fbb61a'],
  cividis: ['#00224e', '#1f3a6e', '#4b4d6b', '#6b6c71', '#8c8a74', '#b2a96a', '#fee838'],
} as const;
export type PaletteName = keyof typeof SEQUENTIAL;

/** Diverging blue ↔ orange around ×1.0: ≤0.5, 0.5–0.8, 0.8–1.25, 1.25–2, 2–4, ≥4. */
export const DIVERGING = [
  '#2b6cb0',
  '#7fb0e0',
  '#59616b',
  '#f6ad55',
  '#ed7b2b',
  '#c2410c',
] as const;

export const NO_DATA_FILL = '#2a2f36';
export const NO_RATIO_FILL = '#14181d';

export type Mode = 'harm' | 'raw' | 'ratio';

export type CellLook =
  | { readonly kind: 'colour'; readonly fill: string }
  | { readonly kind: 'no_data' }
  | { readonly kind: 'future' }
  | { readonly kind: 'no_ratio' };

export function rawTotal(c: CalendarCell): number | null {
  return c.rm === null || c.rv === null ? null : c.rm + c.rv;
}

export function cellLook(
  c: CalendarCell,
  mode: Mode,
  breaks: { harm: readonly number[]; raw: readonly number[] },
  palette: PaletteName,
): CellLook {
  if (c.s === 'future') return { kind: 'future' };
  if (c.s === 'no_data' || c.h === null) return { kind: 'no_data' };
  if (mode === 'ratio') {
    if (c.r.v === null) return { kind: 'no_ratio' };
    return { kind: 'colour', fill: DIVERGING[ratioClass(c.r.v)]! };
  }
  const value = mode === 'harm' ? c.h : (rawTotal(c) ?? 0);
  const cls = valueClass(value, mode === 'harm' ? breaks.harm : breaks.raw);
  return { kind: 'colour', fill: SEQUENTIAL[palette][cls]! };
}
