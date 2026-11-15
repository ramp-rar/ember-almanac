'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useMemo } from 'react';
import { AoiPicker } from '@/components/aoi/aoi-picker';
import { BurningCalendar } from '@/components/calendar/burning-calendar';
import { Legend } from '@/components/calendar/legend';
import type { Mode } from '@/components/calendar/palette';
import { ExportPanel } from '@/components/export/export-panel';
import { ForecastPanel } from '@/components/forecast/forecast-panel';
import { Headline } from '@/components/metric/headline';
import { useUi } from '@/components/ui-store';
import {
  aoiApiBase,
  type ApiError,
  type AoiRef,
  type CalendarResponse,
  type RegionItem,
} from '@/lib/api/types';
import { formatP, trendVerdict } from '@/lib/domain/calendar';
import { fmt, fmtSigned } from '@/lib/format';

const AoiMap = dynamic(() => import('@/components/map/aoi-map'), {
  ssr: false,
  loading: () => <div className="card h-[26rem]" aria-hidden="true" />,
});
const YearlyCharts = dynamic(() => import('@/components/charts/yearly-charts'), {
  ssr: false,
  loading: () => <div className="h-64" aria-hidden="true" />,
});

const MODES = ['harm', 'raw', 'ratio'] as const;
const MODE_LABEL: Record<Mode, string> = {
  harm: 'Harmonized fire-days',
  raw: 'Raw detections',
  ratio: 'Ratio to median',
};
const MODE_HELP: Record<Mode, string> = {
  harm: 'Both satellites on one scale: the fair way to compare years.',
  raw: 'Plain satellite counts. They jump when the newer satellite starts, so do not compare years with this.',
  ratio: 'How this month compares with the usual one: blue is quieter, orange is busier.',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as ApiError).message ?? `Request failed (${res.status})`);
  return body as T;
}

/** The home screen: Burning Calendar first; map, picker and export support it. */
export function Explorer({ aoi }: { aoi: AoiRef | null }) {
  const router = useRouter();

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

  const data = query.data;
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

  const error = aoi === null ? first.error : query.error;
  if (error) {
    return (
      <Shell>
        <div role="alert" className="card p-6">
          <p className="font-display text-lg">Could not load the calendar.</p>
          <p className="text-muted mt-1 text-sm">{(error as Error).message}</p>
          <button
            type="button"
            onClick={() => (aoi === null ? first.refetch() : query.refetch())}
            className="bg-ember text-on-ember mt-4 min-h-10 rounded-full px-4 text-sm font-medium"
          >
            Retry
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
          No regions are loaded yet. Generate the mock delivery (pnpm fixtures) or ingest a
          delivery.
        </p>
      </Shell>
    );
  }

  if (!data || !aoi) return <ExplorerSkeleton />;

  const { calendar } = data;
  const trend = calendar.series.trend;
  const finalOnly = calendar.series.finalOnly;

  return (
    <Shell>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted font-mono text-xs tracking-wide uppercase">
            {aoi.kind === 'region' ? 'country / region' : 'custom area'}
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{data.aoi.label}</h1>
          <p className="text-muted mt-1 text-sm">
            {data.aoi.areaKm2 !== null && `${fmt(Math.round(data.aoi.areaKm2))} km² · `}
            {fmt(data.aoi.cellsCount)} map cells
            {data.aoi.coarse && ' (coarser grid: the area is very large)'}
          </p>
        </div>
        <p className="text-muted max-w-md text-sm">
          Satellites have watched fires since 2000. Two different satellites counted differently, so
          we put them on one scale. Pick a place, then click a month to compare it with a usual one.
        </p>
      </section>

      <section
        aria-label="Selected month"
        className="card mt-5 border-l-4 border-l-[var(--t-ember)] p-5 sm:p-6"
      >
        <Headline cell={selectedCell} />
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="cal-h" className="card min-w-0 p-4 sm:p-6">
          <h2 id="cal-h" className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="step">1</span> Burning calendar
          </h2>
          <p className="text-muted mt-1 text-sm">
            Each row is a year, each column a month. The brighter the square, the more fire
            activity. Click any square.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <div
              role="radiogroup"
              aria-label="Colour by"
              className="border-line bg-panel-2 flex flex-wrap rounded-full border p-0.5"
            >
              {MODES.filter((m) => m !== 'raw' || data.dataset.hasRaw).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setUrl({ mode: m })}
                  title={MODE_HELP[m]}
                  className={`min-h-9 rounded-full px-3 font-medium ${mode === m ? 'bg-text text-ink' : 'text-muted hover:text-text'}`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            {mode !== 'ratio' && (
              <button
                type="button"
                onClick={() => setPalette(palette === 'inferno' ? 'cividis' : 'inferno')}
                className="border-line text-muted hover:text-text min-h-9 rounded-full border px-3"
                aria-label={`Colour scale: ${palette}. Switch scale.`}
              >
                colours: {palette === 'inferno' ? 'warm' : 'blue–yellow'}
              </button>
            )}
            <button
              type="button"
              onClick={toggleOrder}
              className="border-line text-muted hover:text-text min-h-9 rounded-full border px-3"
            >
              {newestFirst ? 'newest first' : 'oldest first'}
            </button>
          </div>
          <p className="text-muted mt-2 text-xs">{MODE_HELP[mode]}</p>

          {calendar.empty && (
            <p
              role="status"
              className="border-line mt-3 rounded-lg border border-dashed p-3 text-sm"
            >
              No fire observations in this area. Observed months are shown as 0; months without
              observations are hatched.
            </p>
          )}

          <div className="mt-4">
            <BurningCalendar
              data={data}
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
              <span className="step">2</span> Where is it?
            </h2>
            <p className="text-muted mt-1 mb-3 text-sm">
              Real satellite picture with relief: forests, fields and mountains are visible. Drag to
              rotate, scroll to zoom.
            </p>
            <AoiMap aoi={data.aoi} />
          </section>
          <AoiPicker />
          <ExportPanel aoi={aoi} />
        </aside>
      </div>

      <section aria-labelledby="charts-h" className="card mt-6 p-4 sm:p-6">
        <h2 id="charts-h" className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="step">3</span> Is it getting worse over the years?
        </h2>
        <p className="mt-2 text-base font-medium">{trendVerdict(calendar.series)}</p>
        {trend && (
          <p className="text-muted mt-1 text-sm">
            Slope (Theil–Sen):{' '}
            <span className="font-mono">{fmtSigned(trend.slope)} fire-days per year</span> over
            complete years {trend.from}–{trend.to}
            {trend.estimateYears > 0 &&
              `; includes ${trend.estimateYears} older-satellite estimate years of ${trend.n}`}
            .{' '}
            {finalOnly
              ? `Checked years only (${finalOnly.from}–${finalOnly.to}, n = ${finalOnly.n}): ${fmtSigned(finalOnly.slope)} fire-days per year, Mann–Kendall ${formatP(finalOnly.p)}.`
              : 'Too few checked years for a separate test.'}
          </p>
        )}
        <p className="text-muted mt-1 text-xs">
          Shaded columns are incomplete years without a total; hatched years are preliminary.
          Neither is in the trend. Significance level 0.05.
        </p>
        <div className="mt-4">
          <YearlyCharts
            series={calendar.series}
            selectedYear={selected?.y ?? null}
            onSelectYear={(y) => setUrl({ y, m: selected?.m ?? 1 })}
          />
        </div>
      </section>

      {data.forecast && (
        <ForecastPanel forecast={data.forecast} monthMedians={calendar.monthMedians} />
      )}

      <section id="how" className="card mt-6 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          <li>
            <strong>1. Two satellites, one scale.</strong> MODIS (since 2000) and VIIRS (since 2012)
            see fires differently. We convert both to one unit so years are comparable.
          </li>
          <li>
            <strong>2. Compared with a usual month.</strong> &ldquo;×1.2&rdquo; means 20% more fire
            activity than the middle (median) of the same month in other years.
          </li>
          <li>
            <strong>3. We say how sure we are.</strong> Every number is marked checked, estimate,
            preliminary or no data. No data is never shown as zero.
          </li>
        </ol>
      </section>

      <section id="glossary" className="card mt-6 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Glossary</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {GLOSSARY.map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold">{t}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="text-muted mt-8 space-y-1 border-t border-[var(--t-line)] pt-4 text-xs">
        <p>
          Method: {data.dataset.method}. Usual month = median of {data.dataset.baselineYears[0]}–
          {data.dataset.baselineYears[1]}. Checked data through{' '}
          {data.dataset.standardProcessingThrough}; quick data through {data.dataset.nrtThrough}.
        </p>
        <p>
          We acknowledge the use of data and imagery from NASA&apos;s Fire Information for Resource
          Management System (FIRMS), part of NASA&apos;s Earth Science Data and Information System
          (ESDIS).
        </p>
      </footer>
    </Shell>
  );
}

const GLOSSARY: [string, string][] = [
  [
    'Fire-day',
    'One map cell (about 1 km) with fire seen on one day. A measure of activity, not burnt area or number of fires.',
  ],
  [
    'MODIS / VIIRS',
    'Two satellite instruments. VIIRS is newer and sharper, so it sees more small fires.',
  ],
  [
    'Median',
    'The middle value: half of the years had more, half less. One extreme year does not distort it.',
  ],
  ['Preliminary', 'Quick data that NASA re-checks a few months later; it may change slightly.'],
  ['Estimate', 'Years before VIIRS: MODIS counts scaled to VIIRS units. Less certain.'],
  ['P74', 'Percentile: this month had more activity than 74% of the same months in other years.'],
];

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6">{children}</main>;
}

export function ExplorerSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Loading the calendar" className="animate-pulse space-y-5">
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
