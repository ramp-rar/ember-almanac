'use client';

import type { ForecastMonth } from '@/lib/api/types';
import type { CorridorCheck } from '@/lib/domain/corridor';
import type { CalendarData } from '@/lib/domain/calendar';
import { useI18n } from '@/lib/i18n/use-locale';

/**
 * Expected range for the next months, taken as delivered by the data team's statistical model.
 * It is NOT a prediction of a particular fire: the copy says so, the corridors are shown as ranges
 * (never a single number), and each month is set against the usual month from past years.
 */
export function ForecastPanel({
  forecast,
  check,
  monthMedians,
}: {
  forecast: readonly ForecastMonth[];
  check: CorridorCheck | null;
  monthMedians: CalendarData['monthMedians'];
}) {
  const i = useI18n();
  const F = i.t.forecast;
  const fmt = i.n;
  if (forecast.length === 0) return null;
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
              // Per-row scale: winter months would vanish next to the spring peak otherwise.
              const scale = Math.max(1, f.hi95, u ?? 0) * 1.05;
              const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
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
      {check && (
        <div className="border-line mt-5 border-t pt-4">
          <h3 className="text-base font-semibold">{F.checkTitle}</h3>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                [F.checkLikely, check.in80, 80],
                [F.checkSure, check.in95, 95],
              ] as const
            ).map(([name, inside, target]) => {
              const pct = Math.round((inside / check.n) * 100);
              return (
                <div key={name} className="bg-panel-2 rounded-xl p-3">
                  <dt className="text-muted text-xs">{name}</dt>
                  <dd className="mt-1">
                    <span className="font-display text-2xl">{pct}%</span>{' '}
                    <span className="text-muted">{F.checkLine(inside, check.n, pct, target)}</span>
                    <div
                      className="bg-line mt-2 h-1.5 overflow-hidden rounded-full"
                      aria-hidden="true"
                    >
                      <div className="bg-ember h-full" style={{ width: `${pct}%` }} />
                    </div>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-muted mt-2 text-xs">{F.checkNote(check.from, check.to)}</p>
        </div>
      )}
    </section>
  );
}
