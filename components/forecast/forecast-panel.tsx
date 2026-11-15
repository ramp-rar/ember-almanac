import type { ForecastMonth } from '@/lib/api/types';
import type { CalendarData } from '@/lib/domain/calendar';
import { fmt, monthLong } from '@/lib/format';

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
  if (forecast.length === 0) return null;
  const scale = Math.max(1, ...forecast.map((f) => f.hi95));
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const usual = (m: number) => monthMedians.find((x) => x.m === m)?.harm.v ?? null;

  return (
    <section aria-labelledby="fc-h" className="card mt-6 p-4 sm:p-6">
      <h2 id="fc-h" className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="step">4</span> What to expect in the coming months
      </h2>
      <p className="text-muted mt-1 max-w-3xl text-sm">
        A statistical range based on how this place behaved in past years. It is{' '}
        <strong className="text-text">not a forecast of any particular fire</strong>: a real month
        can fall outside the range. Use it to see what is normal, not to plan around a single
        number.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            Expected range of harmonized fire-days for each of the next months, with the usual value
            for that month in past years
          </caption>
          <thead>
            <tr className="text-muted text-left text-xs">
              <th scope="col" className="py-2 pr-3 font-medium">
                Month
              </th>
              <th scope="col" className="w-full py-2 pr-3 font-medium">
                Range (dark: likely · light: almost certain)
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Likely range
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Usual
              </th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f) => {
              const u = usual(f.m);
              return (
                <tr key={`${f.y}-${f.m}`} className="border-line border-t">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium whitespace-nowrap">
                    {monthLong(f.m)} {f.y}
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
                        title={`middle estimate ${fmt(f.mean)}`}
                      />
                      {u !== null && (
                        <div
                          className="border-text absolute -inset-y-1 border-l border-dashed"
                          style={{ left: pct(u) }}
                          title={`usual ${fmt(u)}`}
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
      <p className="text-muted mt-3 text-xs">
        Solid mark = middle estimate · dashed line = usual month (median of past years). The ranges
        come from the data team&apos;s model (method still to be documented); the corridors are
        meant to hold the real value about 8 times in 10 (dark) and 19 in 20 (light) — we have not
        verified that ourselves. The current month is only partly observed.
      </p>
    </section>
  );
}
