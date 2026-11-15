'use client';

import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/theme';
import type { CalendarData } from '@/lib/domain/calendar';
import { STATUS_LABEL, fmt, fmtSigned } from '@/lib/format';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

const HATCH = {
  symbol: 'rect',
  rotation: Math.PI / 4,
  dashArrayX: [1, 0],
  dashArrayY: [2, 4],
  color: 'rgba(255,255,255,0.55)',
};
const DOTS = {
  symbol: 'circle',
  symbolSize: 0.6,
  dashArrayX: [2, 4],
  dashArrayY: [2, 4],
  color: 'rgba(255,255,255,0.6)',
};
const PALETTE = {
  light: {
    axis: '#c9c2b5',
    label: '#5d5850',
    grid: '#ece8e0',
    bar: '#8a8378',
    barOff: '#cfc9bd',
    tipBg: '#ffffff',
    tipLine: '#e0dad0',
    tipText: '#1d1c1a',
    ember: '#e0561c',
    warm: '#e0561c',
    cool: '#2c64a0',
    sel: '#1d1c1a',
  },
  dark: {
    axis: '#45413a',
    label: '#a8a297',
    grid: '#24221e',
    bar: '#8f897e',
    barOff: '#45413a',
    tipBg: '#1b1a17',
    tipLine: '#2f2c27',
    tipText: '#eeebe4',
    ember: '#ff7136',
    warm: '#ed7b2b',
    cool: '#7eaadf',
    sel: '#ffffff',
  },
} as const;
const axisOf = (c: (typeof PALETTE)['light'] | (typeof PALETTE)['dark']) => ({
  axisLine: { lineStyle: { color: c.axis } },
  axisLabel: { color: c.label, fontSize: 11 },
  splitLine: { lineStyle: { color: c.grid } },
});

function useChart(
  build: () => echarts.EChartsCoreOption,
  deps: unknown[],
  onClick?: (year: number) => void,
) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const click = useRef(onClick);
  useEffect(() => {
    click.current = onClick;
  });
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'svg' });
    chart.current = c;
    c.on('click', (p) => click.current?.(Number(p.name)));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.setOption(build(), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return el;
}

/** F04: yearly totals with Theil–Sen trend, and anomalies against the baseline mean (lazy-loaded). */
export default function YearlyCharts({
  series,
  selectedYear,
  onSelectYear,
}: {
  series: CalendarData['series'];
  selectedYear: number | null;
  onSelectYear: (year: number) => void;
}) {
  const theme = useTheme();
  const c = PALETTE[theme];
  const AXIS = axisOf(c);
  const years = series.years.map((y) => String(y.y));
  const withheld = series.years
    .filter((p) => p.total === null)
    .map((p) => [{ xAxis: String(p.y) }, { xAxis: String(p.y) }]);
  const withheldBands = {
    silent: true,
    itemStyle: {
      color: 'rgba(138,131,120,0.25)',
      borderColor: c.axis,
      borderType: 'dashed',
      borderWidth: 1,
    },
    label: { show: false },
    data: withheld,
  };
  const decalOf = (s: string) =>
    s === 'preliminary' ? HATCH : s === 'estimate' ? DOTS : undefined;

  const totals = useChart(
    () => ({
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: c.tipBg,
        borderColor: c.tipLine,
        textStyle: { color: c.tipText, fontSize: 12 },
        formatter: (ps: { dataIndex: number }[]) => {
          const p = series.years[ps[0]!.dataIndex]!;
          return p.total === null
            ? `${p.y}: no total (incomplete year) · ${STATUS_LABEL[p.s]}`
            : `${p.y}: ${fmt(p.total)} fire-days<br/>${STATUS_LABEL[p.s]}${p.complete ? '' : ' · not in trend'}`;
        },
      },
      xAxis: {
        type: 'category',
        data: years,
        ...AXIS,
        axisLabel: { ...AXIS.axisLabel, interval: 3 },
      },
      yAxis: { type: 'value', ...AXIS },
      series: [
        {
          type: 'bar',
          data: series.years.map((p) => ({
            value: p.total,
            itemStyle: {
              color: p.complete ? c.bar : c.barOff,
              decal: decalOf(p.s),
              borderColor: p.y === selectedYear ? c.ember : undefined,
              borderWidth: p.y === selectedYear ? 2 : 0,
            },
          })),
          markArea: withheldBands,
        },
        ...(series.trend
          ? [
              {
                type: 'line',
                showSymbol: false,
                // Solid ember only when Mann–Kendall finds a trend; otherwise a dashed grey line.
                lineStyle: series.trend.significant
                  ? { color: c.ember, width: 2 }
                  : { color: c.bar, width: 1.5, type: 'dashed' },
                data: series.years.map((p) =>
                  p.y >= series.trend!.from && p.y <= series.trend!.to
                    ? series.trend!.intercept + series.trend!.slope * p.y
                    : null,
                ),
                tooltip: { show: false },
              },
            ]
          : []),
      ],
    }),
    [series, selectedYear, theme],
    onSelectYear,
  );

  const anomalies = useChart(
    () => ({
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: c.tipBg,
        borderColor: c.tipLine,
        textStyle: { color: c.tipText, fontSize: 12 },
        formatter: (ps: { dataIndex: number }[]) => {
          const p = series.years[ps[0]!.dataIndex]!;
          return `${p.y}: ${p.anomaly === null ? 'incomplete year' : `${fmtSigned(p.anomaly)} fire-days vs mean`}`;
        },
      },
      xAxis: {
        type: 'category',
        data: years,
        ...AXIS,
        axisLabel: { ...AXIS.axisLabel, interval: 3 },
      },
      yAxis: { type: 'value', ...AXIS },
      series: [
        {
          type: 'bar',
          data: series.years.map((p) => ({
            value: p.anomaly,
            itemStyle: {
              color: (p.anomaly ?? 0) >= 0 ? c.warm : c.cool,
              decal: decalOf(p.s),
              borderColor: p.y === selectedYear ? c.sel : undefined,
              borderWidth: p.y === selectedYear ? 2 : 0,
            },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 0 }],
            lineStyle: { color: c.bar },
            label: { show: false },
          },
          markArea: withheldBands,
        },
      ],
    }),
    [series, selectedYear, theme],
    onSelectYear,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure>
        <figcaption className="text-base font-semibold">Year totals and trend</figcaption>
        <div
          ref={totals}
          className="mt-2 h-56 w-full"
          role="img"
          aria-label="Bar chart of yearly harmonized fire-days with a Theil–Sen trend line; shaded columns are incomplete years without a total"
        />
      </figure>
      <figure>
        <figcaption className="text-base font-semibold">
          Anomalies{' '}
          {series.anomalyBase && (
            <span className="text-muted font-normal">
              vs mean {series.anomalyBase.from}–{series.anomalyBase.to} (n = {series.anomalyBase.n})
            </span>
          )}
        </figcaption>
        <div
          ref={anomalies}
          className="mt-2 h-56 w-full"
          role="img"
          aria-label="Bar chart of each year minus the multi-year mean; orange above, blue below; shaded columns are incomplete years"
        />
      </figure>
    </div>
  );
}
