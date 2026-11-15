'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { AoiPicker } from '@/components/aoi/aoi-picker';
import { BurningCalendar } from '@/components/calendar/burning-calendar';
import { Legend } from '@/components/calendar/legend';
import type { Mode } from '@/components/calendar/palette';
import { ExportPanel } from '@/components/export/export-panel';
import { ForecastPanel } from '@/components/forecast/forecast-panel';
import type { FireLayerState } from '@/components/map/aoi-map';
import { Headline } from '@/components/metric/headline';
import { useUi } from '@/components/ui-store';
import {
  aoiApiBase,
  type ApiError,
  type AoiRef,
  type CalendarResponse,
  type RegionItem,
} from '@/lib/api/types';
import { pText, trendText } from '@/lib/i18n/copy';
import { APP_NAME } from '@/lib/brand';
import { placeName } from '@/lib/i18n/places';
import { useI18n } from '@/lib/i18n/use-locale';

const AoiMap = dynamic(() => import('@/components/map/aoi-map'), {
  ssr: false,
  loading: () => <div className="card h-[26rem]" aria-hidden="true" />,
});
const YearlyCharts = dynamic(() => import('@/components/charts/yearly-charts'), {
  ssr: false,
  loading: () => <div className="h-64" aria-hidden="true" />,
});

const MODES = ['harm', 'raw', 'ratio'] as const;

/** An API error that keeps its machine code, so the UI can explain it in the user's language. */
class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
  if (!res.ok) {
    throw new ApiRequestError(body.error ?? 'internal', body.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

/** The home screen: Burning Calendar first; map, picker and export support it. */
export function Explorer({ aoi }: { aoi: AoiRef | null }) {
  const router = useRouter();
  const i = useI18n();
  const { t } = i;

  // "/" has no area yet: open the first region.
  const first = useQuery({
    queryKey: ['regions', ''],
    queryFn: () => fetchJson<RegionItem[]>('/api/regions?q='),
    enabled: aoi === null,
  });
  useEffect(() => {
    const iso3 = first.data?.[0]?.iso3;
    if (aoi === null && iso3) router.replace(`/r/${iso3}`);
  }, [aoi, first.data, router]);

  const query = useQuery({
    queryKey: ['calendar', aoi],
    queryFn: () => fetchJson<CalendarResponse>(`${aoiApiBase(aoi!)}/calendar`),
    enabled: aoi !== null,
  });

  const [url, setUrl] = useQueryStates({
    y: parseAsInteger,
    m: parseAsInteger,
    mode: parseAsStringLiteral(MODES).withDefault('harm'),
  });
  const { palette, setPalette, newestFirst, toggleOrder } = useUi();
  const [fireLayer, setFireLayer] = useState<FireLayerState>({ kind: 'loading' });

  const data = query.data;
  // A shared link with mode=raw on a source without raw counts falls back to harmonized.
  const mode: Mode = url.mode === 'raw' && data && !data.dataset.hasRaw ? 'harm' : url.mode;
  const selected = useMemo(() => {
    if (!data) return null;
    if (url.y && url.m && data.calendar.cells.some((c) => c.y === url.y && c.m === url.m)) {
      return { y: url.y, m: url.m };
    }
    return data.calendar.selected;
  }, [data, url.y, url.m]);
  const selectedCell =
    data && selected
      ? (data.calendar.cells.find((c) => c.y === selected.y && c.m === selected.m) ?? null)
      : null;

  // The browser tab names the place in the reader's language.
  useEffect(() => {
    if (!data || !aoi) return;
    document.title = `${t.pageTitle(placeName(aoi, data.aoi.label, data.aoi.names, i))} · ${APP_NAME}`;
  }, [data, aoi, i, t]);

  const error = aoi === null ? first.error : query.error;
  if (error) {
    return (
      <Shell>
        <div role="alert" className="card p-6">
          <p className="font-display text-lg">{t.explorer.loadError}</p>
          <p className="text-muted mt-1 text-sm">
            {error instanceof ApiRequestError
              ? (t.errors[error.code] ?? t.errors.internal)
              : t.errors.internal}
          </p>
          <button
            type="button"
            onClick={() => (aoi === null ? first.refetch() : query.refetch())}
            className="bg-ember text-on-ember mt-4 min-h-10 rounded-full px-4 text-sm font-medium"
          >
            {t.explorer.retry}
          </button>
        </div>
        <div className="mt-6 max-w-md">
          <AoiPicker />
        </div>
      </Shell>
    );
  }

  if (aoi === null && first.data && first.data.length === 0) {
    return (
      <Shell>
        <p role="status" className="card p-6">
          {t.explorer.noRegions}
        </p>
      </Shell>
    );
  }

  if (!data || !aoi) return <ExplorerSkeleton />;

  const { calendar } = data;
  const trend = calendar.series.trend;
  const finalOnly = calendar.series.finalOnly;
  const ex = t.explorer;
  const label = placeName(aoi, data.aoi.label, data.aoi.names, i);

  return (
    <Shell>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted font-mono text-xs tracking-wide uppercase">
            {aoi.kind === 'region' ? ex.kindRegion : ex.kindAoi}
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{label}</h1>
          <p className="text-muted mt-1 text-sm">
            {data.aoi.areaKm2 !== null && `${ex.area(i.n(Math.round(data.aoi.areaKm2)))} · `}
            {ex.cells(i.n(data.aoi.cellsCount))}
            {data.aoi.coarse && ex.coarse}
          </p>
        </div>
        <p className="text-muted max-w-md text-sm">{ex.intro}</p>
      </section>

      <ul
        aria-label={ex.honesty.join('. ')}
        className="text-muted mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs"
      >
        {ex.honesty.map((line) => (
          <li key={line} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="bg-ember inline-block h-1.5 w-1.5 rounded-full" />
            {line}
          </li>
        ))}
      </ul>

      <section
        aria-label={ex.selectedMonth}
        className="card mt-5 border-l-4 border-l-[var(--t-ember)] p-5 sm:p-6"
      >
        <Headline cell={selectedCell} />
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="cal-h" className="card min-w-0 p-4 sm:p-6">
          <h2 id="cal-h" className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="step">1</span> {ex.calTitle}
          </h2>
          <p className="text-muted mt-1 text-sm">{ex.calDesc}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <div
              role="radiogroup"
              aria-label={ex.colourBy}
              className="border-line bg-panel-2 flex flex-wrap rounded-full border p-0.5"
            >
              {MODES.filter((m) => m !== 'raw' || data.dataset.hasRaw).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setUrl({ mode: m })}
                  title={ex.modeHelp[m]}
                  className={`min-h-9 rounded-full px-3 font-medium ${mode === m ? 'bg-text text-ink' : 'text-muted hover:text-text'}`}
                >
                  {ex.modes[m]}
                </button>
              ))}
            </div>
            {mode !== 'ratio' && (
              <button
                type="button"
                onClick={() => setPalette(palette === 'inferno' ? 'cividis' : 'inferno')}
                className="border-line text-muted hover:text-text min-h-9 rounded-full border px-3"
                aria-label={ex.colourAria(t.paletteName[palette] ?? palette)}
              >
                {ex.colours(palette === 'inferno')}
              </button>
            )}
            <button
              type="button"
              onClick={toggleOrder}
              className="border-line text-muted hover:text-text min-h-9 rounded-full border px-3"
            >
              {newestFirst ? ex.newestFirst : ex.oldestFirst}
            </button>
          </div>
          <p className="text-muted mt-2 text-xs">{ex.modeHelp[mode]}</p>

          {calendar.empty && (
            <p
              role="status"
              className="border-line mt-3 rounded-lg border border-dashed p-3 text-sm"
            >
              {ex.empty}
            </p>
          )}

          <div className="mt-4">
            <BurningCalendar
              data={data}
              label={label}
              mode={mode}
              palette={palette}
              newestFirst={newestFirst}
              selected={selected}
              onSelect={(y, m) => setUrl({ y, m })}
            />
          </div>
          <div className="border-line mt-5 border-t pt-4">
            <Legend
              estimateBeforeYear={data.dataset.estimateBeforeYear}
              mode={mode}
              palette={palette}
              breaks={mode === 'raw' ? calendar.breaks.raw : calendar.breaks.harm}
            />
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-20">
          <section className="card p-4 sm:p-5">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <span className="step">2</span> {ex.mapTitle}
            </h2>
            <p className="text-muted mt-1 mb-3 text-sm">{ex.mapDesc}</p>
            <AoiMap
              key={i.locale}
              aoi={data.aoi}
              label={label}
              regionId={aoi.kind === 'region' ? aoi.iso3.toLowerCase() : null}
              month={selected ? `${selected.y}-${String(selected.m).padStart(2, '0')}` : null}
              onLayer={setFireLayer}
            />
            <FireCaption state={fireLayer} />
          </section>
          <AoiPicker />
          <ExportPanel aoi={aoi} />
        </aside>
      </div>

      <section aria-labelledby="charts-h" className="card mt-6 p-4 sm:p-6">
        <h2 id="charts-h" className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="step">3</span> {ex.trendTitle}
        </h2>
        <p className="mt-2 text-base font-medium">{trendText(calendar.series, i)}</p>
        {trend && (
          <p className="text-muted mt-1 text-sm">
            {ex.slope(i.signed(trend.slope), trend.from, trend.to)}
            {trend.estimateYears > 0 && ex.slopeEstimates(trend.estimateYears, trend.n)}.{' '}
            {finalOnly
              ? ex.checkedOnly(
                  finalOnly.from,
                  finalOnly.to,
                  finalOnly.n,
                  i.signed(finalOnly.slope),
                  pText(finalOnly.p, i),
                )
              : ex.checkedTooFew}
          </p>
        )}
        <p className="text-muted mt-1 text-xs">{ex.chartsNote}</p>
        <div className="mt-4">
          <YearlyCharts
            series={calendar.series}
            selectedYear={selected?.y ?? null}
            onSelectYear={(y) => setUrl({ y, m: selected?.m ?? 1 })}
          />
        </div>
      </section>

      {data.forecast && (
        <ForecastPanel
          forecast={data.forecast}
          check={data.forecastCheck}
          monthMedians={calendar.monthMedians}
        />
      )}

      <section id="how" className="card mt-6 scroll-mt-20 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{ex.howTitle}</h2>
        <ol className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          {ex.how.map(([title, body]) => (
            <li key={title}>
              <strong>{title}</strong> {body}
            </li>
          ))}
        </ol>
      </section>

      <section id="glossary" className="card mt-6 scroll-mt-20 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{ex.glossaryTitle}</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {ex.glossary.map(([term, def]) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="text-muted">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="text-muted mt-8 space-y-1 border-t border-[var(--t-line)] pt-4 text-xs">
        <p>
          {ex.method(
            data.dataset.method,
            data.dataset.baselineYears[0],
            data.dataset.baselineYears[1],
            data.dataset.standardProcessingThrough,
            data.dataset.nrtThrough,
          )}
        </p>
        {/* FIRMS asks for this acknowledgement verbatim, so it stays in English. */}
        <p lang="en">
          We acknowledge the use of data and imagery from NASA&apos;s Fire Information for Resource
          Management System (FIRMS), part of NASA&apos;s Earth Science Data and Information System
          (ESDIS).
        </p>
      </footer>
    </Shell>
  );
}

function FireCaption({ state }: { state: FireLayerState }) {
  const i = useI18n();
  const M = i.t.map;
  if (state.kind === 'loading') return <p className="text-muted mt-2 text-xs">{M.fireLoading}</p>;
  if (state.kind === 'none') return <p className="text-muted mt-2 text-xs">{M.fireNone}</p>;
  const title =
    state.kind === 'month'
      ? M.fireMonth(`${i.month(Number(state.month.slice(5)))} ${state.month.slice(0, 4)}`)
      : M.fireTypical(state.from, state.to);
  const extras = [
    M.fireCount(state.count),
    state.truncated ? M.fireTruncated : null,
    state.kind === 'month' && state.partial ? M.firePartial : null,
  ].filter(Boolean);
  return (
    <div className="mt-3 text-sm" aria-live="polite">
      <p className="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className="inline-block h-3 w-10 rounded-full bg-[linear-gradient(90deg,#781c6d,#cf4446,#ed6925,#fcffa4)]"
        />
        {title}
      </p>
      <p className="text-muted mt-1 text-xs">
        {extras.join(' · ')}. {M.fireLegend}
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6">
      {children}
    </main>
  );
}

export function ExplorerSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" className="animate-pulse space-y-5">
        <div className="h-16 w-72 rounded bg-[var(--t-panel)]" />
        <div className="h-28 rounded-lg bg-[var(--t-panel)]" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="h-[44rem] rounded-lg bg-[var(--t-panel)]" />
          <div className="h-[44rem] rounded-lg bg-[var(--t-panel)]" />
        </div>
      </div>
    </Shell>
  );
}
