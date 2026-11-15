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
  loading: () => <div className="border-line bg-panel h-56 rounded-lg border" aria-hidden="true" />,
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
        <div role="alert" className="border-line bg-panel rounded-lg border p-6">
          <p className="font-display text-lg">Could not load the calendar.</p>
          <p className="text-muted mt-1 text-sm">{(error as Error).message}</p>
          <button
            type="button"
            onClick={() => (aoi === null ? first.refetch() : query.refetch())}
            className="bg-ember text-ink mt-4 rounded-md px-3 py-1.5 text-sm font-medium"
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
        <p role="status" className="border-line bg-panel rounded-lg border p-6">
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted font-mono text-xs tracking-wide uppercase">
            {aoi.kind === 'region' ? 'country / region' : 'custom area'}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.aoi.label}
          </h1>
          <p className="text-muted mt-1 font-mono text-xs">
            {fmt(data.aoi.cellsCount)} H3 cells at resolution {data.aoi.resolution}
            {data.aoi.areaKm2 !== null && ` · ${fmt(Math.round(data.aoi.areaKm2))} km²`}
            {data.aoi.coarse && ' · coarse resolution (area above 50 000 cells)'}
          </p>
        </div>
      </header>

      <section
        aria-label="Selected month"
        className="border-line bg-panel mt-5 rounded-lg border p-4 sm:p-5"
      >
        <Headline cell={selectedCell} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-labelledby="cal-h"
          className="border-line bg-panel min-w-0 rounded-lg border p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="cal-h" className="font-display text-lg font-medium">
              Burning calendar
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div
                role="radiogroup"
                aria-label="Colour by"
                className="border-line flex rounded-md border p-0.5"
              >
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={url.mode === m}
                    onClick={() => setUrl({ mode: m })}
                    className={`rounded px-2 py-1 ${url.mode === m ? 'bg-[var(--color-line)] text-[var(--color-text)]' : 'text-muted'}`}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              {url.mode !== 'ratio' && (
                <button
                  type="button"
                  onClick={() => setPalette(palette === 'inferno' ? 'cividis' : 'inferno')}
                  className="border-line text-muted rounded-md border px-2 py-1"
                  aria-label={`Colour scale: ${palette}. Switch scale.`}
                >
                  {palette}
                </button>
              )}
              <button
                type="button"
                onClick={toggleOrder}
                className="border-line text-muted rounded-md border px-2 py-1"
              >
                {newestFirst ? 'newest first' : 'oldest first'}
              </button>
            </div>
          </div>

          {calendar.empty && (
            <p
              role="status"
              className="border-line mt-3 rounded-md border border-dashed p-3 text-sm"
            >
              No fire observations in this area. Observed months are shown as 0; months without
              observations are hatched.
            </p>
          )}

          <div className="mt-4">
            <BurningCalendar
              data={data}
              mode={url.mode}
              palette={palette}
              newestFirst={newestFirst}
              selected={selected}
              onSelect={(y, m) => setUrl({ y, m })}
            />
          </div>
          <div className="border-line mt-4 border-t pt-4">
            <Legend
              estimateBeforeYear={data.dataset.estimateBeforeYear}
              mode={url.mode}
              palette={palette}
              breaks={url.mode === 'raw' ? calendar.breaks.raw : calendar.breaks.harm}
            />
          </div>
        </section>

        <aside className="space-y-5">
          <AoiPicker />
          <AoiMap aoi={data.aoi} />
          <ExportPanel aoi={aoi} />
        </aside>
      </div>

      <section
        aria-labelledby="charts-h"
        className="border-line bg-panel mt-5 rounded-lg border p-4 sm:p-5"
      >
        <h2 id="charts-h" className="font-display text-lg font-medium">
          Yearly burning activity and trend
        </h2>
        <p className="mt-1 text-sm">{trendVerdict(calendar.series)}</p>
        {trend && (
          <p className="text-muted mt-1 text-sm">
            Theil–Sen slope{' '}
            <span className="font-mono">{fmtSigned(trend.slope)} fire-days / year</span> over
            complete years {trend.from}–{trend.to}
            {trend.estimateYears > 0 &&
              `; includes ${trend.estimateYears} MODIS-only estimate years of ${trend.n}`}
            .{' '}
            {finalOnly
              ? `Standard-processed years only (${finalOnly.from}–${finalOnly.to}, n = ${finalOnly.n}): ${fmtSigned(finalOnly.slope)} fire-days / year, Mann–Kendall ${formatP(finalOnly.p)}.`
              : 'Too few standard-processed years for a separate check.'}
          </p>
        )}
        <p className="text-muted mt-1 text-xs">
          Shaded columns are incomplete years without a total; grey years are preliminary. Neither
          is in the trend. Significance level 0.05.
        </p>
        <div className="mt-4">
          <YearlyCharts
            series={calendar.series}
            selectedYear={selected?.y ?? null}
            onSelectYear={(y) => setUrl({ y, m: selected?.m ?? 1 })}
          />
        </div>
      </section>

      <footer className="text-muted mt-8 space-y-1 border-t border-[var(--color-line)] pt-4 text-xs">
        <p>
          Method: {data.dataset.method}. Baseline {data.dataset.baselineYears[0]}–
          {data.dataset.baselineYears[1]}. Standard processing through{' '}
          {data.dataset.standardProcessingThrough}; near real-time through {data.dataset.nrtThrough}
          .
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

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>;
}

export function ExplorerSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Loading the calendar" className="animate-pulse space-y-5">
        <div className="h-16 w-72 rounded bg-[var(--color-panel)]" />
        <div className="h-28 rounded-lg bg-[var(--color-panel)]" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="h-[44rem] rounded-lg bg-[var(--color-panel)]" />
          <div className="h-[44rem] rounded-lg bg-[var(--color-panel)]" />
        </div>
      </div>
    </Shell>
  );
}
