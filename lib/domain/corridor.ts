/**
 * How often the real month fell inside the data team's corridors in the past.
 * Pure: counts only months where both the actual value and a coherent corridor exist.
 * The corridors were fitted on these same months (in-sample), so this is an upper bound of how
 * well they would have worked in advance; the UI must say so.
 */

export interface CorridorRow {
  readonly month: string; // YYYY-MM
  readonly actual: number | null;
  readonly lo80: number;
  readonly hi80: number;
  readonly lo95: number;
  readonly hi95: number;
}

export interface CorridorCheck {
  readonly n: number;
  readonly in80: number;
  readonly in95: number;
  readonly from: string;
  readonly to: string;
}

const coherent = (r: CorridorRow) => r.lo95 <= r.lo80 && r.lo80 <= r.hi80 && r.hi80 <= r.hi95;

export function corridorCoverage(rows: readonly CorridorRow[]): CorridorCheck | null {
  const usable = rows
    .filter((r) => r.actual !== null && Number.isFinite(r.actual) && coherent(r))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (usable.length === 0) return null;
  let in80 = 0;
  let in95 = 0;
  for (const r of usable) {
    const v = r.actual as number;
    if (v >= r.lo80 && v <= r.hi80) in80 += 1;
    if (v >= r.lo95 && v <= r.hi95) in95 += 1;
  }
  return {
    n: usable.length,
    in80,
    in95,
    from: usable[0]!.month,
    to: usable[usable.length - 1]!.month,
  };
}
