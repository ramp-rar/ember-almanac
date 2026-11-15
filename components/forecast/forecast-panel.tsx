'use client';

import type { ForecastMonth } from '@/lib/api/types';
import type { CalendarData } from '@/lib/domain/calendar';
import { useI18n } from '@/lib/i18n/use-locale';

/**
 * Expected range for the next months, taken as delivered by the data team's statistical model.
 * It is NOT a prediction of a particular fire: the copy says so, the corridors are shown as ranges
 * (never a single number), and each month is set against the usual month from past years.
 */
export function ForecastPanel({
  forecast,
  monthMedians,
}: {
  forecast: readonly ForecastMonth[];
  monthMedians: CalendarData['monthMedians'];
}) {
  const i = useI18n();
  const F = i.t.forecast;
  const fmt = i.n;
  if (forecast.length === 0) return null;
  const scale = Math.max(1, ...forecast.map((f) => f.hi95));
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const usual = (m: number) => monthMedians.find((x) => x.m === m)?.harm.v ?? null;

  return (
    <section aria-labelledby="fc-h" className="card mt-6 p-4 sm:p-6">
      <h2 id="fc-h" className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="step">4</span> {F.title}
      </h2>
      <p className="text-muted mt-1 max-w-3xl text-sm">
        {F.intro1}
        <strong className="text-text">{F.introStrong}</strong>
        {F.intro2}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">{F.caption}</caption>
          <thead>
            <tr className="text-muted text-left text-xs">
              <th scope="col" className="py-2 pr-3 font-medium">
                {F.colMonth}
              </th>
              <th scope="col" className="w-full py-2 pr-3 font-medium">
                {F.colRange}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {F.colLikely}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {F.colUsual}
              </th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f) => {
              const u = usual(f.m);
              return (
                <tr key={`${f.y}-${f.m}`} className="border-line border-t">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium whitespace-nowrap">
                    {i.month(f.m)} {f.y}
                  </th>
                  <td className="py-2.5 pr-3">
                    <div className="bg-panel-2 relative h-5 rounded-full" aria-hidden="true">
                      <div
                        className="absolute inset-y-1 rounded-full bg-[color-mix(in_srgb,var(--t-ember)_28%,transparent)]"
                        style={{
                          left: pct(f.lo95),
                          width: `calc(${pct(f.hi95)} - ${pct(f.lo95)})`,
                        }}
                      />
                      <div
                        className="bg-ember absolute inset-y-0.5 rounded-full"
                        style={{
                          left: pct(f.lo80),
                          width: `calc(${pct(f.hi80)} - ${pct(f.lo80)})`,
                        }}
                      />
                      <div
                        className="bg-text absolute inset-y-0 w-0.5"
                        style={{ left: pct(f.mean) }}
                        title={F.middle(fmt(f.mean))}
                      />
                      {u !== null && (
                        <div
                          className="border-text absolute -inset-y-1 border-l border-dashed"
                          style={{ left: pct(u) }}
                          title={F.usual(fmt(u))}
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap">
                    {fmt(f.lo80)}–{fmt(f.hi80)}
                  </td>
                  <td className="text-muted py-2.5 text-right font-mono">{fmt(u)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-3 text-xs">{F.foot}</p>
    </section>
  );
}
