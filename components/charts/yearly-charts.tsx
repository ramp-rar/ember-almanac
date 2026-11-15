'use client';

import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { CalendarData } from '@/lib/domain/calendar';
import { STATUS_LABEL, fmt, fmtSigned } from '@/lib/format';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

const HATCH = {
  symbol: 'rect',
  rotation: Math.PI / 4,
  dashArrayX: [1, 0],
  dashArrayY: [2, 4],
  color: 'rgba(255,255,255,0.35)',
};
const DOTS = {
  symbol: 'circle',
  symbolSize: 0.6,
  dashArrayX: [2, 4],
  dashArrayY: [2, 4],
  color: 'rgba(255,255,255,0.6)',
};
const AXIS = {
  axisLine: { lineStyle: { color: '#3a424c' } },
  axisLabel: { color: '#8b96a3', fontSize: 10 },
  splitLine: { lineStyle: { color: '#1c2229' } },
};

function useChart(
  build: () => echarts.EChartsCoreOption,
  deps: unknown[],
  onClick?: (year: number) => void,
) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'svg' });
    chart.current = c;
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
    c.off('click');
    if (onClick) c.on('click', (p) => onClick(Number(p.name)));
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
  const years = series.years.map((y) => String(y.y));
  const decalOf = (s: string) =>
    s === 'preliminary' ? HATCH : s === 'estimate' ? DOTS : undefined;

  const totals = useChart(
    () => ({
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#12161b',
        borderColor: '#232a32',
        textStyle: { color: '#e6eaef', fontSize: 11 },
        formatter: (ps: { dataIndex: number }[]) => {
          const p = series.years[ps[0]!.dataIndex]!;
          return `${p.y}: ${p.total === null ? '—' : fmt(p.total)} fire-days<br/>${STATUS_LABEL[p.s]}${p.complete ? '' : ' · not in trend'}`;
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
              color: p.complete ? '#8b96a3' : '#4b535d',
              decal: decalOf(p.s),
              borderColor: p.y === selectedYear ? '#ff6a2b' : undefined,
              borderWidth: p.y === selectedYear ? 2 : 0,
            },
          })),
        },
        ...(series.trend
          ? [
              {
                type: 'line',
                showSymbol: false,
                lineStyle: { color: '#ff6a2b', width: 2 },
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
    [series, selectedYear],
    onSelectYear,
  );

  const anomalies = useChart(
    () => ({
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#12161b',
        borderColor: '#232a32',
        textStyle: { color: '#e6eaef', fontSize: 11 },
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
              color: (p.anomaly ?? 0) >= 0 ? '#ed7b2b' : '#2b6cb0',
              decal: decalOf(p.s),
              borderColor: p.y === selectedYear ? '#e6eaef' : undefined,
              borderWidth: p.y === selectedYear ? 2 : 0,
            },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 0 }],
            lineStyle: { color: '#8b96a3' },
            label: { show: false },
          },
        },
      ],
    }),
    [series, selectedYear],
    onSelectYear,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure>
        <figcaption className="font-display text-sm font-medium">Year totals and trend</figcaption>
        <div
          ref={totals}
          className="mt-2 h-56 w-full"
          role="img"
          aria-label="Bar chart of yearly harmonized fire-days with a Theil–Sen trend line"
        />
      </figure>
      <figure>
        <figcaption className="font-display text-sm font-medium">
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
          aria-label="Bar chart of each year minus the multi-year mean; orange above, blue below"
        />
      </figure>
    </div>
  );
}
