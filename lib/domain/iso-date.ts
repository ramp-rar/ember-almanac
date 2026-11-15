/**
 * Calendar dates as `YYYY-MM-DD` strings. No `Date` objects and no timezones:
 * ISO dates of this shape compare correctly as plain strings.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function assertYearMonth(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError(`Invalid year: ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid month: ${month}`);
  }
}

export function daysInMonth(year: number, month: number): number {
  assertYearMonth(year, month);
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function format(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** True for a real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function assertIsoDate(value: unknown, label = 'date'): asserts value is IsoDate {
  if (!isIsoDate(value))
    throw new RangeError(`Invalid ${label}: expected YYYY-MM-DD, got ${String(value)}`);
}

export function monthStart(year: number, month: number): IsoDate {
  assertYearMonth(year, month);
  return format(year, month, 1);
}

export function monthEnd(year: number, month: number): IsoDate {
  return format(year, month, daysInMonth(year, month));
}

export function daysOfMonth(year: number, month: number): IsoDate[] {
  const count = daysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => format(year, month, i + 1));
}
