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
  final: 'checked data: NASA has finished standard processing, it will not change.',
  estimate:
    'before the newer VIIRS satellite, only MODIS saw fires; its counts are scaled to VIIRS units. Close, but less certain.',
  preliminary:
    'quick (near real-time) data. NASA re-checks it a few months later, so the number may still change a little.',
  no_data: 'no satellite observations. This is not zero: we simply do not know.',
  future: 'this month has not happened yet.',
} as const;

/** One-line, everyday titles for the five statuses (the technical name stays alongside). */
export const STATUS_TITLE = {
  final: 'Checked',
  estimate: 'Estimate (older satellite)',
  preliminary: 'Preliminary',
  no_data: 'No data',
  future: 'Not yet',
} as const;
