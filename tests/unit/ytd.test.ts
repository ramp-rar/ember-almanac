import { describe, expect, it } from 'vitest';
import type { CalendarCell } from '@/lib/domain/calendar';
import { yearToDate } from '@/lib/domain/ytd';

function cell(
  y: number,
  m: number,
  h: number | null,
  opts: Partial<CalendarCell> = {},
): CalendarCell {
  return {
    y,
    m,
    s: h === null ? 'no_data' : 'final',
    cov: [30, 30],
    h,
    lo: null,
    hi: null,
    rm: null,
    rv: null,
    r: { k: 'ratio', v: null, n: 0, by: null, ne: 0, p: null, md: null },
    ...opts,
  } as CalendarCell;
}

/** Years 2010..2025 with 10 fire-days a month; 2026 Jan–Mar complete, April partial. */
function sample(target: number[]): CalendarCell[] {
  const cells: CalendarCell[] = [];
  for (let y = 2010; y <= 2025; y++) for (let m = 1; m <= 12; m++) cells.push(cell(y, m, 10));
  target.forEach((h, i) => cells.push(cell(2026, i + 1, h, { s: 'preliminary' })));
  cells.push(cell(2026, target.length + 1, 4, { cov: [10, 30], s: 'preliminary' }));
  return cells;
}

describe('yearToDate', () => {
  it('sums the complete months of the latest year and compares with the median', () => {
    const r = yearToDate(sample([20, 20, 20]))!;
    expect(r).toMatchObject({ year: 2026, toMonth: 3, value: 60, median: 30, n: 16, ratio: 2 });
    expect(r.status).toBe('preliminary');
    expect([r.from, r.to]).toEqual([2010, 2025]);
  });

  it('never uses a partly observed month', () => {
    expect(yearToDate(sample([5]))?.toMonth).toBe(1);
  });

  it('gives no ratio with fewer than 10 comparable years', () => {
    const cells = sample([20]).filter((c) => c.y >= 2018);
    const r = yearToDate(cells)!;
    expect(r.n).toBe(8);
    expect(r.median).toBeNull();
    expect(r.ratio).toBeNull();
  });

  it('skips baseline years with missing months instead of counting them as zero', () => {
    const cells = sample([20]).map((c) => (c.y === 2012 && c.m === 1 ? cell(2012, 1, null) : c));
    expect(yearToDate(cells)!.n).toBe(15);
  });

  it('is null when the latest year has no complete month yet', () => {
    const cells = sample([]);
    expect(yearToDate(cells)).toBeNull();
  });
});
