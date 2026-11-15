import { baselineNote, ratioCopy } from '@/lib/domain/baseline';
import type { CalendarCell } from '@/lib/domain/calendar';
import { honest } from '@/lib/domain/honest-value';
import { STATUS_HELP, STATUS_TITLE, fmt, monthLong, monthPlural } from '@/lib/format';

/** The selected month against the median of the same month in other years, in plain words. */
export function Headline({ cell }: { cell: CalendarCell | null }) {
  if (!cell) {
    return <p className="text-muted">Click a month in the calendar to see how it compares.</p>;
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
  const big = cell.r.k === 'ratio' && cell.r.v !== null ? `×${cell.r.v.toFixed(1)}` : null;

  return (
    <div aria-live="polite" className="flex flex-wrap items-start gap-x-8 gap-y-3">
      {big && (
        <p
          aria-hidden="true"
          className="font-display text-ember-text text-6xl leading-none tracking-tight sm:text-7xl"
        >
          {big}
        </p>
      )}
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-muted text-sm font-medium">
          {monthLong(cell.m)} {cell.y}
        </p>
        <p className="font-display mt-1 text-xl leading-snug sm:text-2xl">
          {copy}
          {cell.r.k === 'ratio' && cell.h !== null && cell.r.md !== null && (
            <span className="text-muted font-sans text-base font-normal">
              {' '}
              ({fmt(cell.h)} vs usual {fmt(cell.r.md)} fire-days)
            </span>
          )}
        </p>
        {cell.r.p !== null && cell.r.k === 'ratio' && (
          <p className="mt-1 text-sm">
            More activity than {cell.r.p}% of the same months in other years{' '}
            <span className="text-muted font-mono">(P{cell.r.p})</span>.
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span
            className="border-line-strong rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide uppercase"
            title={STATUS_HELP[cell.s]}
          >
            {STATUS_TITLE[cell.s]}
          </span>
          {target.value !== null && (
            <span className="text-muted">
              {fmt(target.value)} harmonized fire-days (range {fmt(cell.lo)}–{fmt(cell.hi)}) · raw
              MODIS {fmt(cell.rm)}, VIIRS {fmt(cell.rv)}
            </span>
          )}
          {cell.h !== null && cell.cov[0] < cell.cov[1] && (
            <span className="text-muted">
              {cell.cov[0]} of {cell.cov[1]} days observed so far
            </span>
          )}
        </p>
        <p className="text-muted mt-1 text-xs">{STATUS_HELP[cell.s]}</p>
        {note && <p className="text-muted mt-1 text-xs">{note}</p>}
      </div>
    </div>
  );
}
