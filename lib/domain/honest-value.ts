/**
 * Every number shown to a user is an HonestValue: a value that cannot be separated from its
 * data status. See docs/PROJECT_RULES.md.
 */
export const STATUSES = ['final', 'estimate', 'preliminary', 'no_data', 'future'] as const;
export type Status = (typeof STATUSES)[number];

export type Unit = 'fire_days_harm' | 'detections_raw' | 'ratio' | 'frp_mw';

declare const honestBrand: unique symbol;

export interface HonestValue {
  /** null when status is no_data | future, or when the value cannot be computed (see `note`). */
  readonly value: number | null;
  readonly status: Status;
  readonly unit: Unit;
  /** e.g. "Terra only", "insufficient baseline". */
  readonly note?: string;
  /** Brand: only `honest()` can produce this type, so a bare number or literal never type-checks. */
  readonly [honestBrand]: true;
}

export interface HonestInput {
  readonly value: number | null;
  readonly status: Status;
  readonly unit: Unit;
  readonly note?: string;
}

function hasNoObservation(status: Status): boolean {
  return status === 'no_data' || status === 'future';
}

/**
 * The only constructor. Enforces:
 * - no_data / future never carry a number (no data ≠ zero);
 * - an observed status carries a finite number ≥ 0, or null together with a note saying why
 *   the value cannot be computed (e.g. a ratio with an insufficient baseline).
 */
export function honest(input: HonestInput): HonestValue {
  const { value, status, unit, note } = input;
  if (!STATUSES.includes(status)) throw new TypeError(`Unknown status: ${String(status)}`);

  if (hasNoObservation(status)) {
    if (value !== null) throw new RangeError(`A ${status} value must be null, got ${value}`);
  } else if (value === null) {
    if (!note)
      throw new RangeError(`A ${status} value may be null only with a note explaining why`);
  } else if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Invalid ${unit} value: ${value}`);
  }

  const result = note === undefined ? { value, status, unit } : { value, status, unit, note };
  return Object.freeze(result) as HonestValue;
}

export function noData(unit: Unit, note?: string): HonestValue {
  return honest({ value: null, status: 'no_data', unit, note });
}

export function future(unit: Unit): HonestValue {
  return honest({ value: null, status: 'future', unit });
}

export function hasValue(v: HonestValue): v is HonestValue & { readonly value: number } {
  return v.value !== null;
}

/** no_data > future > preliminary > estimate > final */
const SEVERITY: Record<Status, number> = {
  final: 0,
  estimate: 1,
  preliminary: 2,
  future: 3,
  no_data: 4,
};

/** Status of an aggregate = the worst status of its parts. No parts at all = no_data. */
export function worstStatus(statuses: Iterable<Status>): Status {
  let worst: Status | null = null;
  for (const status of statuses) {
    if (worst === null || SEVERITY[status] > SEVERITY[worst]) worst = status;
  }
  return worst ?? 'no_data';
}

/**
 * Sum of parts (months of a year, cells of an AOI) with the worst status of the parts.
 * If any part has no value the total has no value either: an unobserved part is never
 * counted as zero. The note says how many parts were observed.
 */
export function sumHonest(parts: readonly HonestValue[], unit: Unit): HonestValue {
  let total = 0;
  let observed = 0;
  for (const part of parts) {
    if (part.unit !== unit) throw new TypeError(`Cannot sum ${part.unit} into ${unit}`);
    if (part.value !== null) {
      total += part.value;
      observed += 1;
    }
  }
  const status = worstStatus(parts.map((p) => p.status));
  if (observed === parts.length && parts.length > 0) return honest({ value: total, status, unit });

  // Some part has no value: keep the worst status, withhold the number.
  return honest({
    value: null,
    status,
    unit,
    note: `${observed} of ${parts.length} parts observed`,
  });
}
