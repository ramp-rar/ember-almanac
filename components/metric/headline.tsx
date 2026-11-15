import { baselineNote, ratioCopy } from '@/lib/domain/baseline';
import type { CalendarCell } from '@/lib/domain/calendar';
import { honest } from '@/lib/domain/honest-value';
import { STATUS_LABEL, fmt, monthLong, monthPlural } from '@/lib/format';

/** F03 headline: the selected month against the median of the same month in other years. */
export function Headline({ cell }: { cell: CalendarCell | null }) {
  if (!cell) {
    return <p className="text-muted">Select a month in the calendar.</p>;
  }
  // Rebuild honest values on the client: a number never travels without its status.
  const target = honest({ value: cell.h, status: cell.s, unit: 'fire_days_harm' });
  const ratio = honest({ value: cell.r.v, status: cell.s, unit: 'ratio', note: cell.r.note });
  const copy = ratioCopy(
    { kind: cell.r.k, ratio, target, n: cell.r.n, baselineYears: cell.r.by },
    monthPlural(cell.m),
  );
  const note =
    cell.r.k === 'ratio' ? baselineNote({ baselineEstimateYears: cell.r.ne, n: cell.r.n }) : null;
  return (
    <div aria-live="polite">
      <p className="font-display text-muted text-sm">
        {monthLong(cell.m)} {cell.y}
      </p>
      <p className={`font-display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl`}>
        {copy}
        {cell.r.k === 'ratio' && cell.h !== null && cell.r.md !== null && (
          <span className="text-muted text-lg font-normal">
            {' '}
            ({fmt(cell.h)} vs usual {fmt(cell.r.md)} fire-days)
          </span>
        )}
        {cell.r.p !== null && cell.r.k === 'ratio' && (
          <span className="text-muted text-lg font-normal"> · P{cell.r.p}</span>
        )}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
        <span className="border-line rounded-sm border px-1.5 py-0.5 tracking-wide uppercase">
          {STATUS_LABEL[cell.s]}
        </span>
        {target.value !== null && (
          <span>
            {fmt(target.value)} harmonized fire-days{' '}
            <span className="text-muted">
              (range {fmt(cell.lo)}–{fmt(cell.hi)}) · raw MODIS {fmt(cell.rm)}, VIIRS {fmt(cell.rv)}
            </span>
          </span>
        )}
        {cell.h !== null && cell.cov[0] < cell.cov[1] && (
          <span className="text-muted">
            {cell.cov[0]} of {cell.cov[1]} days observed so far
          </span>
        )}
      </p>
      {note && <p className="text-muted mt-1 text-xs">{note}</p>}
    </div>
  );
}
