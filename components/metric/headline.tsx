'use client';

import type { CalendarCell } from '@/lib/domain/calendar';
import { honest } from '@/lib/domain/honest-value';
import { ratioText, times } from '@/lib/i18n/copy';
import { useI18n } from '@/lib/i18n/use-locale';

/** The selected month against the median of the same month in other years, in plain words. */
export function Headline({ cell }: { cell: CalendarCell | null }) {
  const i = useI18n();
  const h = i.t.headline;
  if (!cell) return <p className="text-muted">{h.pick}</p>;

  // Rebuild the honest value on the client: a number never travels without its status.
  const target = honest({ value: cell.h, status: cell.s, unit: 'fire_days_harm' });
  const isRatio = cell.r.k === 'ratio' && cell.r.v !== null;

  return (
    <div aria-live="polite" className="flex flex-wrap items-start gap-x-8 gap-y-3">
      {isRatio && (
        <p
          aria-hidden="true"
          className="font-display text-ember-text text-6xl leading-none tracking-tight sm:text-7xl"
        >
          {times(cell.r.v!, i)}
        </p>
      )}
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-muted text-sm font-medium">
          {i.month(cell.m)} {cell.y}
        </p>
        <p className="font-display mt-1 text-xl leading-snug sm:text-2xl">
          {ratioText(cell, i)}
          {isRatio && cell.h !== null && cell.r.md !== null && (
            <span className="text-muted font-sans text-base font-normal">
              {h.vsUsual(i.n(cell.h), i.n(cell.r.md))}
            </span>
          )}
        </p>
        {cell.r.p !== null && cell.r.k === 'ratio' && (
          <p className="mt-1 text-sm">
            {h.percentile(cell.r.p)} <span className="text-muted font-mono">(P{cell.r.p})</span>.
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span
            className="border-line-strong rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide uppercase"
            title={i.t.status.help[cell.s]}
          >
            {i.t.status.title[cell.s]}
          </span>
          {target.value !== null && (
            <span className="text-muted">
              {h.harm(i.n(target.value))}
              {cell.lo !== null && cell.hi !== null && h.range(i.n(cell.lo), i.n(cell.hi))}
              {cell.rm !== null && cell.rv !== null && h.raw(i.n(cell.rm), i.n(cell.rv))}
            </span>
          )}
          {cell.h !== null && cell.cov[0] < cell.cov[1] && (
            <span className="text-muted">{h.soFar(cell.cov[0], cell.cov[1])}</span>
          )}
        </p>
        <p className="text-muted mt-1 text-xs">{i.t.status.help[cell.s]}</p>
        {cell.r.k === 'ratio' && cell.r.ne > 0 && (
          <p className="text-muted mt-1 text-xs">{h.baselineNote(cell.r.ne, cell.r.n)}</p>
        )}
      </div>
    </div>
  );
}
