export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function monthLong(m: number): string {
  return MONTHS_LONG[m - 1] ?? String(m);
}

export function monthPlural(m: number): string {
  return `${monthLong(m)}s`;
}

/** 0 → "0", 3.14 → "3.1", 1234.5 → "1,235". */
export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const digits = abs < 10 ? 1 : 0;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function fmtSigned(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmt(Math.abs(value))}`;
}

export const STATUS_LABEL = {
  final: 'final',
  estimate: 'estimate',
  preliminary: 'preliminary',
  no_data: 'no data',
  future: 'not yet observed',
} as const;

export const STATUS_HELP = {
  final: 'Standard-processed data.',
  estimate: 'MODIS-only year, scaled into VIIRS-equivalent units.',
  preliminary: 'Near real-time data; replaced by standard processing later.',
  no_data: 'No observations. Never shown as zero.',
  future: 'This month has not happened yet.',
} as const;
